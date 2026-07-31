import { useCallback, useEffect, useRef } from "react";
import DragHandle from "@tiptap/extension-drag-handle-react";
import { NodeSelection } from "@tiptap/pm/state";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

const TARGET_CLASS = "od-rich-text-drag-target";
const POSITION_CONFIG = { placement: "left-start", strategy: "absolute" };
const NESTED_CONFIG = {
  defaultRules: true,

  /*
   * Modelo jerárquico predecible:
   *
   * - centro del nodo: gana el nivel más profundo;
   * - borde superior: gana progresivamente el padre;
   * - no usar borde izquierdo porque columnas, hijos y
   *   contenedores suelen compartir o solapar ese eje.
   *
   * strength 200 mantiene seleccionables profundidades
   * habituales. Con 500, profundidad 2 quedaba excluida.
   */
  edgeDetection: {
    edges: ["top"],
    threshold: 6,
    strength: 200,
  },

  rules: [
    {
      id: "orangeFamilyNestedBlockTargets",

      evaluate: ({ node, depth }) => {
        const nodeName = node.type.name;

        /*
         * Nodo técnico interno.
         * La unidad funcional seleccionable es odTabs.
         */
        if (nodeName === "odTabPanel") {
          return 1000;
        }

        /*
         * El texto interior no debe competir con la
         * columna, desplegable, pestaña o contenedor.
         *
         * Los párrafos de primer nivel permanecen
         * seleccionables.
         */
        if (depth > 1 && node.isTextblock) {
          return 1000;
        }

        return 0;
      },
    },
  ],
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

  const clearTargetDom = useCallback((currentEditor = editor) => {
    targetDomRef.current?.classList?.remove(TARGET_CLASS);
    targetDomRef.current = null;

    const editorDom = currentEditor?.view?.dom;

    if (!(editorDom instanceof HTMLElement)) {
      return;
    }

    editorDom
      .querySelectorAll(`.${TARGET_CLASS}`)
      .forEach((element) => {
        element.classList.remove(TARGET_CLASS);
      });
  }, [editor]);

  const clearTarget = useCallback((currentEditor = editor) => {
    clearTargetDom(currentEditor);
    targetPosRef.current = null;
    targetNodeNameRef.current = "";
    setHostDraggable(true);
  }, [clearTargetDom, editor, setHostDraggable]);

  const handleNodeChange = useCallback(({ node, editor: currentEditor, pos }) => {
    clearTarget(currentEditor);
    if (!node || !Number.isInteger(pos) || !currentEditor) return;
    const dom = currentEditor.view.nodeDOM(pos);
    targetPosRef.current = pos;
    targetNodeNameRef.current = node.type.name;
    const currentSelection = currentEditor.state.selection;
    const hasDifferentNodeSelection =
      currentSelection instanceof NodeSelection && currentSelection.from !== pos;
    setHostDraggable(node.type.name !== "odRichColumn");
    /*
     * Mientras exista otro NodeSelection, el handle puede
     * desplazarse al nuevo objetivo, pero no se dibuja un
     * segundo outline de hover.
     *
     * El nuevo nodo quedará seleccionado al pulsar el handle.
     */
    if (!hasDifferentNodeSelection && dom instanceof HTMLElement) {
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
    clearTargetDom(editor);
    if (targetNodeNameRef.current === "odRichColumn") {
      const host = event.currentTarget.parentElement;
      if (host instanceof HTMLElement) host.draggable = false;
    }
  }, [clearTargetDom, editor, selectCurrentTarget]);

  useEffect(() => {
    return () => {
      clearTarget(editor);
    };
  }, [clearTarget, editor]);

  if (!editor) return null;
  return (
    <DragHandle editor={editor} className="od-rich-text-floating-drag-handle-host" pluginKey="odRichTextFloatingDragHandle" computePositionConfig={POSITION_CONFIG} nested={NESTED_CONFIG} onNodeChange={handleNodeChange}>
      <button ref={buttonRef} type="button" className="od-rich-text-floating-drag-handle" aria-label="Seleccionar o arrastrar bloque" title="Seleccionar o arrastrar bloque" contentEditable={false} onMouseDown={handleMouseDown} onClick={handleClick}>
        <IonIcon icon={OD_ICONS.reorder} aria-hidden="true" />
      </button>
    </DragHandle>
  );
}
