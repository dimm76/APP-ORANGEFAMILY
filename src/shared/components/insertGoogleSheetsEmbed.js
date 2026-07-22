import { parseGoogleSheetsUrl } from "../utils/googleSheetsEmbedUrl.js";

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @param {{ url: string, height?: number, visualStyle?: string, showToolbar?: boolean }} payload
 * @returns {boolean}
 */
function insertGoogleSheetsEmbed(editor, payload) {
  if (!editor || typeof editor.commands.setGoogleSheetsEmbed !== "function") return false;
  const ok = editor
    .chain()
    .focus()
    .setGoogleSheetsEmbed({
      url: payload.url,
      height: payload.height,
      visualStyle: payload.visualStyle,
      showToolbar: payload.showToolbar,
    })
    .run();
  if (!ok) {
    window.alert("No se pudo insertar Google Sheets. Comprueba la URL.");
  }
  return ok;
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {boolean}
 */
export function promptAndInsertGoogleSheetsEmbed(editor) {
  const raw = window.prompt("URL de Google Sheets", "");
  if (raw === null) return false;

  const trimmed = String(raw).trim();
  if (!trimmed) return false;

  const result = parseGoogleSheetsUrl(trimmed);
  if (!result.ok) {
    window.alert(result.reason || "URL de Google Sheets no válida.");
    return false;
  }

  return insertGoogleSheetsEmbed(editor, { url: result.url });
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {string|null}
 */
export function promptGoogleSheetsUrl(editor) {
  const current = String(editor?.getAttributes("googleSheetsEmbed")?.url ?? "").trim();
  const raw = window.prompt("URL de Google Sheets", current);
  if (raw === null) return null;

  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  const result = parseGoogleSheetsUrl(trimmed);
  if (!result.ok) {
    window.alert(result.reason || "URL de Google Sheets no válida.");
    return null;
  }

  return result.url;
}
