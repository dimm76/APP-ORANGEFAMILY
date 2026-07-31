import { NodeSelection } from "@tiptap/pm/state";
import { getRichTextNodeSelectionContext } from "./richTextNodeSelection.js";

export function getSelectedOdRichColumnContext(editor) {
  if (!editor) return null;
  const selectionContext = getRichTextNodeSelectionContext(editor.state, "odRichColumn");
  if (!selectionContext) return null;
  const $position = editor.state.doc.resolve(selectionContext.pos);
  const parent = $position.parent;
  if (parent.type.name !== "odRichColumns") return null;
  return { ...selectionContext, parent, parentPos: $position.before($position.depth), index: $position.index(), count: parent.childCount };
}

export function moveSelectedOdRichColumn(editor, direction) {
  const context = getSelectedOdRichColumnContext(editor);
  if (!editor || !context) return false;
  const targetIndex = context.index + (direction === "left" ? -1 : 1);
  if (targetIndex < 0 || targetIndex >= context.count) return false;
  const children = [];
  context.parent.forEach((child) => children.push(child));
  const [movedColumn] = children.splice(context.index, 1);
  children.splice(targetIndex, 0, movedColumn);
  const nextParent = context.parent.type.create(context.parent.attrs, children, context.parent.marks);
  let transaction = editor.state.tr.replaceWith(context.parentPos, context.parentPos + context.parent.nodeSize, nextParent);
  let selectedColumnPos = context.parentPos + 1;
  for (let index = 0; index < targetIndex; index += 1) selectedColumnPos += children[index].nodeSize;
  transaction = transaction.setSelection(NodeSelection.create(transaction.doc, selectedColumnPos));
  editor.view.dispatch(transaction.scrollIntoView());
  editor.view.focus();
  return true;
}
