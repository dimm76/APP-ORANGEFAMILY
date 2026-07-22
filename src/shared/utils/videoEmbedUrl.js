const GOOGLE_DRIVE_HOSTS = new Set(["drive.google.com", "www.drive.google.com"]);
const VENTO_HOSTS = new Set(["vento.so", "www.vento.so"]);

const GOOGLE_DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,}$/;
const VENTO_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {string} input
 * @returns {string|null}
 */
function rejectUnsafeVideoInput(input) {
  const value = String(input ?? "").trim();
  if (!value) return "Introduce una URL.";
  if (/[<>"']/.test(value) || /\b(iframe|script)\b/i.test(value)) {
    return "No se permiten HTML ni iframes. Usa la URL compartida.";
  }
  if (/javascript:/i.test(value)) {
    return "URL no permitida.";
  }
  return null;
}

/**
 * @param {string} raw
 * @returns {{ ok: true, src: string, fileId: string, provider: "google_drive", originalUrl: string, aspectRatio: "16/9" } | { ok: false, reason: string }}
 */
export function parseGoogleDriveVideoUrl(raw) {
  const unsafe = rejectUnsafeVideoInput(raw);
  if (unsafe) return { ok: false, reason: unsafe };

  const input = String(raw ?? "").trim();
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "La URL no es válida." };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, reason: "Solo se permiten enlaces http(s) de Google Drive." };
  }

  const host = url.hostname.toLowerCase();
  if (!GOOGLE_DRIVE_HOSTS.has(host)) {
    return { ok: false, reason: "Solo se permiten enlaces de drive.google.com." };
  }

  const match = url.pathname.match(/^\/file\/d\/([^/]+)\/(view|preview)(?:\/|$)/i);
  const fileId = match?.[1] ?? "";
  if (!GOOGLE_DRIVE_FILE_ID_RE.test(fileId)) {
    return {
      ok: false,
      reason: "Formato no reconocido. Usa una URL tipo drive.google.com/file/d/ID/view.",
    };
  }

  const src = `https://drive.google.com/file/d/${fileId}/preview`;
  return {
    ok: true,
    src,
    fileId,
    provider: "google_drive",
    originalUrl: input,
    aspectRatio: "16/9",
  };
}

/**
 * @param {string} raw
 * @returns {{ ok: true, src: string, videoId: string, provider: "vento", originalUrl: string, aspectRatio: "16/9" } | { ok: false, reason: string }}
 */
export function parseVentoVideoUrl(raw) {
  const unsafe = rejectUnsafeVideoInput(raw);
  if (unsafe) return { ok: false, reason: unsafe };

  const input = String(raw ?? "").trim();
  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "La URL no es válida." };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, reason: "Solo se permiten enlaces http(s) de Vento." };
  }

  const host = url.hostname.toLowerCase();
  if (!VENTO_HOSTS.has(host)) {
    return { ok: false, reason: "Solo se permiten enlaces de vento.so." };
  }

  const match = url.pathname.match(/^\/view\/([^/]+)(?:\/embed)?\/?$/i);
  const videoId = match?.[1] ?? "";
  if (!VENTO_UUID_RE.test(videoId)) {
    return {
      ok: false,
      reason: "Formato no reconocido. Usa una URL tipo vento.so/view/UUID.",
    };
  }

  const src = `https://vento.so/view/${videoId}/embed`;
  return {
    ok: true,
    src,
    videoId,
    provider: "vento",
    originalUrl: input,
    aspectRatio: "16/9",
  };
}

/**
 * @param {string|null|undefined} src
 * @param {"google_drive"|"vento"|string|null|undefined} [provider]
 */
export function isAllowedExternalVideoEmbedSrc(src, provider) {
  const value = String(src ?? "").trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const proto = url.protocol.toLowerCase();
    if (proto !== "https:" && proto !== "http:") return false;

    const isDrive =
      GOOGLE_DRIVE_HOSTS.has(host) &&
      /^\/file\/d\/[a-zA-Z0-9_-]{10,}\/preview\/?$/i.test(url.pathname);
    const isVento =
      VENTO_HOSTS.has(host) &&
      /^\/view\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/embed\/?$/i.test(
        url.pathname
      );

    if (provider === "google_drive") return isDrive;
    if (provider === "vento") return isVento;
    return isDrive || isVento;
  } catch {
    return false;
  }
}
