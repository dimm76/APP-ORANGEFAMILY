import { useEffect, useRef, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import { uploadAttachmentImage } from "../api/attachmentsApi.js";
import { OD_CORPORATE_COLORS } from "../ui/odCorporateColors.js";
import {
  clampOdContainerBorderRadius,
  clampOdContainerBorderWidth,
  clampOdContainerPadding,
  resolveOdContainerAttrs,
} from "../utils/odContainerAttrs.js";

const WIDTH_OPTIONS = [
  { id: "normal", label: "Normal", title: "Ancho del flujo de contenido" },
  { id: "wide", label: "Amplio", title: "Ancho amplio (1300px máx.)" },
  { id: "full", label: "Completo", title: "Ancho completo del contenedor padre" },
];

const BACKGROUND_OPTIONS = [
  { id: "none", label: "Sin fondo", title: "Sin color ni imagen de fondo" },
  { id: "color", label: "Color", title: "Fondo por color corporativo" },
  { id: "image", label: "Imagen", title: "Fondo por imagen (subida a Wasabi)" },
];

/**
 * @param {{
 *   label: string,
 *   valueLabel: string,
 *   open: boolean,
 *   onToggle: () => void,
 *   onClose: () => void,
 *   children: import("react").ReactNode,
 * }} props
 */
function ContainerToolbarPanel({ label, valueLabel, open, onToggle, onClose, children }) {
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
    <div className="od-rich-gsheets-menu__picker od-rich-container-menu__picker" ref={rootRef}>
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
        <div className="od-rich-gsheets-menu__picker-panel od-rich-container-menu__panel" role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   options: Array<{ id: string, label: string, title?: string }>,
 *   activeId: string,
 *   onSelect: (id: string) => void,
 * }} props
 */
function ContainerOptionList({ options, activeId, onSelect }) {
  return options.map((option) => (
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
      onClick={() => onSelect(option.id)}
    >
      <span>{option.label}</span>
      {activeId === option.id ? <span aria-hidden="true">✓</span> : null}
    </button>
  ));
}

/**
 * @param {{
 *   activeKey: string|null,
 *   onSelect: (key: string) => void,
 * }} props
 */
function CorporateColorList({ activeKey, onSelect }) {
  return OD_CORPORATE_COLORS.map((color) => (
    <button
      key={color.key}
      type="button"
      role="menuitemradio"
      aria-checked={activeKey === color.key}
      className={`od-rich-gsheets-menu__picker-option od-rich-container-menu__color-option${
        activeKey === color.key ? " is-active" : ""
      }`}
      title={color.label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(color.key)}
    >
      <span
        className="od-rich-container-menu__color-swatch"
        style={{ backgroundColor: color.value }}
        aria-hidden="true"
      />
      <span>{color.label}</span>
      {activeKey === color.key ? <span aria-hidden="true">✓</span> : null}
    </button>
  ));
}

/**
 * @param {{ editor: import("@tiptap/react").Editor }} props
 */
export default function RichTextOdContainerBubbleMenu({ editor }) {
  const [, setTick] = useState(0);
  const [openPicker, setOpenPicker] = useState(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const bgInputRef = useRef(null);

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

  const attrs = resolveOdContainerAttrs(editor.getAttributes("odContainer"));
  const widthLabel = WIDTH_OPTIONS.find((option) => option.id === attrs.widthMode)?.label ?? "Normal";
  const backgroundLabel =
    BACKGROUND_OPTIONS.find((option) => option.id === attrs.backgroundType)?.label ?? "Sin fondo";
  const bgColorLabel =
    OD_CORPORATE_COLORS.find((color) => color.key === attrs.backgroundColorKey)?.label ?? "Elegir";
  const borderColorLabel =
    OD_CORPORATE_COLORS.find((color) => color.key === attrs.borderColorKey)?.label ?? "Elegir";

  function updateAttrs(patch) {
    editor.chain().focus().updateAttributes("odContainer", patch).run();
    setOpenPicker(null);
  }

  function promptPadding() {
    const current = `${attrs.paddingTop}, ${attrs.paddingRight}, ${attrs.paddingBottom}, ${attrs.paddingLeft}`;
    const raw = window.prompt("Padding (px): superior, derecho, inferior, izquierdo", current);
    if (raw === null) return;
    const parts = raw.split(",").map((part) => part.trim());
    if (parts.length !== 4) return;
    updateAttrs({
      paddingTop: clampOdContainerPadding(parts[0], attrs.paddingTop),
      paddingRight: clampOdContainerPadding(parts[1], attrs.paddingRight),
      paddingBottom: clampOdContainerPadding(parts[2], attrs.paddingBottom),
      paddingLeft: clampOdContainerPadding(parts[3], attrs.paddingLeft),
    });
  }

  function promptBorderWidth() {
    const raw = window.prompt("Grosor del borde (px)", String(attrs.borderWidth));
    if (raw === null) return;
    updateAttrs({ borderWidth: clampOdContainerBorderWidth(raw, attrs.borderWidth) });
  }

  function promptBorderRadius() {
    const raw = window.prompt("Radio del borde (px)", String(attrs.borderRadius));
    if (raw === null) return;
    updateAttrs({ borderRadius: clampOdContainerBorderRadius(raw, attrs.borderRadius) });
  }

  async function handleBackgroundImageChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingBg(true);
    try {
      const payload = await uploadAttachmentImage(file);
      updateAttrs({
        backgroundType: "image",
        backgroundImageId: payload.id,
        backgroundImageUrl: payload.signed_url,
        backgroundColorKey: null,
      });
    } finally {
      setUploadingBg(false);
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="odRichOdContainerMenu"
      shouldShow={({ editor: ed }) => ed.isActive("odContainer")}
      tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }}
      className="od-rich-text-editor__toolbar-popover od-rich-gsheets-menu od-rich-container-menu"
    >
      <div className="od-rich-text-editor__toolbar od-rich-gsheets-menu__toolbar od-rich-container-menu__toolbar">
        <ContainerToolbarPanel
          label="Ancho"
          valueLabel={widthLabel}
          open={openPicker === "width"}
          onToggle={() => setOpenPicker((current) => (current === "width" ? null : "width"))}
          onClose={() => setOpenPicker(null)}
        >
          <ContainerOptionList
            options={WIDTH_OPTIONS}
            activeId={attrs.widthMode}
            onSelect={(id) => updateAttrs({ widthMode: id })}
          />
        </ContainerToolbarPanel>

        <ContainerToolbarPanel
          label="Fondo"
          valueLabel={backgroundLabel}
          open={openPicker === "background"}
          onToggle={() => setOpenPicker((current) => (current === "background" ? null : "background"))}
          onClose={() => setOpenPicker(null)}
        >
          <ContainerOptionList
            options={BACKGROUND_OPTIONS}
            activeId={attrs.backgroundType}
            onSelect={(id) => {
              if (id === "none") {
                updateAttrs({
                  backgroundType: "none",
                  backgroundColorKey: null,
                  backgroundImageId: null,
                  backgroundImageUrl: null,
                });
                return;
              }
              if (id === "color") {
                updateAttrs({
                  backgroundType: "color",
                  backgroundImageId: null,
                  backgroundImageUrl: null,
                  backgroundColorKey: attrs.backgroundColorKey ?? "bg",
                });
                return;
              }
              updateAttrs({
                backgroundType: "image",
                backgroundColorKey: null,
              });
            }}
          />
        </ContainerToolbarPanel>

        {attrs.backgroundType === "color" ? (
          <ContainerToolbarPanel
            label="Color fondo"
            valueLabel={bgColorLabel}
            open={openPicker === "bgColor"}
            onToggle={() => setOpenPicker((current) => (current === "bgColor" ? null : "bgColor"))}
            onClose={() => setOpenPicker(null)}
          >
            <CorporateColorList
              activeKey={attrs.backgroundColorKey}
              onSelect={(key) => updateAttrs({ backgroundColorKey: key, backgroundType: "color" })}
            />
          </ContainerToolbarPanel>
        ) : null}

        {attrs.backgroundType === "image" ? (
          <>
            <button
              type="button"
              className="od-rich-text-editor__button"
              title="Subir imagen de fondo a Wasabi"
              disabled={uploadingBg}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => bgInputRef.current?.click()}
            >
              {uploadingBg ? "Subiendo…" : "Imagen"}
            </button>
            <input
              ref={bgInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => void handleBackgroundImageChange(event)}
            />
          </>
        ) : null}

        <button
          type="button"
          className={`od-rich-text-editor__button${attrs.borderEnabled ? " is-active" : ""}`}
          title="Activar o desactivar borde"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => updateAttrs({ borderEnabled: !attrs.borderEnabled })}
        >
          Borde
        </button>

        {attrs.borderEnabled ? (
          <>
            <ContainerToolbarPanel
              label="Color borde"
              valueLabel={borderColorLabel}
              open={openPicker === "borderColor"}
              onToggle={() =>
                setOpenPicker((current) => (current === "borderColor" ? null : "borderColor"))
              }
              onClose={() => setOpenPicker(null)}
            >
              <CorporateColorList
                activeKey={attrs.borderColorKey}
                onSelect={(key) => updateAttrs({ borderColorKey: key, borderEnabled: true })}
              />
            </ContainerToolbarPanel>
            <button
              type="button"
              className="od-rich-text-editor__button"
              title="Grosor del borde en píxeles"
              onMouseDown={(e) => e.preventDefault()}
              onClick={promptBorderWidth}
            >
              Grosor
            </button>
            <button
              type="button"
              className="od-rich-text-editor__button"
              title="Radio del borde en píxeles"
              onMouseDown={(e) => e.preventDefault()}
              onClick={promptBorderRadius}
            >
              Radio
            </button>
          </>
        ) : null}

        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Padding superior, derecho, inferior e izquierdo (px)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={promptPadding}
        >
          Padding
        </button>

        <button
          type="button"
          className="od-rich-text-editor__button"
          title="Eliminar contenedor"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteSelection().run()}
        >
          Eliminar
        </button>
      </div>
    </BubbleMenu>
  );
}
