import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";

function findDisclosurePosition(editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === "odDisclosure") {
      return {
        pos: $from.before(depth),
        node: $from.node(depth),
      };
    }
  }
  return null;
}

export default function RichTextOdDisclosureBubbleMenu({ editor }) {
  const disclosure = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      const context = currentEditor ? findDisclosurePosition(currentEditor) : null;
      return context
        ? {
            open: Boolean(context.node.attrs.open),
            titleLevel: Number(context.node.attrs.titleLevel),
          }
        : null;
    },
  });

  if (!editor || !editor.isEditable) return null;

  function updateDisclosure(patch) {
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const context = findDisclosurePosition(editor);
        if (!context) return false;
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
        const context = findDisclosurePosition(editor);
        if (!context) return false;
        tr.delete(context.pos, context.pos + context.node.nodeSize);
        return true;
      })
      .run();
  }

  const titleLevel = [2, 3, 4].includes(disclosure?.titleLevel) ? disclosure.titleLevel : 2;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odDisclosureBubbleMenu"
      shouldShow={({ editor: currentEditor }) =>
        currentEditor.isEditable && Boolean(findDisclosurePosition(currentEditor))
      }
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover"
    >
      <div className="od-rich-text-editor__toolbar">
        {[2, 3, 4].map((level) => (
          <button
            key={level}
            type="button"
            className={`od-rich-text-editor__button${titleLevel === level ? " is-active" : ""}`}
            aria-pressed={titleLevel === level}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => updateDisclosure({ titleLevel: level })}
          >
            H{level}
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
