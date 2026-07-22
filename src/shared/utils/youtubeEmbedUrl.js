const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

const YOUTUBE_VIDEO_ID_RE = /^[\w-]{11}$/;

/**
 * @param {string} raw
 * @returns {{ ok: true, src: string, videoId: string, provider: "youtube" } | { ok: false, reason: string }}
 */
export function validateAndNormalizeYoutubeUrl(raw) {
  const input = String(raw ?? "").trim();
  if (!input) {
    return { ok: false, reason: "Introduce una URL de YouTube." };
  }
  if (/[<>"']/.test(input) || /\biframe\b/i.test(input)) {
    return { ok: false, reason: "No se permiten iframes ni HTML. Usa una URL de YouTube." };
  }

  let url;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "La URL no es válida." };
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, reason: "Solo se permiten enlaces http(s) de YouTube." };
  }

  const host = url.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: "Solo se permiten enlaces de youtube.com o youtu.be." };
  }

  let videoId = "";
  if (host === "youtu.be" || host === "www.youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (url.pathname === "/watch") {
    videoId = String(url.searchParams.get("v") ?? "").trim();
  } else if (url.pathname.startsWith("/embed/")) {
    videoId = url.pathname.split("/").filter(Boolean)[1] ?? "";
  } else {
    return {
      ok: false,
      reason: "Formato no reconocido. Usa watch?v=, youtu.be/ o youtube.com/embed/.",
    };
  }

  if (!YOUTUBE_VIDEO_ID_RE.test(videoId)) {
    return { ok: false, reason: "No se pudo extraer un ID de vídeo de YouTube válido." };
  }

  return {
    ok: true,
    src: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    provider: "youtube",
  };
}

/**
 * @param {string|null|undefined} src
 */
export function isAllowedYoutubeEmbedSrc(src) {
  const value = String(src ?? "").trim();
  if (!value) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const embedHost =
      host === "www.youtube.com" ||
      host === "youtube.com" ||
      host === "www.youtube-nocookie.com" ||
      host === "youtube-nocookie.com";
    return embedHost && url.pathname.startsWith("/embed/");
  } catch {
    return false;
  }
}
