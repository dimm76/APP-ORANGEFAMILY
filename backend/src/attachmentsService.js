const pool = require("../db");
const { getAttachmentsConfig } = require("./attachmentsConfig");
const {
  deleteObjectFromWasabi,
  getSignedUrlForStorageKey,
  uploadImageToWasabi,
} = require("./wasabiClient");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => UUID_RE.test(String(value || "").trim());

function resolveAuthenticatedFamily(req) {
  if (!req.user?.id) return { ok: false, status: 401, reason: "No autenticado." };
  const family = Array.isArray(req.user.families) ? req.user.families[0] : null;
  if (!family?.id || !isUuid(family.id)) {
    return { ok: false, status: 403, reason: "El usuario no tiene una familia activa." };
  }
  if (!["owner", "member"].includes(String(family.role || ""))) {
    return { ok: false, status: 403, reason: "El rol familiar no tiene acceso a este módulo." };
  }
  return { ok: true, userId: String(req.user.id), familyId: String(family.id), membership: family, role: family.role || null };
}

async function reconcileAttachmentLinks(queryable, { familyId, userId, entityType, entityId, fieldKey = "content", usageType = "embedded_image", attachmentIds = [] }) {
  const ids = [...new Set(attachmentIds.map((id) => String(id || "").toLowerCase()).filter(isUuid))];
  const owned = ids.length ? await queryable.query(
    `SELECT id::text FROM public.attachments WHERE family_id=$1::uuid AND id=ANY($2::uuid[]) AND status='active' AND deleted_at IS NULL`,
    [familyId, ids]
  ) : { rows: [] };
  if (owned.rows.length !== ids.length) throw new Error("El contenido referencia attachments no disponibles para esta familia.");
  await queryable.query(
    `DELETE FROM public.attachment_links WHERE entity_type=$1 AND entity_id=$2::uuid AND field_key=$3 AND usage_type=$4 AND NOT (attachment_id=ANY($5::uuid[]))`,
    [entityType, entityId, fieldKey, usageType, ids]
  );
  if (ids.length) await queryable.query(
    `INSERT INTO public.attachment_links (attachment_id,entity_type,entity_id,field_key,usage_type,created_by)
     SELECT unnest($1::uuid[]),$2,$3::uuid,$4,$5,$6::uuid
     ON CONFLICT (attachment_id,entity_type,entity_id,field_key,usage_type) DO NOTHING`,
    [ids, entityType, entityId, fieldKey, usageType, userId]
  );
}

async function getPublicAttachmentUrls(entityIds) {
  const ids = entityIds.filter(isUuid);
  if (!ids.length) return {};
  const result = await pool.query(
    `SELECT DISTINCT a.id,a.bucket,a.storage_key FROM public.attachments a
     INNER JOIN public.attachment_links al ON al.attachment_id=a.id
     WHERE al.entity_type='wiki_page' AND al.entity_id=ANY($1::uuid[])
       AND a.status='active' AND a.deleted_at IS NULL`, [ids]
  );
  const pairs = await Promise.all(result.rows.map(async (row) => [String(row.id).toLowerCase(), await getSignedUrlForStorageKey(row)]));
  return Object.fromEntries(pairs);
}

function imageDimensions(buffer, mimeType) {
  try {
    if (mimeType === "image/png" && buffer.length >= 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }
    if (mimeType === "image/gif" && buffer.length >= 10) {
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
    }
    if (mimeType === "image/webp" && buffer.length >= 30) {
      const kind = buffer.toString("ascii", 12, 16);
      if (kind === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
      if (kind === "VP8L") {
        const bits = buffer.readUInt32LE(21);
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      if (kind === "VP8 " && buffer.length >= 30) {
        return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
      }
    }
    if (mimeType === "image/jpeg") {
      let offset = 2;
      while (offset + 9 < buffer.length) {
        if (buffer[offset] !== 0xff) { offset += 1; continue; }
        const marker = buffer[offset + 1];
        const length = buffer.readUInt16BE(offset + 2);
        if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
          return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
        }
        if (length < 2) break;
        offset += 2 + length;
      }
    }
  } catch { /* dimensiones opcionales */ }
  return { width: null, height: null };
}

function mapRow(row) {
  return { ...row, usage_count: Number(row.usage_count) || 0 };
}

async function uploadImageAttachment(req, file) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  const config = getAttachmentsConfig();
  if (!config.configured) return { ok: false, status: 503, reason: "Almacenamiento no configurado." };
  if (!file?.buffer?.length) return { ok: false, status: 400, reason: "Falta el archivo de imagen." };
  if (!config.allowedMimeTypes.includes(file.mimeType)) return { ok: false, status: 400, reason: "Tipo de imagen no permitido." };
  if (file.buffer.length > config.maxImageBytes) return { ok: false, status: 400, reason: "La imagen supera el tamaño máximo permitido." };

  const dimensions = imageDimensions(file.buffer, file.mimeType);
  if (!dimensions.width || !dimensions.height) {
    return { ok: false, status: 400, reason: "El contenido no es una imagen válida del tipo indicado." };
  }

  let uploaded;
  let inserted = false;
  try {
    uploaded = await uploadImageToWasabi(file.buffer, { mimeType: file.mimeType, originalFilename: file.filename });
    const result = await pool.query(
      `INSERT INTO public.attachments
       (family_id, storage_provider, bucket, storage_key, original_filename, mime_type,
        size_bytes, width, height, checksum, status, created_by)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11::uuid)
       RETURNING id, bucket, storage_key, mime_type, size_bytes, width, height`,
      [auth.familyId, uploaded.storage_provider, uploaded.bucket, uploaded.storage_key,
        uploaded.original_filename, uploaded.mime_type, uploaded.size_bytes, dimensions.width,
        dimensions.height, uploaded.checksum, auth.userId]
    );
    const row = result.rows[0];
    inserted = true;
    return { ok: true, payload: { id: row.id, mime_type: row.mime_type, size_bytes: row.size_bytes,
      width: row.width, height: row.height, signed_url: await getSignedUrlForStorageKey(row) } };
  } catch (error) {
    if (uploaded && !inserted) { try { await deleteObjectFromWasabi(uploaded); } catch { /* limpieza best effort */ } }
    return { ok: false, status: 502, reason: error instanceof Error ? error.message : "No se pudo subir la imagen." };
  }
}

async function listAttachmentsFromDb(req) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 30));
  const offset = (page - 1) * perPage;
  const count = await pool.query("SELECT COUNT(*)::int total FROM public.attachments WHERE family_id=$1::uuid AND deleted_at IS NULL", [auth.familyId]);
  const result = await pool.query(
    `SELECT a.id,a.original_filename,a.mime_type,a.size_bytes,a.width,a.height,a.status,a.created_at,a.created_by,
      COALESCE(COUNT(al.id),0)::int usage_count
     FROM public.attachments a LEFT JOIN public.attachment_links al ON al.attachment_id=a.id
     WHERE a.family_id=$1::uuid AND a.deleted_at IS NULL
     GROUP BY a.id ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`,
    [auth.familyId, perPage, offset]
  );
  return { ok: true, payload: { items: result.rows.map(mapRow), page, per_page: perPage, total: count.rows[0].total } };
}

async function listImageAttachmentsFromDb(req) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 24));
  const offset = (page - 1) * limit;
  const query = String(req.query.q || "").trim().slice(0, 120);
  const values = [auth.familyId];
  const where = ["family_id=$1::uuid", "deleted_at IS NULL", "status='active'", "mime_type LIKE 'image/%'"];
  if (query) { values.push(`%${query}%`); where.push(`original_filename ILIKE $${values.length}`); }
  const count = await pool.query(`SELECT COUNT(*)::int total FROM public.attachments WHERE ${where.join(" AND ")}`, values);
  values.push(limit, offset);
  const result = await pool.query(`SELECT id,bucket,storage_key,original_filename,mime_type,size_bytes,width,height,created_at FROM public.attachments WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  const items = await Promise.all(result.rows.map(async (row) => ({ id: row.id, url: await getSignedUrlForStorageKey(row), filename: row.original_filename || "imagen", mimeType: row.mime_type, sizeBytes: row.size_bytes, width: row.width, height: row.height, createdAt: row.created_at })));
  return { ok: true, payload: { items, page, limit, total: count.rows[0].total } };
}

async function getSignedAttachmentUrl(req, id) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  if (!isUuid(id)) return { ok: false, status: 400, reason: "Identificador no válido." };
  const result = await pool.query("SELECT bucket,storage_key FROM public.attachments WHERE id=$1::uuid AND family_id=$2::uuid AND status='active' AND deleted_at IS NULL", [id, auth.familyId]);
  if (!result.rows[0]) return { ok: false, status: 404, reason: "Attachment no encontrado." };
  return { ok: true, payload: { signed_url: await getSignedUrlForStorageKey(result.rows[0]) } };
}

async function linkAttachmentToEntity(req, id, body) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  const entityType = String(body.entityType || body.entity_type || "").trim().toLowerCase();
  const entityId = String(body.entityId || body.entity_id || "").trim();
  const fieldKey = String(body.fieldKey || body.field_key || "content").trim() || "content";
  const usageType = String(body.usageType || body.usage_type || "embedded_image").trim() || "embedded_image";
  if (!isUuid(id) || !entityType || !isUuid(entityId) || entityType.length > 100 || fieldKey.length > 100 || usageType.length > 100) return { ok: false, status: 400, reason: "Datos de vínculo no válidos." };
  const result = await pool.query(
    `WITH attachment AS (
       SELECT id, bucket, storage_key, original_filename, mime_type, size_bytes,
              width, height, created_at
       FROM public.attachments
       WHERE id=$1::uuid AND family_id=$2::uuid AND status='active' AND deleted_at IS NULL
     ), inserted AS (
       INSERT INTO public.attachment_links (attachment_id,entity_type,entity_id,field_key,usage_type,created_by)
       SELECT id,$3,$4::uuid,$5,$6,$7::uuid FROM attachment
       ON CONFLICT (attachment_id,entity_type,entity_id,field_key,usage_type) DO NOTHING
     )
     SELECT * FROM attachment
    `,
    [id, auth.familyId, entityType, entityId, fieldKey, usageType, auth.userId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, status: 404, reason: "Attachment no encontrado." };
  return { ok: true, payload: { attachment: {
    id: row.id, url: await getSignedUrlForStorageKey(row),
    filename: row.original_filename || "imagen", mimeType: row.mime_type,
    sizeBytes: row.size_bytes, width: row.width, height: row.height,
    createdAt: row.created_at,
  } } };
}

async function deleteAttachmentIfUnused(req, id) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  if (!isUuid(id)) return { ok: false, status: 400, reason: "Identificador no válido." };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`SELECT a.bucket,a.storage_key,a.status,a.deleted_at,(SELECT COUNT(*)::int FROM public.attachment_links WHERE attachment_id=a.id) usage_count FROM public.attachments a WHERE a.id=$1::uuid AND a.family_id=$2::uuid FOR UPDATE`, [id, auth.familyId]);
    const row = result.rows[0];
    if (!row || row.deleted_at || row.status === "deleted") { await client.query("ROLLBACK"); return { ok: false, status: 404, reason: "Attachment no encontrado." }; }
    if (Number(row.usage_count) > 0) { await client.query("ROLLBACK"); return { ok: false, status: 409, reason: "No se puede borrar: el archivo sigue en uso." }; }
    await deleteObjectFromWasabi(row);
    await client.query("UPDATE public.attachments SET status='deleted',deleted_at=now() WHERE id=$1::uuid", [id]);
    await client.query("COMMIT");
    return { ok: true, payload: { deleted: true } };
  } catch (error) {
    await client.query("ROLLBACK");
    return { ok: false, status: 502, reason: error instanceof Error ? error.message : "No se pudo borrar." };
  } finally { client.release(); }
}

module.exports = { resolveAuthenticatedFamily, reconcileAttachmentLinks, getPublicAttachmentUrls, uploadImageAttachment, listAttachmentsFromDb,
  listImageAttachmentsFromDb, getSignedAttachmentUrl, linkAttachmentToEntity, deleteAttachmentIfUnused };
