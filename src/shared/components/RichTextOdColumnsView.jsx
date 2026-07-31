import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { buildOdRichColumnsClassName, resolveColumnLayout } from "../utils/odColumnsLayout.js";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";
import RichTextBlockSelectionHandle from "./RichTextBlockSelectionHandle.jsx";

export default function RichTextOdColumnsView({ node, editor, selected, getPos }) {
  const columns = node.attrs.columns === 3 ? 3 : 2;
  const columnLayout = resolveColumnLayout(columns, node.attrs.columnLayout);

  return (
    <NodeViewWrapper className={`od-editor-block od-editor-selectable-block od-rich-columns-node-view${selected ? " is-selected" : ""}`}>
      <RichTextBlockSelectionHandle editor={editor} getPos={getPos} nodeName="odRichColumns" label="Seleccionar bloque de columnas" />
      <RichTextBlockDragHandle editor={editor} label="Arrastrar bloque de columnas" />
      <NodeViewContent
        className={buildOdRichColumnsClassName(columns, columnLayout)}
        data-columns={String(columns)}
        data-column-layout={columnLayout}
      />
    </NodeViewWrapper>
  );
}
