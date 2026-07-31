/* eslint-disable react-refresh/only-export-components */
import { Table } from "@tiptap/extension-table";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";

function RichTextTableView() {
  return (
    <NodeViewWrapper className="od-editor-block od-editor-table">
      <NodeViewContent as="table" />
    </NodeViewWrapper>
  );
}

export const RichTextTable = Table.extend({
  selectable: true,
  draggable: true,

  addNodeView() {
    return ReactNodeViewRenderer(RichTextTableView);
  },
});
