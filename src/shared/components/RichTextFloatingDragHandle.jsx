import { useEffect, useRef } from "react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { NodeSelection } from "@tiptap/pm/state";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

const TARGET_CLASS = "od-rich-text-drag-target";
const POSITION_CONFIG = { placement: "left-start", strategy: "absolute" };
const NESTED_CONFIG = {
  defaultRules: true,
  allowedContainers: ["odContainer", "odDisclosure", "odRichColumns", "odRichColumn", "odTabs", "odTabPanel"],
  edgeDetection: { edges: ["left", "top"], threshold: 12, strength: 500 },
  rules: [{
    id: "orangeFamilyNestedBlockTargets",
    evaluate: ({ node, parent, depth }) => {
      const nodeName = node.type.name;
      if (nodeName === "odTabPanel") return 1000;
      if (nodeName === "odRichColumn") return -300;
      if (depth > 1 && node.isTextblock) return 1000;
      if (parent?.type?.name === "odRichColumn" && nodeName !== "odRichColumn") return 1000;
      return 0;
    },
  }],
};

export default function RichTextFloatingDragHandle({ editor }) {
  const targetPosRef = useRef(null);
  const targetNodeNameRef = useRef("");
  const targetDomRef = useRef(null);

  function clearTargetDom() {
    targetDomRef.current?.classList?.remove(TARGET_CLASS);
    targetDomRef.current = null;
  }

  function clearTarget() {
    clearTargetDom();
    targetPosRef.current = null;
    targetNodeNameRef.current = "";
  }

  function handleNodeChange({ node, editor: currentEditor, pos }) {
    clearTarget();
    if (!node || !Number.isInteger(pos) || !currentEditor) return;
    const dom = currentEditor.view.nodeDOM(pos);
    targetPosRef.current = pos;
    targetNodeNameRef.current = node.type.name;
    if (dom instanceof HTMLElement) {
      dom.classList.add(TARGET_CLASS);
      targetDomRef.current = dom;
    }
  }

  function selectCurrentTarget() {
    if (!editor?.isEditable) return false;
    const position = targetPosRef.current;
    if (!Number.isInteger(position)) return false;
    const node = editor.state.doc.nodeAt(position);
    if (!node || node.type.name !== targetNodeNameRef.current || !NodeSelection.isSelectable(node)) return false;
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, position)));
    return true;
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    selectCurrentTarget();
  }

  function handleElementDragStart(event) {
    if (targetNodeNameRef.current === "odRichColumn") event.preventDefault();
  }

  useEffect(() => () => {
    targetDomRef.current?.classList?.remove(TARGET_CLASS);
    targetDomRef.current = null;
    targetPosRef.current = null;
    targetNodeNameRef.current = "";
  }, []);

  if (!editor) return null;
  return (
    <DragHandle editor={editor} className="od-rich-text-floating-drag-handle-host" pluginKey="odRichTextFloatingDragHandle" computePositionConfig={POSITION_CONFIG} nested={NESTED_CONFIG} onNodeChange={handleNodeChange} onElementDragStart={handleElementDragStart}>
      <button type="button" className="od-rich-text-floating-drag-handle" aria-label="Seleccionar o arrastrar bloque" title="Seleccionar o arrastrar bloque" contentEditable={false} onMouseDown={selectCurrentTarget} onClick={selectCurrentTarget} onKeyDown={handleKeyDown}>
        <IonIcon icon={OD_ICONS.reorder} aria-hidden="true" />
      </button>
    </DragHandle>
  );
}
