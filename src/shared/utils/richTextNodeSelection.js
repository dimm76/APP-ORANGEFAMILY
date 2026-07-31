import { NodeSelection } from "@tiptap/pm/state";

export function getRichTextNodeSelectionContext(state, nodeName) {
  const selection = state?.selection;
  if (!(selection instanceof NodeSelection)) return null;
  const node = selection.node;
  if (!node || node.type.name !== nodeName) return null;
  return { node, pos: selection.from, attrs: node.attrs };
}

export function isRichTextNodeSelection(state, nodeName) {
  return Boolean(getRichTextNodeSelectionContext(state, nodeName));
}
