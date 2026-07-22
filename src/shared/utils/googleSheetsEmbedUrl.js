const LEGACY_VISUAL_STYLES = new Set(["normal", "clean", "full-screen"]);

/**
 * Google puede restringir /edit dentro de iframe según permisos de la hoja.
 * El modo "normal" usa /edit como la variante más completa permitida por Google.
 */
const VIEW_MODES = new Set(["normal", "clean"]);
const WIDTH_MODES = new Set(["normal", "full"]);

/**
 * @param {string} raw
 * @returns {boolean}
 */
function hasDangerousUrlScheme(raw) {
  const probe = String(raw ?? "")
    .trim()
    .slice(0, 24)
    .toLowerCase();
  return (
    probe.startsWith("javascript:") ||
    probe.startsWith("data:") ||
    probe.startsWith("vbscript:")
  );
}

/**
 * @param {string|null|undefined} src
 */
export function isAllowedGoogleSheetsEmbedSrc(src) {
  const value = String(src ?? "").trim();
  if (!value || hasDangerousUrlScheme(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.hostname.toLowerCase() !== "docs.google.com") return false;
    if (!url.pathname.startsWith("/spreadsheets/")) return false;
    if (/\/preview\b/i.test(url.pathname)) return true;
    if (/\/pubhtml\b/i.test(url.pathname)) return true;
    if (/\/edit\b/i.test(url.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 * @returns {{ ok: true, url: string, sheetId: string|null, publishId: string|null, gid: string|null } | { ok: false, reason: string }}
 */
export function parseGoogleSheetsUrl(raw) {
  const input = String(raw ?? "").trim();
  if (!input) {
    return { ok: false, reason: "Introduce una URL de Google Sheets." };
  }
  if (/[<>"']/.test(input) || /\biframe\b/i.test(input)) {
    return {
      ok: false,
      reason: "No se permiten iframes ni HTML. Usa una URL de Google Sheets.",
    };
  }
  if (hasDangerousUrlScheme(input)) {
    return { ok: false, reason: "URL no permitida." };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "La URL no es válida." };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, reason: "Solo se permiten enlaces http(s)." };
  }

  if (url.hostname.toLowerCase() !== "docs.google.com") {
    return {
      ok: false,
      reason: "Solo se permiten URLs de docs.google.com/spreadsheets.",
    };
  }

  if (!url.pathname.startsWith("/spreadsheets/")) {
    return {
      ok: false,
      reason: "Solo se permiten URLs de docs.google.com/spreadsheets.",
    };
  }

  const publishMatch = url.pathname.match(/^\/spreadsheets\/d\/e\/([^/]+)\/pubhtml/i);
  if (publishMatch) {
    const publishId = publishMatch[1];
    return {
      ok: true,
      url: `https://docs.google.com/spreadsheets/d/e/${publishId}/pubhtml`,
      sheetId: null,
      publishId,
      gid: null,
    };
  }

  const idMatch = url.pathname.match(/^\/spreadsheets\/d\/([^/]+)/i);
  if (!idMatch?.[1] || idMatch[1] === "e") {
    return {
      ok: false,
      reason: "No se pudo extraer el ID de la hoja de cálculo.",
    };
  }

  const sheetId = idMatch[1];
  const gidFromHash = url.hash.match(/gid=(\d+)/i)?.[1];
  const gid = gidFromHash || url.searchParams.get("gid");
  const safeGid = gid && /^\d+$/.test(String(gid)) ? String(gid) : null;

  const normalizedUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit${
    safeGid ? `#gid=${safeGid}` : ""
  }`;

  return { ok: true, url: normalizedUrl, sheetId, publishId: null, gid: safeGid };
}

/**
 * @param {{ sheetId: string|null, publishId: string|null, gid: string|null }} parsed
 * @param {"normal"|"clean"} viewMode
 * @returns {string|null}
 */
export function buildGoogleSheetsEmbedSrc(parsed, viewMode = "clean") {
  const mode = viewMode === "normal" ? "normal" : "clean";

  if (parsed.publishId) {
    const headers = mode === "normal" ? "true" : "false";
    return `https://docs.google.com/spreadsheets/d/e/${parsed.publishId}/pubhtml?widget=true&headers=${headers}`;
  }

  if (!parsed.sheetId) return null;

  if (mode === "normal") {
    return `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/edit${
      parsed.gid ? `#gid=${parsed.gid}` : ""
    }`;
  }

  return `https://docs.google.com/spreadsheets/d/${parsed.sheetId}/preview${
    parsed.gid ? `?gid=${parsed.gid}` : ""
  }`;
}

/**
 * @param {string|null|undefined} url
 * @param {"normal"|"clean"} [viewMode]
 * @returns {string|null}
 */
export function googleSheetsEmbedSrcFromUrl(url, viewMode = "clean") {
  const result = parseGoogleSheetsUrl(String(url ?? ""));
  if (!result.ok) return null;
  const src = buildGoogleSheetsEmbedSrc(result, viewMode);
  return src && isAllowedGoogleSheetsEmbedSrc(src) ? src : null;
}

/**
 * @param {unknown} raw
 * @param {number} [fallback]
 */
export function clampGoogleSheetsEmbedHeight(raw, fallback = 600) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(3000, Math.max(200, Math.floor(n)));
}

/**
 * @param {unknown} raw
 */
export function sanitizeGoogleSheetsViewMode(raw) {
  const value = String(raw ?? "").trim();
  return VIEW_MODES.has(value) ? value : "normal";
}

/**
 * @param {unknown} raw
 */
export function sanitizeGoogleSheetsWidthMode(raw) {
  const value = String(raw ?? "").trim();
  return WIDTH_MODES.has(value) ? value : "normal";
}

/** @deprecated Conservado para lectura retrocompatible. */
export function sanitizeGoogleSheetsVisualStyle(raw) {
  const value = String(raw ?? "").trim();
  return LEGACY_VISUAL_STYLES.has(value) ? value : "normal";
}

/**
 * Resuelve viewMode y widthMode desde atributos nuevos o legacy visualStyle.
 * @param {{ viewMode?: unknown, widthMode?: unknown, visualStyle?: unknown }} attrs
 */
export function resolveGoogleSheetsModes(attrs = {}) {
  const rawView = attrs.viewMode;
  const rawWidth = attrs.widthMode;
  const hasExplicitView = rawView != null && String(rawView).trim() !== "";
  const hasExplicitWidth = rawWidth != null && String(rawWidth).trim() !== "";

  if (hasExplicitView || hasExplicitWidth) {
    return {
      viewMode: sanitizeGoogleSheetsViewMode(rawView),
      widthMode: sanitizeGoogleSheetsWidthMode(rawWidth),
    };
  }

  const legacy = sanitizeGoogleSheetsVisualStyle(attrs.visualStyle);
  if (legacy === "clean") return { viewMode: "clean", widthMode: "normal" };
  if (legacy === "full-screen") return { viewMode: "clean", widthMode: "full" };
  return { viewMode: "normal", widthMode: "normal" };
}

/**
 * @param {"normal"|"clean"} viewMode
 * @param {"normal"|"full"} widthMode
 */
export function legacyVisualStyleFromModes(viewMode, widthMode) {
  if (widthMode === "full") return "full-screen";
  if (viewMode === "clean") return "clean";
  return "normal";
}

/**
 * @param {"normal"|"clean"} viewMode
 * @param {"normal"|"full"} widthMode
 */
export function buildGoogleSheetsEmbedClassName(viewMode, widthMode) {
  const parts = [
    "od-gsheets-embed",
    `od-gsheets-embed--view-${viewMode}`,
    `od-gsheets-embed--width-${widthMode}`,
    `od-gsheets-embed--${legacyVisualStyleFromModes(viewMode, widthMode)}`,
  ];
  return parts.join(" ");
}
