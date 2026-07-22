import { useEffect, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import { promptFigmaUrl } from "./insertFigmaEmbed.js";
import {
  clampFigmaEmbedHeight,
  resolveFigmaModes,
} from "../utils/figmaEmbedUrl.js";

const WIDTH_OPTIONS = [
  { id: "normal", label: "Normal", title: "Ancho del editor" },
  { id: "full", label: "Completo", title: "Ancho completo del contenedor" },
];

function FigmaToolbarPicker({
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
    <div className="od-rich-figma-menu__picker" ref={rootRef}>
      <button
        type="button"
        className={`od-rich-text-editor__button od-rich-figma-menu__picker-trigger${
          open ? " is-active" : ""
        }`}
        title={`${label}: ${valueLabel}`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
      >
        <span className="od-rich-figma-menu__picker-label">{label}:</span>
        <span className="od-rich-figma-menu__picker-value">{valueLabel}</span>
      </button>

      {open ? (
        <div className="od-rich-figma-menu__picker-panel" role="menu">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={activeId === option.id}
              className={`od-rich-figma-menu__picker-option${
                activeId === option.id ? " is-active" : ""
              }`}
              title={option.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
            >
              <span>{option.label}</span>
              {activeId === option.id ? <span aria-hidden="true">OK</span> : null}
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
export default function RichTextFigmaBubbleMenu({ editor }) {
  const [, setTick] = useState(0);
  const [openPicker, setOpenPicker] = useState(null);

  useEffect(() => {
    if (!editor) return undefined;

    const refresh = () => setTick((value) => value + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);

    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
    };
  }, [editor]);

  if (!editor) return null;

  const attrs = editor.getAttributes("figmaEmbed");
  const modes = resolveFigmaModes(attrs);
  const widthLabel =
    WIDTH_OPTIONS.find((option) => option.id === modes.widthMode)?.label ?? "Normal";

  function updateAttrs(patch) {
    editor.chain().focus().updateAttributes("figmaEmbed", patch).run();
    setOpenPicker(null);
  }

  function handleUrl() {
    const nextUrl = promptFigmaUrl(editor);

    if (nextUrl === null) return;

    if (!nextUrl) {
      editor.chain().focus().deleteSelection().run();
      return;
    }

    updateAttrs({ url: nextUrl });
  }

  function handleHeight() {
    const current = clampFigmaEmbedHeight(attrs?.height);
    const raw = window.prompt("Altura del embed (px)", String(current));
    if (raw === null) return;

    const next = clampFigmaEmbedHeight(raw, current);
    updateAttrs({ height: next });
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odRichFigmaMenu"
      shouldShow={({ editor: ed }) => ed.isActive("figmaEmbed")}
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover od-rich-figma-menu"
    >
      <div className="od-rich-text-editor__toolbar od-rich-figma-menu__toolbar">
        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Editar URL"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleUrl}
        >
          URL
        </button>

        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Altura en pixeles"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleHeight}
        >
          Altura
        </button>

        <FigmaToolbarPicker
          label="Ancho"
          valueLabel={widthLabel}
          open={openPicker === "width"}
          onToggle={() =>
            setOpenPicker((current) => (current === "width" ? null : "width"))
          }
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
          onMouseDown={(event) => event.preventDefault()}
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
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          Eliminar
        </button>
      </div>
    </BubbleMenu>
  );
}
