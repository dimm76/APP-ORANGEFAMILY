import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";

/**
 * Controles mínimos cuando hay una imagen embebida seleccionada.
 * @param {{ editor: import("@tiptap/react").Editor }} props
 */
export default function RichTextImageBubbleMenu({
  editor,
  nodeName = "image",
  widthOptions = [50, 75, 100],
  allowAuto = false,
}) {
  if (!editor) return null;

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odRichImageMenu"
      shouldShow={({ editor: ed }) => ed.isActive(nodeName)}
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover od-rich-image-menu"
    >
      <div className="od-rich-text-editor__toolbar od-rich-image-menu__toolbar">
        {allowAuto ? (
          <button
            type="button"
            className="od-rich-text-editor__button"
            title="Tamaño automático"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().updateAttributes(nodeName, { displayWidth: null }).run()}
          >
            Auto
          </button>
        ) : null}
        {widthOptions.map((width) => (
          <button
            key={width}
            type="button"
            className="od-rich-text-editor__button"
            title={`Ancho ${width}%`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => editor.chain().focus().updateAttributes(nodeName, { displayWidth: width }).run()}
          >
            {width}%
          </button>
        ))}
        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Abrir imagen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const src = String(editor.getAttributes(nodeName)?.src ?? "").trim();
            if (src) window.open(src, "_blank", "noopener,noreferrer");
          }}
        >
          Ver
        </button>
        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Eliminar imagen"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          Eliminar
        </button>
      </div>
    </BubbleMenu>
  );
}
