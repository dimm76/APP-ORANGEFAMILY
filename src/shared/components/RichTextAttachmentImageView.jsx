import { NodeViewWrapper } from "@tiptap/react";

export default function RichTextAttachmentImageView({ node, selected }) {
  const width = Math.min(100, Math.max(25, Number(node.attrs.displayWidth) || 100));
  return (
    <NodeViewWrapper
      className={`od-editor-block od-rich-attachment-image-view${selected ? " is-selected" : ""}`}
      style={{ width: `${width}%` }}
    >
      <img
        className="od-rich-attachment-image"
        src={node.attrs.src || undefined}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || undefined}
      />
    </NodeViewWrapper>
  );
}
