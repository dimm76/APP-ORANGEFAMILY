import { useEffect, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import { promptGoogleSheetsUrl } from "./insertGoogleSheetsEmbed.js";
import {
  clampGoogleSheetsEmbedHeight,
  resolveGoogleSheetsModes,
} from "../utils/googleSheetsEmbedUrl.js";

const VIEW_OPTIONS = [
  { id: "normal", label: "Completa", title: "Vista completa con interfaz de Google Sheets" },
  { id: "clean", label: "Limpia", title: "Vista limpia centrada en la tabla" },
];

const WIDTH_OPTIONS = [
  { id: "normal", label: "Normal", title: "Ancho del editor" },
  { id: "full", label: "Completo", title: "Ancho completo del contenedor" },
];

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
function GsheetsToolbarPicker({
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
export default function RichTextGoogleSheetsBubbleMenu({ editor }) {
  const [, setTick] = useState(0);
  const [openPicker, setOpenPicker] = useState(null);

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

  const attrs = editor.getAttributes("googleSheetsEmbed");
  const modes = resolveGoogleSheetsModes(attrs);
  const viewLabel =
    VIEW_OPTIONS.find((option) => option.id === modes.viewMode)?.label ?? "Completa";
  const widthLabel =
    WIDTH_OPTIONS.find((option) => option.id === modes.widthMode)?.label ?? "Normal";

  function updateAttrs(patch) {
    editor.chain().focus().updateAttributes("googleSheetsEmbed", patch).run();
    setOpenPicker(null);
  }

  function handleUrl() {
    const nextUrl = promptGoogleSheetsUrl(editor);
    if (nextUrl === null) return;
    if (!nextUrl) {
      editor.chain().focus().deleteSelection().run();
      return;
    }
    updateAttrs({ url: nextUrl });
  }

  function handleHeight() {
    const current = clampGoogleSheetsEmbedHeight(attrs?.height);
    const raw = window.prompt("Altura del embed (px)", String(current));
    if (raw === null) return;
    const next = clampGoogleSheetsEmbedHeight(raw, current);
    updateAttrs({ height: next });
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odRichGoogleSheetsMenu"
      shouldShow={({ editor: ed }) => ed.isActive("googleSheetsEmbed")}
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover od-rich-gsheets-menu"
    >
      <div className="od-rich-text-editor__toolbar od-rich-gsheets-menu__toolbar">
        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Editar URL"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleUrl}
        >
          URL
        </button>
        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Altura en píxeles"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleHeight}
        >
          Altura
        </button>
        <GsheetsToolbarPicker
          label="Modo"
          valueLabel={viewLabel}
          open={openPicker === "view"}
          onToggle={() => setOpenPicker((current) => (current === "view" ? null : "view"))}
          onClose={() => setOpenPicker(null)}
          options={VIEW_OPTIONS}
          activeId={modes.viewMode}
          onSelect={(id) => updateAttrs({ viewMode: id })}
        />
        <GsheetsToolbarPicker
          label="Ancho"
          valueLabel={widthLabel}
          open={openPicker === "width"}
          onToggle={() => setOpenPicker((current) => (current === "width" ? null : "width"))}
          onClose={() => setOpenPicker(null)}
          options={WIDTH_OPTIONS}
          activeId={modes.widthMode}
          onSelect={(id) => updateAttrs({ widthMode: id })}
        />
        <button
          type="button"
          className={`od-rich-text-editor__button${
            attrs?.showToolbar !== false ? " is-active" : ""
          }`}
          title="Mostrar u ocultar toolbar del embed"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const current = attrs?.showToolbar !== false;
            updateAttrs({ showToolbar: !current });
          }}
        >
          Toolbar
        </button>
        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Eliminar embed"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          Eliminar
        </button>
      </div>
    </BubbleMenu>
  );
}
