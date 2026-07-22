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
 * Figma puede generar embeds como:
 * https://www.figma.com/embed?embed_host=share&url=...
 *
 * @param {string|null|undefined} src
 */
export function isAllowedFigmaEmbedSrc(src) {
  const value = String(src ?? "").trim();
  if (!value || hasDangerousUrlScheme(value)) return false;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname.toLowerCase() !== "www.figma.com") return false;
    if (url.pathname !== "/embed") return false;

    const embeddedUrl = url.searchParams.get("url");
    if (!embeddedUrl) return false;

    return parseFigmaUrl(embeddedUrl).ok;
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 * @returns {{ ok: true, url: string } | { ok: false, reason: string }}
 */
export function parseFigmaUrl(raw) {
  const input = String(raw ?? "").trim();

  if (!input) {
    return { ok: false, reason: "Introduce una URL de Figma." };
  }

  if (/[<>"']/.test(input) || /\biframe\b/i.test(input)) {
    return {
      ok: false,
      reason: "No se permiten iframes ni HTML. Usa una URL de Figma.",
    };
  }

  if (hasDangerousUrlScheme(input)) {
    return { ok: false, reason: "URL no permitida." };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "La URL no es valida." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "Solo se permiten enlaces https." };
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== "figma.com" && hostname !== "www.figma.com") {
    return {
      ok: false,
      reason: "Solo se permiten URLs de figma.com.",
    };
  }

  const allowedPath =
    /^\/(file|design|proto|board|slides)\//i.test(url.pathname) ||
    /^\/community\/file\//i.test(url.pathname);

  if (!allowedPath) {
    return {
      ok: false,
      reason:
        "La URL no parece ser un archivo, diseno, prototipo, FigJam o recurso valido de Figma.",
    };
  }

  const normalized = new URL(url.toString());
  normalized.hostname = "www.figma.com";
  normalized.protocol = "https:";

  return { ok: true, url: normalized.toString() };
}

/**
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function figmaEmbedSrcFromUrl(url) {
  const result = parseFigmaUrl(String(url ?? ""));
  if (!result.ok) return null;

  const src = `https://www.figma.com/embed?embed_host=orangedesk&url=${encodeURIComponent(
    result.url
  )}`;

  return isAllowedFigmaEmbedSrc(src) ? src : null;
}

/**
 * @param {unknown} raw
 * @param {number} [fallback]
 */
export function clampFigmaEmbedHeight(raw, fallback = 640) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(3000, Math.max(240, Math.floor(n)));
}

/**
 * @param {unknown} raw
 */
export function sanitizeFigmaWidthMode(raw) {
  const value = String(raw ?? "").trim();
  return WIDTH_MODES.has(value) ? value : "normal";
}

/**
 * @param {{ widthMode?: unknown }} attrs
 */
export function resolveFigmaModes(attrs = {}) {
  return {
    widthMode: sanitizeFigmaWidthMode(attrs.widthMode),
  };
}

/**
 * @param {"normal"|"full"} widthMode
 */
export function buildFigmaEmbedClassName(widthMode) {
  return ["od-figma-embed", `od-figma-embed--width-${widthMode}`].join(" ");
}
