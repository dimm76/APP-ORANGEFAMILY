import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import {
  buildOdContainerClassName,
  buildOdContainerInnerStyle,
  renderOdContainerDataAttributes,
  resolveOdContainerAttrs,
} from "../utils/odContainerAttrs.js";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";
import RichTextBlockSelectionHandle from "./RichTextBlockSelectionHandle.jsx";

/**
 * @param {import("@tiptap/react").NodeViewProps} props
 */
export default function RichTextOdContainerView({ node, selected, editor, getPos }) {
  const resolved = resolveOdContainerAttrs(node.attrs);
  const innerStyle = buildOdContainerInnerStyle(resolved);

  return (
    <NodeViewWrapper
      className={`${buildOdContainerClassName(resolved.widthMode)} od-editor-selectable-block${selected ? " is-selected" : ""}`}
      {...renderOdContainerDataAttributes(resolved)}
    >
      <RichTextBlockSelectionHandle editor={editor} getPos={getPos} nodeName="odContainer" label="Seleccionar contenedor" />
      <RichTextBlockDragHandle editor={editor} label="Arrastrar contenedor" />
      <div className="od-tiptap-container__inner" style={innerStyle}>
        <NodeViewContent className="od-tiptap-container__content" />
      </div>
    </NodeViewWrapper>
  );
}
