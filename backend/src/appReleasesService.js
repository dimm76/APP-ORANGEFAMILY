const pool = require("../db");

const ok = (payload = {}) => ({ ok: true, payload });
const bad = (status, reason) => ({ ok: false, status, reason });

function resolveAuthenticated(req) {
  if (!req.user?.id) {
    return bad(401, "No autenticado.");
  }

  return {
    ok: true,
    userId: String(req.user.id),
  };
}

function resolveOwner(req) {
  const authenticated = resolveAuthenticated(req);
  if (!authenticated.ok) return authenticated;

  const family = Array.isArray(req.user.families)
    ? req.user.families.find((item) => item?.role === "owner")
    : null;

  if (!family?.id) {
    return bad(
      403,
      "Solo el administrador puede actualizar la aplicación."
    );
  }

  return {
    ok: true,
    userId: authenticated.userId,
    familyId: String(family.id),
  };
}

function publicRelease(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    platform: row.platform,
    version_code: Number(row.version_code),
    version_name: row.version_name,
    file_name: row.file_name,
    download_url: row.download_url,
    release_notes: row.release_notes || null,
    published_at: row.published_at,
    updated_at: row.updated_at,
  };
}

function normalizeInput(body) {
  const value =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const allowed = new Set([
    "version_code",
    "version_name",
    "file_name",
    "download_url",
    "release_notes",
  ]);

  if (Object.keys(value).some((key) => !allowed.has(key))) {
    return bad(400, "La publicación contiene campos no permitidos.");
  }

  const versionCode = Number(value.version_code);

  if (
    !Number.isInteger(versionCode) ||
    versionCode < 1 ||
    versionCode > 2147483647
  ) {
    return bad(400, "El versionCode debe ser un entero positivo.");
  }

  const versionName = String(value.version_name || "").trim();

  if (!versionName || versionName.length > 50) {
    return bad(
      400,
      "El nombre de versión es obligatorio y no puede superar 50 caracteres."
    );
  }

  const fileName = String(value.file_name || "").trim();

  if (
    fileName.length < 5 ||
    fileName.length > 255 ||
    !fileName.toLowerCase().endsWith(".apk") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    return bad(400, "El nombre del archivo APK no es válido.");
  }

  const rawDownloadUrl = String(value.download_url || "").trim();
  let parsedUrl;

  try {
    parsedUrl = new URL(rawDownloadUrl);
  } catch {
    return bad(400, "La URL de descarga no es válida.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    rawDownloadUrl.length > 2048
  ) {
    return bad(400, "La URL de descarga debe ser una URL HTTPS válida.");
  }

  const releaseNotes =
    value.release_notes == null
      ? null
      : String(value.release_notes).trim() || null;

  if (releaseNotes && releaseNotes.length > 5000) {
    return bad(
      400,
      "Las notas de la versión no pueden superar 5000 caracteres."
    );
  }

  return {
    ok: true,
    value: {
      versionCode,
      versionName,
      fileName,
      downloadUrl: parsedUrl.toString(),
      releaseNotes,
    },
  };
}

async function getLatestAndroidRelease(req) {
  const authenticated = resolveAuthenticated(req);
  if (!authenticated.ok) return authenticated;

  const result = await pool.query(
    `
      SELECT
        id,
        platform,
        version_code,
        version_name,
        file_name,
        download_url,
        release_notes,
        published_at,
        updated_at
      FROM public.application_releases
      WHERE platform = 'android'
      LIMIT 1
    `
  );

  return ok({
    release: publicRelease(result.rows[0] || null),
  });
}

async function updateLatestAndroidRelease(req, body) {
  const owner = resolveOwner(req);
  if (!owner.ok) return owner;

  const input = normalizeInput(body);
  if (!input.ok) return input;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const beforeResult = await client.query(
      `
        SELECT
          id,
          platform,
          version_code,
          version_name,
          file_name,
          download_url,
          release_notes,
          published_at,
          updated_at
        FROM public.application_releases
        WHERE platform = 'android'
        FOR UPDATE
      `
    );

    const before = beforeResult.rows[0] || null;

    if (
      before &&
      input.value.versionCode < Number(before.version_code)
    ) {
      await client.query("ROLLBACK");

      return bad(
        409,
        "El versionCode no puede ser inferior al publicado actualmente."
      );
    }

    const releaseResult = await client.query(
      `
        INSERT INTO public.application_releases
        (
          platform,
          version_code,
          version_name,
          file_name,
          download_url,
          release_notes,
          published_at,
          updated_by
        )
        VALUES
        (
          'android',
          $1,
          $2,
          $3,
          $4,
          $5,
          now(),
          $6::uuid
        )
        ON CONFLICT (platform)
        DO UPDATE SET
          version_code = EXCLUDED.version_code,
          version_name = EXCLUDED.version_name,
          file_name = EXCLUDED.file_name,
          download_url = EXCLUDED.download_url,
          release_notes = EXCLUDED.release_notes,
          published_at = now(),
          updated_by = EXCLUDED.updated_by
        RETURNING
          id,
          platform,
          version_code,
          version_name,
          file_name,
          download_url,
          release_notes,
          published_at,
          updated_at
      `,
      [
        input.value.versionCode,
        input.value.versionName,
        input.value.fileName,
        input.value.downloadUrl,
        input.value.releaseNotes,
        owner.userId,
      ]
    );

    const release = releaseResult.rows[0];

    await client.query(
      `
        INSERT INTO public.audit_logs
        (
          user_id,
          action,
          entity_type,
          entity_id,
          before_data,
          after_data
        )
        VALUES
        (
          $1::uuid,
          'application_release_updated',
          'application_release',
          $2::uuid,
          $3::jsonb,
          $4::jsonb
        )
      `,
      [
        owner.userId,
        release.id,
        before ? JSON.stringify(publicRelease(before)) : null,
        JSON.stringify(publicRelease(release)),
      ]
    );

    await client.query("COMMIT");

    return ok({
      release: publicRelease(release),
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getLatestAndroidRelease,
  updateLatestAndroidRelease,
};
