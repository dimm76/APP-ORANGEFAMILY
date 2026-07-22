import { parseGoogleDriveVideoUrl, parseVentoVideoUrl } from "../utils/videoEmbedUrl.js";

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @param {{ provider: string, src: string, originalUrl: string, aspectRatio?: string }} payload
 * @returns {boolean}
 */
function insertVideoEmbed(editor, payload) {
  if (!editor || typeof editor.commands.setVideoEmbed !== "function") return false;
  const ok = editor
    .chain()
    .focus()
    .setVideoEmbed({
      provider: payload.provider,
      src: payload.src,
      originalUrl: payload.originalUrl,
      aspectRatio: payload.aspectRatio ?? "16/9",
    })
    .run();
  if (!ok) {
    window.alert("No se pudo insertar el vídeo. Comprueba la URL.");
  }
  return ok;
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {boolean}
 */
export function promptAndInsertGoogleDriveVideo(editor) {
  const raw = window.prompt("URL de Google Drive", "");
  if (raw === null) return false;

  const result = parseGoogleDriveVideoUrl(raw);
  if (!result.ok) {
    window.alert(result.reason || "URL de Google Drive no válida.");
    return false;
  }

  return insertVideoEmbed(editor, result);
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {boolean}
 */
export function promptAndInsertVentoVideo(editor) {
  const raw = window.prompt("URL de Vento", "");
  if (raw === null) return false;

  const result = parseVentoVideoUrl(raw);
  if (!result.ok) {
    window.alert(result.reason || "URL de Vento no válida.");
    return false;
  }

  return insertVideoEmbed(editor, result);
}
