import { parseFigmaUrl } from "../utils/figmaEmbedUrl.js";

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @param {{ url: string, height?: number, widthMode?: string, showToolbar?: boolean }} payload
 * @returns {boolean}
 */
function insertFigmaEmbed(editor, payload) {
  if (!editor || typeof editor.commands.setFigmaEmbed !== "function") return false;

  const ok = editor
    .chain()
    .focus()
    .setFigmaEmbed({
      url: payload.url,
      height: payload.height,
      widthMode: payload.widthMode,
      showToolbar: payload.showToolbar,
    })
    .run();

  if (!ok) {
    window.alert("No se pudo insertar Figma. Comprueba la URL.");
  }

  return ok;
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {boolean}
 */
export function promptAndInsertFigmaEmbed(editor) {
  const raw = window.prompt("URL de Figma", "");
  if (raw === null) return false;

  const trimmed = String(raw).trim();
  if (!trimmed) return false;

  const result = parseFigmaUrl(trimmed);
  if (!result.ok) {
    window.alert(result.reason || "URL de Figma no valida.");
    return false;
  }

  return insertFigmaEmbed(editor, { url: result.url });
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 * @returns {string|null}
 */
export function promptFigmaUrl(editor) {
  const current = String(editor?.getAttributes("figmaEmbed")?.url ?? "").trim();
  const raw = window.prompt("URL de Figma", current);
  if (raw === null) return null;

  const trimmed = String(raw).trim();
  if (!trimmed) return "";

  const result = parseFigmaUrl(trimmed);
  if (!result.ok) {
    window.alert(result.reason || "URL de Figma no valida.");
    return null;
  }

  return result.url;
}
