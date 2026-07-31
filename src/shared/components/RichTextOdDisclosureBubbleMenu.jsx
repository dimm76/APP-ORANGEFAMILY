import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import { getRichTextNodeSelectionContext, isRichTextNodeSelection } from "../utils/richTextNodeSelection.js";

export default function RichTextOdDisclosureBubbleMenu({ editor }) {
  const disclosure = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const context = currentEditor
        ? getRichTextNodeSelectionContext(currentEditor.state, "odDisclosure")
        : null;
      return context
        ? {
            open: Boolean(context.node.attrs.open),
            titleLevel:
              context.node.attrs.titleLevel === "paragraph"
                ? "paragraph"
                : Number(context.node.attrs.titleLevel),
          }
        : null;
    },
  });

  if (!editor || !editor.isEditable) return null;

  function updateDisclosure(patch) {
    const context = getRichTextNodeSelectionContext(editor.state, "odDisclosure");
    if (!context) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setNodeMarkup(context.pos, undefined, {
          ...context.node.attrs,
          ...patch,
        });
        return true;
      })
      .run();
  }

  function deleteDisclosure() {
    if (!window.confirm("¿Eliminar este bloque desplegable completo?")) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const context = getRichTextNodeSelectionContext(editor.state, "odDisclosure");
        if (!context) return false;
        tr.delete(context.pos, context.pos + context.node.nodeSize);
        return true;
      })
      .run();
  }

  const titleLevel =
    disclosure?.titleLevel === "paragraph" || [2, 3, 4].includes(disclosure?.titleLevel)
      ? disclosure.titleLevel
      : 2;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odDisclosureBubbleMenu"
      shouldShow={({ editor: currentEditor, state }) =>
        currentEditor.isEditable && isRichTextNodeSelection(state, "odDisclosure")
      }
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover"
    >
      <div className="od-rich-text-editor__toolbar">
        {[
          { value: "paragraph", label: "Párrafo" },
          { value: 2, label: "H2" },
          { value: 3, label: "H3" },
          { value: 4, label: "H4" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            className={`od-rich-text-editor__button${titleLevel === option.value ? " is-active" : ""}`}
            aria-pressed={titleLevel === option.value}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => updateDisclosure({ titleLevel: option.value })}
          >
            {option.label}
          </button>
        ))}
        <button
          type="button"
          className="od-rich-text-editor__button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => updateDisclosure({ open: !disclosure?.open })}
        >
          {disclosure?.open ? "Cargar plegado" : "Cargar desplegado"}
        </button>
        <button
          type="button"
          className="od-rich-text-editor__button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={deleteDisclosure}
        >
          Eliminar bloque
        </button>
      </div>
    </BubbleMenu>
  );
}
