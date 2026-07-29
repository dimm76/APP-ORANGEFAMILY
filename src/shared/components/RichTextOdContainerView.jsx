import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import {
  buildOdContainerClassName,
  buildOdContainerInnerStyle,
  renderOdContainerDataAttributes,
  resolveOdContainerAttrs,
} from "../utils/odContainerAttrs.js";
import RichTextBlockDragHandle from "./RichTextBlockDragHandle.jsx";

/**
 * @param {import("@tiptap/react").NodeViewProps} props
 */
export default function RichTextOdContainerView({ node, selected, editor }) {
  const resolved = resolveOdContainerAttrs(node.attrs);
  const innerStyle = buildOdContainerInnerStyle(resolved);

  return (
    <NodeViewWrapper
      className={`${buildOdContainerClassName(resolved.widthMode)}${selected ? " is-selected" : ""}`}
      {...renderOdContainerDataAttributes(resolved)}
    >
      <RichTextBlockDragHandle editor={editor} label="Arrastrar contenedor" />
      <div className="od-tiptap-container__inner" style={innerStyle}>
        <NodeViewContent className="od-tiptap-container__content" />
      </div>
    </NodeViewWrapper>
  );
}
