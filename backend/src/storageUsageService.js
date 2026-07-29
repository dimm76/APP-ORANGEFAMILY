const pool = require("../db");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ok = (payload = {}) => ({ ok: true, payload });
const bad = (status, reason) => ({ ok: false, status, reason });

function resolveOwner(req) {
  if (!req.user?.id) return bad(401, "No autenticado.");

  const family = Array.isArray(req.user.families)
    ? req.user.families.find((item) => item?.role === "owner")
    : null;

  if (!family?.id || !UUID_RE.test(String(family.id))) {
    return bad(
      403,
      "Solo el administrador puede consultar el almacenamiento."
    );
  }

  return {
    ok: true,
    userId: String(req.user.id),
    familyId: String(family.id),
  };
}

function toBytes(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return Math.round(parsed);
}

function toCount(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) return 0;

  return Math.trunc(parsed);
}

async function getStorageUsage(req) {
  const owner = resolveOwner(req);

  if (!owner.ok) return owner;

  const totalsSql = `
    WITH attachment_totals AS (
      SELECT
        COALESCE(SUM(a.size_bytes), 0)::numeric AS attachments_bytes,
        COUNT(*) FILTER (WHERE a.size_bytes IS NULL)::int AS files_without_size
      FROM public.attachments a
      WHERE a.family_id = $1::uuid
        AND a.status = 'active'
        AND a.deleted_at IS NULL
    ),
    photo_totals AS (
      SELECT
        COALESCE(
          SUM(f.size_bytes) FILTER (WHERE p.media_type = 'image'),
          0
        )::numeric AS images_bytes,
        COALESCE(
          SUM(f.size_bytes) FILTER (WHERE p.media_type = 'video'),
          0
        )::numeric AS videos_bytes,
        COALESCE(
          SUM(f.size_bytes) FILTER (WHERE p.is_trashed = true),
          0
        )::numeric AS trash_bytes,
        COUNT(DISTINCT p.id)
          FILTER (WHERE p.is_trashed = true)::int AS trash_items,
        COUNT(*)
          FILTER (
            WHERE f.id IS NOT NULL
              AND f.size_bytes IS NULL
          )::int AS files_without_size
      FROM public.orange_photos p
      LEFT JOIN public.orange_photo_files f
        ON f.photo_id = p.id
       AND f.family_id = p.family_id
      WHERE p.family_id = $1::uuid
    )
    SELECT
      attachment_totals.attachments_bytes,
      attachment_totals.files_without_size
        AS attachment_files_without_size,
      photo_totals.images_bytes,
      photo_totals.videos_bytes,
      photo_totals.trash_bytes,
      photo_totals.trash_items,
      photo_totals.files_without_size
        AS photo_files_without_size
    FROM attachment_totals
    CROSS JOIN photo_totals
  `;

  const usersSql = `
    WITH family_users AS (
      SELECT
        au.id AS user_id,
        COALESCE(
          NULLIF(BTRIM(p.preferred_name), ''),
          NULLIF(BTRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
          au.email
        ) AS display_name,
        fm.role
      FROM public.family_memberships fm
      JOIN public.persons p
        ON p.id = fm.person_id
      JOIN public.auth_users au
        ON au.person_id = p.id
      WHERE fm.family_id = $1::uuid
    ),
    attachment_usage AS (
      SELECT
        a.created_by AS user_id,
        COALESCE(SUM(a.size_bytes), 0)::numeric AS attachments_bytes
      FROM public.attachments a
      WHERE a.family_id = $1::uuid
        AND a.status = 'active'
        AND a.deleted_at IS NULL
      GROUP BY a.created_by
    ),
    photo_usage AS (
      SELECT
        p.owner_user_id AS user_id,
        COALESCE(
          SUM(f.size_bytes) FILTER (WHERE p.media_type = 'image'),
          0
        )::numeric AS images_bytes,
        COALESCE(
          SUM(f.size_bytes) FILTER (WHERE p.media_type = 'video'),
          0
        )::numeric AS videos_bytes,
        COALESCE(
          SUM(f.size_bytes) FILTER (WHERE p.is_trashed = true),
          0
        )::numeric AS trash_bytes,
        COUNT(DISTINCT p.id)
          FILTER (WHERE p.is_trashed = true)::int AS trash_items
      FROM public.orange_photos p
      LEFT JOIN public.orange_photo_files f
        ON f.photo_id = p.id
       AND f.family_id = p.family_id
      WHERE p.family_id = $1::uuid
      GROUP BY p.owner_user_id
    )
    SELECT
      family_users.user_id,
      family_users.display_name,
      family_users.role,
      COALESCE(
        attachment_usage.attachments_bytes,
        0
      )::numeric AS attachments_bytes,
      COALESCE(
        photo_usage.images_bytes,
        0
      )::numeric AS images_bytes,
      COALESCE(
        photo_usage.videos_bytes,
        0
      )::numeric AS videos_bytes,
      COALESCE(
        photo_usage.trash_bytes,
        0
      )::numeric AS trash_bytes,
      COALESCE(
        photo_usage.trash_items,
        0
      )::int AS trash_items
    FROM family_users
    LEFT JOIN attachment_usage
      ON attachment_usage.user_id = family_users.user_id
    LEFT JOIN photo_usage
      ON photo_usage.user_id = family_users.user_id
    ORDER BY
      (family_users.role = 'owner') DESC,
      LOWER(family_users.display_name)
  `;

  const [totalsResult, usersResult] = await Promise.all([
    pool.query(totalsSql, [owner.familyId]),
    pool.query(usersSql, [owner.familyId]),
  ]);

  const totalsRow = totalsResult.rows[0] || {};

  const attachmentsBytes = toBytes(totalsRow.attachments_bytes);
  const imagesBytes = toBytes(totalsRow.images_bytes);
  const videosBytes = toBytes(totalsRow.videos_bytes);

  const users = usersResult.rows.map((row) => {
    const userAttachmentsBytes = toBytes(row.attachments_bytes);
    const userImagesBytes = toBytes(row.images_bytes);
    const userVideosBytes = toBytes(row.videos_bytes);

    return {
      user_id: String(row.user_id),
      display_name: row.display_name || "Sin nombre",
      role: row.role,
      attachments_bytes: userAttachmentsBytes,
      images_bytes: userImagesBytes,
      videos_bytes: userVideosBytes,
      total_bytes:
        userAttachmentsBytes + userImagesBytes + userVideosBytes,
      trash_bytes: toBytes(row.trash_bytes),
      trash_items: toCount(row.trash_items),
    };
  });

  return ok({
    totals: {
      attachments_bytes: attachmentsBytes,
      images_bytes: imagesBytes,
      videos_bytes: videosBytes,
      total_bytes: attachmentsBytes + imagesBytes + videosBytes,
      trash_bytes: toBytes(totalsRow.trash_bytes),
      trash_items: toCount(totalsRow.trash_items),
    },
    users,
    integrity: {
      files_without_size:
        toCount(totalsRow.attachment_files_without_size) +
        toCount(totalsRow.photo_files_without_size),
    },
  });
}

module.exports = {
  getStorageUsage,
};
