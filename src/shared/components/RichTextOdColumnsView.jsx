import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { buildOdRichColumnsClassName, resolveColumnLayout } from "../utils/odColumnsLayout.js";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";

export default function RichTextOdColumnsView({ node, editor }) {
  const columns = node.attrs.columns === 3 ? 3 : 2;
  const columnLayout = resolveColumnLayout(columns, node.attrs.columnLayout);

  return (
    <NodeViewWrapper
      className={`od-editor-block ${buildOdRichColumnsClassName(columns, columnLayout)}`}
      data-columns={String(columns)}
      data-column-layout={columnLayout}
    >
      <RichTextBlockDragHandle editor={editor} label="Arrastrar bloque de columnas" />
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
