import { validateAndNormalizeYoutubeUrl } from "../utils/youtubeEmbedUrl.js";

/**
 * Pide URL de YouTube al usuario e inserta el bloque en el editor.
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {boolean}
 */
export function promptAndInsertYoutubeVideo(editor) {
  if (!editor || typeof editor.commands.setYoutubeVideo !== "function") return false;

  const raw = window.prompt("URL de YouTube", "");
  if (raw === null) return false;

  const result = validateAndNormalizeYoutubeUrl(raw);
  if (!result.ok) {
    window.alert(result.reason || "URL de YouTube no válida.");
    return false;
  }

  const ok = editor.chain().focus().setYoutubeVideo({ src: result.src }).run();
  if (!ok) {
    window.alert("No se pudo insertar el vídeo. Comprueba la URL.");
  }
  return ok;
}
