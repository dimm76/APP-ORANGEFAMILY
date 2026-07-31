import { NodeSelection } from "@tiptap/pm/state";

/**
 * Devuelve el nodo seleccionado únicamente cuando existe una NodeSelection
 * exacta del tipo solicitado.
 *
 * @param {import("@tiptap/pm/state").EditorState|null|undefined} state
 * @param {string} nodeName
 */
export function getRichTextNodeSelectionContext(state, nodeName) {
  const selection = state?.selection;

  if (!(selection instanceof NodeSelection)) {
    return null;
  }

  const node = selection.node;

  if (!node || node.type.name !== nodeName) {
    return null;
  }

  return {
    node,
    pos: selection.from,
    attrs: node.attrs,
  };
}

/**
 * @param {import("@tiptap/pm/state").EditorState|null|undefined} state
 * @param {string} nodeName
 */
export function isRichTextNodeSelection(state, nodeName) {
  return Boolean(getRichTextNodeSelectionContext(state, nodeName));
}

/**
 * Selecciona exactamente el nodo asociado a un React NodeView.
 *
 * @param {import("@tiptap/core").Editor|null|undefined} editor
 * @param {(() => number)|undefined} getPos
 * @param {string} nodeName
 */
export function selectRichTextNode(editor, getPos, nodeName) {
  if (!editor?.isEditable || typeof getPos !== "function") {
    return false;
  }

  let position;

  try {
    position = getPos();
  } catch {
    return false;
  }

  if (!Number.isInteger(position)) {
    return false;
  }

  const node = editor.state.doc.nodeAt(position);

  if (
    !node ||
    node.type.name !== nodeName ||
    !NodeSelection.isSelectable(node)
  ) {
    return false;
  }

  return editor
    .chain()
    .focus()
    .setNodeSelection(position)
    .run();
}
