import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { buildOdRichColumnsClassName, resolveColumnLayout } from "../utils/odColumnsLayout.js";

export default function RichTextOdColumnsView({ node }) {
  const columns = node.attrs.columns === 3 ? 3 : 2;
  const columnLayout = resolveColumnLayout(columns, node.attrs.columnLayout);

  return (
    <NodeViewWrapper className="od-editor-block od-rich-columns-node-view">
      <NodeViewContent
        className={buildOdRichColumnsClassName(columns, columnLayout)}
        data-columns={String(columns)}
        data-column-layout={columnLayout}
      />
    </NodeViewWrapper>
  );
}
