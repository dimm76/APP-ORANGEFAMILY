import { NodeViewWrapper } from "@tiptap/react";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";
import RichTextBlockSelectionHandle from "./RichTextBlockSelectionHandle.jsx";

export default function RichTextAttachmentImageView({ node, editor, selected, getPos }) {
  const width = Math.min(100, Math.max(25, Number(node.attrs.displayWidth) || 100));
  return (
    <NodeViewWrapper
      className={`od-editor-block od-editor-selectable-block od-rich-attachment-image-view${selected ? " is-selected" : ""}`}
      style={{ width: `${width}%` }}
    >
      <RichTextBlockSelectionHandle editor={editor} getPos={getPos} nodeName="image" label="Seleccionar imagen" />
      <RichTextBlockDragHandle editor={editor} label="Arrastrar imagen" />
      <img
        className="od-rich-attachment-image"
        src={node.attrs.src || undefined}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || undefined}
      />
    </NodeViewWrapper>
  );
}
