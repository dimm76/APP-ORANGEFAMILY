const { randomBytes } = require("node:crypto");
const pool = require("../db");
const { resolveAuthenticatedFamily, reconcileAttachmentLinks, getPublicAttachmentUrls } = require("./attachmentsService");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES = new Set(["document", "note", "procedure", "guide", "report", "memory"]);
const STATUSES = new Set(["draft", "publish", "archived"]);
const VISIBILITIES = new Set(["internal", "public_link"]);
const isUuid = (v) => UUID_RE.test(String(v || "").trim());
const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);
const resultError = (status, reason) => ({ ok: false, status, reason });

function slugify(value) {
  return clean(value, 160).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "documento";
}
function plainText(html) { return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 100000); }
function attachmentIds(json, html) {
  const out = new Set();
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    for (const key of ["attachmentId", "backgroundImageId"]) if (isUuid(node.attrs?.[key])) out.add(String(node.attrs[key]).toLowerCase());
    if (Array.isArray(node.content)) node.content.forEach(visit);
  };
  visit(json);
  const re = /data-(?:attachment-id|background-image-id)=["']([0-9a-f-]{36})["']/gi;
  let match; while ((match = re.exec(String(html || "")))) if (isUuid(match[1])) out.add(match[1].toLowerCase());
  return [...out];
}
async function uniqueSlug(queryable, familyId, title, excludeId = null) {
  const base = slugify(title); let candidate = base; let n = 2;
  while ((await queryable.query(`SELECT 1 FROM public.wiki_pages WHERE family_id=$1::uuid AND slug=$2 AND ($3::uuid IS NULL OR id<>$3::uuid)`, [familyId, candidate, excludeId])).rowCount) candidate = `${base}-${n++}`;
  return candidate;
}
function parseWikiListQuery(query = {}) {
  return {
    search: clean(query.search || query.q, 200), status: clean(query.status, 20), visibility: clean(query.visibility, 30),
    documentType: clean(query.document_type, 30), includeArchived: String(query.include_archived) === "true",
    rootsOnly: String(query.roots_only ?? "true") !== "false", page: Math.max(1, Number(query.page) || 1),
    perPage: Math.min(100, Math.max(1, Number(query.per_page) || 20)), order: clean(query.order, 30) || "updated_desc",
  };
}
function parseWikiOutlineQuery(query = {}) { return { includeArchived: String(query.include_archived) === "true" }; }
function mapPage(row, detail = false) {
  const mapped = { id: row.id, parent_id: row.parent_id, title: row.title, slug: row.slug, excerpt: row.excerpt,
    status: row.status, visibility: row.visibility, document_type: row.document_type, menu_order: row.menu_order,
    is_archived: row.is_archived, public_enabled: row.public_enabled, public_token: row.public_token,
    public_published_at: row.public_published_at, public_expires_at: row.public_expires_at,
    created_at: row.created_at, updated_at: row.updated_at, published_at: row.published_at };
  if (detail) { mapped.content_json = row.content_json; mapped.content_html = row.content_html; }
  return mapped;
}
async function fetchWikiListFromDb(req, query) {
  const auth = resolveAuthenticatedFamily(req); if (!auth.ok) return auth;
  const q = parseWikiListQuery(query); const values = [auth.familyId]; const where = ["family_id=$1::uuid"];
  if (!q.includeArchived) where.push("is_archived=false"); if (q.rootsOnly) where.push("parent_id IS NULL");
  for (const [field, value, allowed] of [["status", q.status, STATUSES], ["visibility", q.visibility, VISIBILITIES], ["document_type", q.documentType, TYPES]]) {
    if (value && allowed.has(value)) { values.push(value); where.push(`${field}=$${values.length}`); }
  }
  if (q.search) { values.push(`%${q.search}%`); where.push(`(title ILIKE $${values.length} OR search_text ILIKE $${values.length})`); }
  const count = await pool.query(`SELECT COUNT(*)::int total FROM public.wiki_pages WHERE ${where.join(" AND ")}`, values);
  const orders = { updated_desc: "updated_at DESC,id", updated_asc: "updated_at ASC,id", title_asc: "lower(title),id", title_desc: "lower(title) DESC,id" };
  values.push(q.perPage, (q.page - 1) * q.perPage);
  const rows = await pool.query(`SELECT * FROM public.wiki_pages WHERE ${where.join(" AND ")} ORDER BY ${orders[q.order] || orders.updated_desc} LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  const total = Number(count.rows[0].total) || 0;
  return { ok: true, payload: { items: rows.rows.map((r) => mapPage(r)), total, page: q.page, max_pages: Math.max(1, Math.ceil(total / q.perPage)), per_page: q.perPage, order: q.order, roots_only: q.rootsOnly } };
}
async function fetchWikiOutlineFromDb(req, query) {
  const auth = resolveAuthenticatedFamily(req); if (!auth.ok) return auth; const q = parseWikiOutlineQuery(query);
  const rows = await pool.query(`SELECT * FROM public.wiki_pages WHERE family_id=$1::uuid ${q.includeArchived ? "" : "AND is_archived=false"} ORDER BY menu_order,lower(title),id`, [auth.familyId]);
  return { ok: true, payload: { items: rows.rows.map((r) => mapPage(r)), limit: 1000 } };
}
async function fetchWikiByIdFromDb(req, id) {
  const auth = resolveAuthenticatedFamily(req); if (!auth.ok) return auth; if (!isUuid(id)) return resultError(400, "Identificador no válido.");
  const r = await pool.query("SELECT * FROM public.wiki_pages WHERE id=$1::uuid AND family_id=$2::uuid", [id, auth.familyId]);
  return r.rows[0] ? { ok: true, payload: mapPage(r.rows[0], true) } : resultError(404, "Página wiki no encontrada.");
}
async function validateParent(client, familyId, pageId, parentId) {
  if (parentId == null || parentId === "") return { ok: true, parentId: null };
  if (!isUuid(parentId) || parentId === pageId) return resultError(400, "Página padre no válida.");
  const parent = await client.query("SELECT id FROM public.wiki_pages WHERE id=$1::uuid AND family_id=$2::uuid", [parentId, familyId]);
  if (!parent.rowCount) return resultError(400, "La página padre no pertenece a la familia.");
  if (pageId) {
    const cycle = await client.query(`WITH RECURSIVE descendants AS (SELECT id FROM public.wiki_pages WHERE parent_id=$1::uuid AND family_id=$2::uuid UNION ALL SELECT w.id FROM public.wiki_pages w JOIN descendants d ON w.parent_id=d.id WHERE w.family_id=$2::uuid) SELECT 1 FROM descendants WHERE id=$3::uuid`, [pageId, familyId, parentId]);
    if (cycle.rowCount) return resultError(409, "No se puede mover una página dentro de sus descendientes.");
  }
  return { ok: true, parentId };
}
async function createWikiPageInDb(req, body = {}) {
  const auth = resolveAuthenticatedFamily(req); if (!auth.ok) return auth; const title = clean(body.title, 200);
  if (!title) return resultError(400, "El título es obligatorio.");
  const type = clean(body.document_type, 30) || "document"; if (!TYPES.has(type)) return resultError(400, "Tipo documental no válido.");
  const client = await pool.connect(); try { await client.query("BEGIN");
    const parent = await validateParent(client, auth.familyId, null, body.parent_id); if (!parent.ok) { await client.query("ROLLBACK"); return parent; }
    const order = Number.isInteger(body.menu_order) ? body.menu_order : Number((await client.query("SELECT COALESCE(MAX(menu_order),-1)+1 n FROM public.wiki_pages WHERE family_id=$1::uuid AND parent_id IS NOT DISTINCT FROM $2::uuid", [auth.familyId, parent.parentId])).rows[0].n);
    const slug = await uniqueSlug(client, auth.familyId, body.slug || title); const html = String(body.content_html || ""); const json = body.content_json && typeof body.content_json === "object" ? body.content_json : null;
    const r = await client.query(`INSERT INTO public.wiki_pages (family_id,parent_id,title,slug,content_json,content_html,search_text,excerpt,status,visibility,document_type,menu_order,is_archived,created_by,updated_by,published_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,CASE WHEN $9='publish' THEN now() END) RETURNING *`, [auth.familyId,parent.parentId,title,slug,json,html,plainText(html),clean(body.excerpt,500)||plainText(html).slice(0,240),STATUSES.has(body.status)?body.status:"draft",VISIBILITIES.has(body.visibility)?body.visibility:"internal",type,order,Boolean(body.is_archived),auth.userId]);
    await reconcileAttachmentLinks(client,{...auth,entityType:"wiki_page",entityId:r.rows[0].id,attachmentIds:attachmentIds(json,html)}); await client.query("COMMIT");
    return { ok:true,payload:mapPage(r.rows[0],true) };
  } catch(e) { await client.query("ROLLBACK"); return resultError(400,e.message || "No se pudo crear la página."); } finally { client.release(); }
}
async function updateWikiPageInDb(req,id,body={}) {
  const auth=resolveAuthenticatedFamily(req); if(!auth.ok)return auth; if(!isUuid(id))return resultError(400,"Identificador no válido.");
  const client=await pool.connect(); try { await client.query("BEGIN"); const cur=(await client.query("SELECT * FROM public.wiki_pages WHERE id=$1 AND family_id=$2 FOR UPDATE",[id,auth.familyId])).rows[0]; if(!cur){await client.query("ROLLBACK");return resultError(404,"Página wiki no encontrada.");}
    const title=Object.hasOwn(body,"title")?clean(body.title,200):cur.title; if(!title){await client.query("ROLLBACK");return resultError(400,"El título es obligatorio.");}
    const status=Object.hasOwn(body,"status")?clean(body.status,20):cur.status; const visibility=Object.hasOwn(body,"visibility")?clean(body.visibility,30):cur.visibility; const type=Object.hasOwn(body,"document_type")?clean(body.document_type,30):cur.document_type;
    if(!STATUSES.has(status)||!VISIBILITIES.has(visibility)||!TYPES.has(type)){await client.query("ROLLBACK");return resultError(400,"Metadatos no válidos.");}
    const json=Object.hasOwn(body,"content_json")?body.content_json:cur.content_json; const html=Object.hasOwn(body,"content_html")?String(body.content_html||""):cur.content_html; const archived=Object.hasOwn(body,"is_archived")?Boolean(body.is_archived):cur.is_archived;
    const slug=Object.hasOwn(body,"slug")?await uniqueSlug(client,auth.familyId,body.slug||title,id):cur.slug;
    const r=await client.query(`UPDATE public.wiki_pages SET title=$3,slug=$4,content_json=$5,content_html=$6,search_text=$7,excerpt=$8,status=$9,visibility=$10,document_type=$11,is_archived=$12,updated_by=$13,published_at=CASE WHEN $9='publish' THEN COALESCE(published_at,now()) ELSE published_at END WHERE id=$1 AND family_id=$2 RETURNING *`,[id,auth.familyId,title,slug,json,html,plainText(html),Object.hasOwn(body,"excerpt")?clean(body.excerpt,500):cur.excerpt,status,visibility,type,archived,auth.userId]);
    await reconcileAttachmentLinks(client,{...auth,entityType:"wiki_page",entityId:id,attachmentIds:attachmentIds(json,html)}); await client.query("COMMIT"); return {ok:true,payload:mapPage(r.rows[0],true)};
  }catch(e){await client.query("ROLLBACK");return resultError(400,e.message||"No se pudo guardar.");}finally{client.release();}
}
async function moveWikiPageInDb(req,id,body={}) {
  const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;
  if(!isUuid(id))return resultError(400,"Identificador no válido.");
  const requestedParent=Object.hasOwn(body,"target_parent_id")?body.target_parent_id:body.parent_id;
  const requestedIndex=Number(Object.hasOwn(body,"target_index")?body.target_index:body.menu_order);
  if(!Number.isFinite(requestedIndex)||requestedIndex<0)return resultError(400,"Índice destino no válido.");
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const current=(await client.query("SELECT id,parent_id FROM public.wiki_pages WHERE id=$1 AND family_id=$2 FOR UPDATE",[id,auth.familyId])).rows[0];
    if(!current){await client.query("ROLLBACK");return resultError(404,"Página wiki no encontrada.");}
    const parent=await validateParent(client,auth.familyId,id,requestedParent);
    if(!parent.ok){await client.query("ROLLBACK");return parent;}
    const siblings=await client.query(`SELECT id FROM public.wiki_pages WHERE family_id=$1 AND parent_id IS NOT DISTINCT FROM $2::uuid AND id<>$3 AND is_archived=false ORDER BY menu_order,lower(title),id`,[auth.familyId,parent.parentId,id]);
    const ids=siblings.rows.map(row=>String(row.id));
    const insertAt=Math.max(0,Math.min(Math.floor(requestedIndex),ids.length));
    ids.splice(insertAt,0,id);
    for(let index=0;index<ids.length;index+=1){await client.query("UPDATE public.wiki_pages SET parent_id=$3,menu_order=$4,updated_by=$5 WHERE id=$1 AND family_id=$2",[ids[index],auth.familyId,parent.parentId,index+1,auth.userId]);}
    if(String(current.parent_id||"")!==String(parent.parentId||"")){
      const previous=await client.query(`SELECT id FROM public.wiki_pages WHERE family_id=$1 AND parent_id IS NOT DISTINCT FROM $2::uuid AND is_archived=false ORDER BY menu_order,lower(title),id`,[auth.familyId,current.parent_id]);
      for(let index=0;index<previous.rows.length;index+=1){await client.query("UPDATE public.wiki_pages SET menu_order=$3 WHERE id=$1 AND family_id=$2",[previous.rows[index].id,auth.familyId,index+1]);}
    }
    await client.query("COMMIT");return{ok:true,payload:{ok:true}};
  }catch(e){await client.query("ROLLBACK");return resultError(400,e.message||"No se pudo mover la página.");}finally{client.release();}
}
async function duplicateWikiPageInDb(req,id){const page=await fetchWikiByIdFromDb(req,id);if(!page.ok)return page;const p=page.payload;return createWikiPageInDb(req,{...p,title:`Copia de ${p.title}`,slug:null,status:"draft",visibility:"internal",public_enabled:false});}
async function deleteWikiPageInDb(req,id){const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;if(!isUuid(id))return resultError(400,"Identificador no válido.");const existing=await pool.query("SELECT id FROM public.wiki_pages WHERE id=$1 AND family_id=$2",[id,auth.familyId]);if(!existing.rowCount)return resultError(404,"Documento wiki no encontrado.");const children=await pool.query("SELECT 1 FROM public.wiki_pages WHERE parent_id=$1 AND family_id=$2 AND is_archived=false LIMIT 1",[id,auth.familyId]);if(children.rowCount)return resultError(400,"No se puede borrar un documento con páginas hijas activas.");await pool.query(`UPDATE public.wiki_pages SET is_archived=true,status='archived',visibility='internal',public_enabled=false,public_revoked_at=now(),updated_by=$3 WHERE id=$1 AND family_id=$2`,[id,auth.familyId,auth.userId]);return{ok:true,payload:{archived:true}};}
async function publishWikiPublicLinkInDb(req,id,body={}){const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;if(!isUuid(id))return resultError(400,"Identificador no válido.");const expires=body.expires_at?new Date(body.expires_at):null;if(expires&&(!Number.isFinite(expires.getTime())||expires<=new Date()))return resultError(400,"Caducidad no válida.");const token=randomBytes(32).toString("hex");const r=await pool.query(`UPDATE public.wiki_pages SET public_enabled=true,public_token=$3,public_published_at=now(),public_expires_at=$4,public_revoked_at=NULL,visibility='public_link',status='publish',published_at=COALESCE(published_at,now()),updated_by=$5 WHERE id=$1 AND family_id=$2 AND is_archived=false RETURNING *`,[id,auth.familyId,token,expires,auth.userId]);return r.rows[0]?{ok:true,payload:mapPage(r.rows[0],true)}:resultError(404,"Documento no encontrado.");}
async function revokeWikiPublicLinkInDb(req,id){const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;const r=await pool.query("UPDATE public.wiki_pages SET public_enabled=false,public_revoked_at=now(),updated_by=$3 WHERE id=$1 AND family_id=$2 RETURNING *",[id,auth.familyId,auth.userId]);return r.rows[0]?{ok:true,payload:mapPage(r.rows[0],true)}:resultError(404,"Documento no encontrado.");}
async function fetchPublicWikiByTokenFromDb(token){const safe=clean(token,128);if(!safe)return resultError(404,"Documento no encontrado.");const root=(await pool.query(`SELECT id,parent_id,title,slug,content_json,content_html,excerpt,status,visibility,document_type,menu_order,public_published_at,public_expires_at,updated_at FROM public.wiki_pages WHERE public_token=$1 AND public_enabled=true AND visibility='public_link' AND status='publish' AND is_archived=false AND public_revoked_at IS NULL AND (public_expires_at IS NULL OR public_expires_at>now())`,[safe])).rows[0];if(!root)return resultError(404,"Documento público no encontrado.");const rows=await pool.query(`WITH RECURSIVE tree AS (SELECT id,parent_id,title,slug,content_json,content_html,excerpt,status,visibility,document_type,menu_order,public_published_at,public_expires_at,updated_at FROM public.wiki_pages WHERE id=$1 UNION ALL SELECT w.id,w.parent_id,w.title,w.slug,w.content_json,w.content_html,w.excerpt,w.status,w.visibility,w.document_type,w.menu_order,w.public_published_at,w.public_expires_at,w.updated_at FROM public.wiki_pages w JOIN tree t ON w.parent_id=t.id WHERE w.family_id=(SELECT family_id FROM public.wiki_pages WHERE id=$1) AND w.status='publish' AND w.is_archived=false) SELECT * FROM tree ORDER BY menu_order,lower(title)`,[root.id]);const attachment_urls=await getPublicAttachmentUrls(rows.rows.map(r=>r.id));return{ok:true,payload:{item:root,outline:rows.rows,attachment_urls}};}
async function copyRootContentToChildInDb(req,id){const root=await fetchWikiByIdFromDb(req,id);if(!root.ok)return root;if(root.payload.parent_id)return resultError(400,"La página indicada no es raíz.");return createWikiPageInDb(req,{parent_id:id,title:`${root.payload.title} - copia`,content_json:root.payload.content_json,content_html:root.payload.content_html,document_type:root.payload.document_type});}

module.exports={parseWikiListQuery,parseWikiOutlineQuery,fetchWikiListFromDb,fetchWikiOutlineFromDb,fetchWikiByIdFromDb,createWikiPageInDb,updateWikiPageInDb,duplicateWikiPageInDb,moveWikiPageInDb,deleteWikiPageInDb,copyRootContentToChildInDb,publishWikiPublicLinkInDb,revokeWikiPublicLinkInDb,fetchPublicWikiByTokenFromDb};
