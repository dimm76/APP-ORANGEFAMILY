import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import { getSelectedOdRichColumnContext, moveSelectedOdRichColumn } from "../utils/odColumnSelection.js";
import { isRichTextNodeSelection } from "../utils/richTextNodeSelection.js";

export default function RichTextOdColumnBubbleMenu({ editor }) {
  const columnState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const context = getSelectedOdRichColumnContext(currentEditor);
      return context ? { index: context.index, count: context.count } : null;
    },
  });
  if (!editor || !editor.isEditable) return null;
  const canMoveLeft = Boolean(columnState) && columnState.index > 0;
  const canMoveRight = Boolean(columnState) && columnState.index < columnState.count - 1;
  return (
    <BubbleMenu editor={editor} pluginKey="odRichColumnBubbleMenu" shouldShow={({ editor: currentEditor, state }) => currentEditor.isEditable && isRichTextNodeSelection(state, "odRichColumn")} tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }} className="od-rich-text-editor__toolbar-popover">
      <div className="od-rich-text-editor__toolbar">
        <button type="button" className="od-rich-text-editor__button" title="Mover columna a la izquierda" disabled={!canMoveLeft} onMouseDown={(event) => event.preventDefault()} onClick={() => moveSelectedOdRichColumn(editor, "left")}>← Izquierda</button>
        <button type="button" className="od-rich-text-editor__button" title="Mover columna a la derecha" disabled={!canMoveRight} onMouseDown={(event) => event.preventDefault()} onClick={() => moveSelectedOdRichColumn(editor, "right")}>Derecha →</button>
      </div>
    </BubbleMenu>
  );
}
