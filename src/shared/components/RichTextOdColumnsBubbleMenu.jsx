import { useEffect, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import {
  columnLayoutOptions,
  getOdRichColumnsContext,
  isOdRichColumnsActive,
  resolveColumnLayout,
} from "../utils/odColumnsLayout.js";

/**
 * @param {{
 *   label: string,
 *   valueLabel: string,
 *   open: boolean,
 *   onToggle: () => void,
 *   onClose: () => void,
 *   options: Array<{ id: string, label: string, title?: string }>,
 *   activeId: string,
 *   onSelect: (id: string) => void,
 * }} props
 */
function ColumnsLayoutPicker({
  label,
  valueLabel,
  open,
  onToggle,
  onClose,
  options,
  activeId,
  onSelect,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  return (
    <div className="od-rich-gsheets-menu__picker" ref={rootRef}>
      <button
        type="button"
        className={`od-rich-text-editor__button od-rich-gsheets-menu__picker-trigger${
          open ? " is-active" : ""
        }`}
        title={`${label}: ${valueLabel}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onToggle}
      >
        <span className="od-rich-gsheets-menu__picker-label">{label}:</span>
        <span className="od-rich-gsheets-menu__picker-value">{valueLabel}</span>
      </button>
      {open ? (
        <div className="od-rich-gsheets-menu__picker-panel" role="menu">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={activeId === option.id}
              className={`od-rich-gsheets-menu__picker-option${
                activeId === option.id ? " is-active" : ""
              }`}
              title={option.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
            >
              <span>{option.label}</span>
              {activeId === option.id ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{ editor: import("@tiptap/react").Editor }} props
 */
export default function RichTextOdColumnsBubbleMenu({ editor }) {
  const [, setTick] = useState(0);
  const [openPicker, setOpenPicker] = useState(false);

  useEffect(() => {
    if (!editor) return undefined;
    const refresh = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  if (!editor) return null;

  const context = getOdRichColumnsContext(editor);
  if (!context) return null;

  const columns = Number(context.attrs?.columns) === 3 ? 3 : 2;
  const columnLayout = resolveColumnLayout(columns, context.attrs?.columnLayout);
  const options = columnLayoutOptions(columns);
  const layoutLabel =
    options.find((option) => option.id === columnLayout)?.label ?? columnLayout;

  function updateLayout(nextLayout) {
    const current = getOdRichColumnsContext(editor);
    if (!current) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setNodeMarkup(current.pos, undefined, {
          ...current.attrs,
          columnLayout: nextLayout,
        });
        return true;
      })
      .run();
    setOpenPicker(false);
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odRichOdColumnsMenu"
      shouldShow={({ editor: ed }) => isOdRichColumnsActive(ed)}
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover od-rich-gsheets-menu"
    >
      <div className="od-rich-text-editor__toolbar od-rich-gsheets-menu__toolbar">
        <ColumnsLayoutPicker
          label="Distribución"
          valueLabel={layoutLabel}
          open={openPicker}
          onToggle={() => setOpenPicker((current) => !current)}
          onClose={() => setOpenPicker(false)}
          options={options}
          activeId={columnLayout}
          onSelect={updateLayout}
        />
      </div>
    </BubbleMenu>
  );
}
