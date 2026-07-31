import { useCallback, useEffect, useRef } from "react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { NodeSelection } from "@tiptap/pm/state";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

const TARGET_CLASS = "od-rich-text-drag-target";
const POSITION_CONFIG = { placement: "left-start", strategy: "absolute" };
const NESTED_CONFIG = {
  defaultRules: true,
  edgeDetection: { edges: ["left", "top"], threshold: 12, strength: 500 },
  rules: [{
    id: "orangeFamilyNestedBlockTargets",
    evaluate: ({ node, depth }) => {
      if (node.type.name === "odTabPanel") return 1000;
      if (depth > 1 && node.isTextblock) return 1000;
      return 0;
    },
  }],
};

export default function RichTextFloatingDragHandle({ editor }) {
  const buttonRef = useRef(null);
  const targetPosRef = useRef(null);
  const targetNodeNameRef = useRef("");
  const targetDomRef = useRef(null);

  const setHostDraggable = useCallback((draggable) => {
    const host = buttonRef.current?.parentElement;
    if (host instanceof HTMLElement) host.draggable = draggable;
  }, []);

  const clearTargetDom = useCallback(() => {
    targetDomRef.current?.classList?.remove(TARGET_CLASS);
    targetDomRef.current = null;
  }, []);

  const clearTarget = useCallback(() => {
    clearTargetDom();
    targetPosRef.current = null;
    targetNodeNameRef.current = "";
    setHostDraggable(true);
  }, [clearTargetDom, setHostDraggable]);

  const handleNodeChange = useCallback(({ node, editor: currentEditor, pos }) => {
    clearTarget();
    if (!node || !Number.isInteger(pos) || !currentEditor) return;
    const dom = currentEditor.view.nodeDOM(pos);
    targetPosRef.current = pos;
    targetNodeNameRef.current = node.type.name;
    setHostDraggable(node.type.name !== "odRichColumn");
    if (dom instanceof HTMLElement) {
      dom.classList.add(TARGET_CLASS);
      targetDomRef.current = dom;
    }
  }, [clearTarget, setHostDraggable]);

  const selectCurrentTarget = useCallback(() => {
    if (!editor?.isEditable) return false;
    const position = targetPosRef.current;
    if (!Number.isInteger(position)) return false;
    const node = editor.state.doc.nodeAt(position);
    if (!node || node.type.name !== targetNodeNameRef.current || !NodeSelection.isSelectable(node)) return false;
    const transaction = editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, position));
    editor.view.dispatch(transaction);
    editor.view.focus();
    return true;
  }, [editor]);

  const handleMouseDown = useCallback((event) => {
    if (targetNodeNameRef.current !== "odRichColumn") return;
    const host = event.currentTarget.parentElement;
    if (host instanceof HTMLElement) host.draggable = false;
  }, []);

  const handleClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    selectCurrentTarget();
    if (targetNodeNameRef.current === "odRichColumn") {
      const host = event.currentTarget.parentElement;
      if (host instanceof HTMLElement) host.draggable = false;
    }
  }, [selectCurrentTarget]);

  useEffect(() => () => clearTarget(), [clearTarget]);

  if (!editor) return null;
  return (
    <DragHandle editor={editor} className="od-rich-text-floating-drag-handle-host" pluginKey="odRichTextFloatingDragHandle" computePositionConfig={POSITION_CONFIG} nested={NESTED_CONFIG} onNodeChange={handleNodeChange}>
      <button ref={buttonRef} type="button" className="od-rich-text-floating-drag-handle" aria-label="Seleccionar o arrastrar bloque" title="Seleccionar o arrastrar bloque" contentEditable={false} onMouseDown={handleMouseDown} onClick={handleClick}>
        <IonIcon icon={OD_ICONS.reorder} aria-hidden="true" />
      </button>
    </DragHandle>
  );
}
