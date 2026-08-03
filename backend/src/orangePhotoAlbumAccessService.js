const pool = require("../db");
const { resolveAuthenticatedFamily } = require("./attachmentsService");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECIPIENT_ERROR = {
  status: 400,
  code: "INVALID_ALBUM_RECIPIENTS",
  reason: "Los destinatarios del álbum no son válidos.",
};
const ok = (payload = {}) => ({ ok: true, payload });
const bad = (status, code, reason) => ({ ok: false, status, code, reason });
const isUuid = (value) => UUID_RE.test(String(value || "").trim());
const invalidRecipients = () => bad(RECIPIENT_ERROR.status, RECIPIENT_ERROR.code, RECIPIENT_ERROR.reason);

async function resolveOwnedAlbum(req, albumId, queryable = pool) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  if (!isUuid(albumId)) return bad(404, "ALBUM_NOT_FOUND", "Álbum no encontrado.");
  const row = (await queryable.query(
    `SELECT a.id,a.title,a.family_id,a.owner_user_id,a.allow_contributions,a.allow_comments,a.is_archived
       FROM public.orange_photo_albums a
      WHERE a.id=$1::uuid AND a.family_id=$2::uuid AND a.owner_user_id=$3::uuid AND a.is_archived=false LIMIT 1`,
    [albumId, auth.familyId, auth.userId],
  )).rows[0];
  return row ? ok({ auth, album: row }) : bad(404, "ALBUM_NOT_FOUND", "Álbum no encontrado.");
}

async function resolveAlbumAccess(req, albumId, queryable = pool) {
  if (!req.user?.id) return bad(401, "NOT_AUTHENTICATED", "No autenticado.");
  if (!isUuid(albumId)) return bad(404, "ALBUM_NOT_FOUND", "Álbum no encontrado.");
  const row = (await queryable.query(
    `SELECT album.id album_id,album.family_id,album.owner_user_id,album.allow_contributions,album.allow_comments,access.subject_type
       FROM public.orange_photo_albums album
       LEFT JOIN public.orange_photo_album_access access ON access.album_id=album.id AND access.user_id=$2::uuid AND access.status='active' AND access.revoked_at IS NULL
      WHERE album.id=$1::uuid AND album.is_archived=false AND (album.owner_user_id=$2::uuid OR access.id IS NOT NULL) LIMIT 1`,
    [albumId, req.user.id],
  )).rows[0];
  if (!row) return bad(404, "ALBUM_NOT_FOUND", "Álbum no encontrado.");
  const isOwner = String(row.owner_user_id) === String(req.user.id);
  return ok({ albumId: String(row.album_id), familyId: String(row.family_id), userId: String(req.user.id), isOwner, subjectType: isOwner ? "owner" : row.subject_type, permissions: { can_view: true, can_contribute: isOwner || row.allow_contributions === true, can_comment: isOwner || row.allow_comments === true } });
}

async function listAlbumRecipients(req, albumId, queryable = pool) {
  const owned = await resolveOwnedAlbum(req, albumId, queryable);
  if (!owned.ok) return owned;
  const { auth, album } = owned.payload;
  const [family, external] = await Promise.all([
    queryable.query(`SELECT auth_user.id user_id,auth_user.email,COALESCE(NULLIF(btrim(person.preferred_name),''),NULLIF(btrim(concat_ws(' ',person.first_name,person.last_name)),''),auth_user.email) display_name,access.status access_status FROM public.family_memberships membership JOIN public.persons person ON person.id=membership.person_id JOIN public.auth_users auth_user ON auth_user.person_id=person.id LEFT JOIN public.orange_photo_album_access access ON access.album_id=$2::uuid AND access.user_id=auth_user.id WHERE membership.family_id=$1::uuid AND membership.status='active' AND auth_user.status IN ('active','pending') AND auth_user.id<>$3::uuid ORDER BY lower(COALESCE(NULLIF(btrim(person.preferred_name),''),person.first_name,auth_user.email))`, [auth.familyId, albumId, auth.userId]),
    queryable.query(`SELECT DISTINCT ON(auth_user.id) auth_user.id user_id,auth_user.email,auth_user.status auth_status,COALESCE(NULLIF(btrim(person.preferred_name),''),NULLIF(btrim(concat_ws(' ',person.first_name,person.last_name)),''),auth_user.email) display_name,current_access.status access_status FROM public.auth_users auth_user LEFT JOIN public.persons person ON person.id=auth_user.person_id JOIN public.orange_photo_album_access known_access ON known_access.user_id=auth_user.id AND known_access.subject_type='external' JOIN public.orange_photo_albums known_album ON known_album.id=known_access.album_id AND known_album.family_id=$1::uuid LEFT JOIN public.orange_photo_album_access current_access ON current_access.album_id=$2::uuid AND current_access.user_id=auth_user.id WHERE auth_user.status IN ('active','pending') AND NOT EXISTS(SELECT 1 FROM public.family_memberships membership WHERE membership.person_id=auth_user.person_id AND membership.family_id=$1::uuid AND membership.status='active') ORDER BY auth_user.id,known_access.updated_at DESC`, [auth.familyId, albumId]),
  ]);
  return ok({ album: { id: String(album.id), allow_contributions: album.allow_contributions === true, allow_comments: album.allow_comments === true }, family: family.rows.map((row) => ({ key: `family:${row.user_id}`, user_id: String(row.user_id), type: "family", email: row.email, display_name: row.display_name, selected: row.access_status === "active", status: row.access_status || "available" })), external: external.rows.map((row) => ({ key: `external:${row.user_id}`, user_id: String(row.user_id), type: "external", email: row.email, display_name: row.display_name, selected: row.access_status === "active" || row.access_status === "pending", status: row.access_status || "available" })) });
}

function validRecipientInput(input, ownerId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  if (Object.keys(input).some((key) => !["recipients", "allow_contributions", "allow_comments"].includes(key))) return false;
  if (!Array.isArray(input.recipients) || input.recipients.length > 500 || typeof input.allow_contributions !== "boolean" || typeof input.allow_comments !== "boolean") return false;
  const seen = new Set();
  return input.recipients.every((recipient) => {
    if (!recipient || typeof recipient !== "object" || Array.isArray(recipient) || Object.keys(recipient).some((key) => !["user_id", "subject_type", "status", "invitation_id"].includes(key))) return false;
    const { user_id: userId, subject_type: subjectType, status, invitation_id: invitationId } = recipient;
    if (!isUuid(userId) || seen.has(String(userId).toLowerCase()) || !["family", "external"].includes(subjectType) || !["active", "pending"].includes(status)) return false;
    if (String(userId).toLowerCase() === String(ownerId).toLowerCase()) return false;
    if (subjectType === "family" && (status !== "active" || invitationId !== null)) return false;
    if (subjectType === "external" && status === "pending" && !isUuid(invitationId)) return false;
    if (subjectType === "external" && status === "active" && invitationId !== null && !isUuid(invitationId)) return false;
    seen.add(String(userId).toLowerCase());
    return true;
  });
}

async function syncAlbumRecipients(req, albumId, input, queryable = pool) {
  if (!validRecipientInput(input, req.user?.id)) return invalidRecipients();
  if (!queryable || typeof queryable.connect !== "function") return bad(500, "TRANSACTION_UNAVAILABLE", "No se pudo iniciar la operación.");
  const client = await queryable.connect();
  let transactionStarted = false;
  try {
    await client.query("BEGIN");
    transactionStarted = true;
    const owned = await resolveOwnedAlbum(req, albumId, client);
    if (!owned.ok) { await client.query("ROLLBACK"); return owned; }
    const { auth } = owned.payload;
    const payload = JSON.stringify(input.recipients);
    const validation = (await client.query(`WITH requested AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(user_id uuid,subject_type text,status text,invitation_id uuid)), checks AS (SELECT r.*, (CASE WHEN r.subject_type='family' THEN EXISTS(SELECT 1 FROM public.family_memberships m JOIN public.auth_users u ON u.id=r.user_id AND u.status IN ('active','pending') WHERE m.family_id=$2::uuid AND m.user_id=r.user_id AND m.status='active') AND r.status='active' AND r.invitation_id IS NULL AND r.user_id<>$3::uuid WHEN r.subject_type='external' THEN EXISTS(SELECT 1 FROM public.auth_users u WHERE u.id=r.user_id AND u.status IN ('active','pending')) AND NOT EXISTS(SELECT 1 FROM public.family_memberships m WHERE m.user_id=r.user_id AND m.family_id=$2::uuid AND m.status='active') AND (r.status='active' AND (r.invitation_id IS NULL OR EXISTS(SELECT 1 FROM public.orange_photo_album_invitations i WHERE i.id=r.invitation_id AND i.album_id=$4::uuid AND i.accepted_by_user_id=r.user_id AND i.status='accepted')) OR r.status='pending' AND EXISTS(SELECT 1 FROM public.orange_photo_album_invitations i JOIN public.auth_users u ON u.id=r.user_id WHERE i.id=r.invitation_id AND i.album_id=$4::uuid AND i.status='pending' AND i.revoked_at IS NULL AND lower(i.invited_email)=lower(u.email))) ELSE false END) valid FROM requested r) SELECT count(*) FILTER (WHERE NOT valid)::int invalid_count FROM checks`, [payload, auth.familyId, auth.userId, albumId])).rows[0];
    if (Number(validation?.invalid_count || 0) > 0) { await client.query("ROLLBACK"); return invalidRecipients(); }
    await client.query(`UPDATE public.orange_photo_albums SET allow_contributions=$2,allow_comments=$3,updated_at=now() WHERE id=$1::uuid`, [albumId, input.allow_contributions, input.allow_comments]);
    await client.query(`INSERT INTO public.orange_photo_album_access (album_id,user_id,subject_type,status,invitation_id,created_by_user_id,accepted_at,revoked_at,created_at,updated_at) SELECT $1::uuid,r.user_id,r.subject_type,r.status,r.invitation_id,$4::uuid,CASE WHEN r.subject_type='family' OR r.status='active' THEN now() ELSE NULL END,NULL,now(),now() FROM jsonb_to_recordset($2::jsonb) AS r(user_id uuid,subject_type text,status text,invitation_id uuid) ON CONFLICT (album_id,user_id) DO UPDATE SET subject_type=EXCLUDED.subject_type,status=EXCLUDED.status,invitation_id=EXCLUDED.invitation_id,created_by_user_id=EXCLUDED.created_by_user_id,accepted_at=COALESCE(public.orange_photo_album_access.accepted_at,EXCLUDED.accepted_at),revoked_at=NULL,updated_at=now()`, [albumId, payload, input.allow_contributions, auth.userId]);
    await client.query(`UPDATE public.orange_photo_album_access SET status='revoked',revoked_at=now(),updated_at=now() WHERE album_id=$1::uuid AND status<>'revoked' AND NOT (user_id=ANY($2::uuid[]))`, [albumId, input.recipients.map((recipient) => recipient.user_id)]);
    await client.query("COMMIT");
    return ok({ album_id: albumId, recipient_count: input.recipients.length, allow_contributions: input.allow_contributions, allow_comments: input.allow_comments });
  } catch (error) {
    if (transactionStarted) await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

module.exports = { isUuid, resolveOwnedAlbum, resolveAlbumAccess, listAlbumRecipients, syncAlbumRecipients };
