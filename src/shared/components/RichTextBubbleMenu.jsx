import { useEffect, useState } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";
import { RICH_TEXT_GLYPH } from "./richTextMenuGlyphs.js";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import { GOOGLE_SHEETS_ICON_SRC } from "../ui/googleSheetsIcon.js";
import { OD_CORPORATE_COLORS } from "../ui/odCorporateColors.js";
import { promptAndInsertGoogleSheetsEmbed } from "./insertGoogleSheetsEmbed.js";

const TIP_EXTENSION_TABLE = "Pendiente: extensión de tabla no disponible.";
const TIP_EXTENSION_TASK_LIST = "Pendiente: extensión de checklist no disponible.";

export function MenuSection({ title, children }) {
  return (
    <div className="od-rich-text-editor__menu-section">
      <div className="od-rich-text-editor__menu-section-title">{title}</div>
      <div className="od-rich-text-editor__menu-section-items">{children}</div>
    </div>
  );
}

export function MenuRow({
  icon,
  imageSrc,
  glyph,
  glyphVariant,
  label,
  active = false,
  disabled,
  title,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`od-rich-text-editor__menu-row${active ? " is-active" : ""}${disabled ? " is-disabled" : ""}`}
      disabled={Boolean(disabled)}
      title={title}
      onMouseDown={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onClick={disabled ? undefined : onClick}
    >
      <span className="od-rich-text-editor__menu-row-content">
        {glyph ? (
          <span
            className={`od-rich-text-editor__menu-row-glyph${
              glyphVariant ? ` od-rich-text-editor__menu-row-glyph--${glyphVariant}` : ""
            }`}
            aria-hidden="true"
          >
            {glyph}
          </span>
        ) : imageSrc ? (
          <img
            className="od-rich-text-editor__menu-row-img"
            src={imageSrc}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
          />
        ) : icon ? (
          <IonIcon className="od-rich-text-editor__menu-row-icon" icon={icon} aria-hidden="true" />
        ) : null}
        <span>{label}</span>
      </span>
    </button>
  );
}

function ColorSwatchRow({ editor }) {
  const [customColor, setCustomColor] = useState("");
  const canColor = typeof editor.commands.setColor === "function";
  const canUnsetColor = typeof editor.commands.unsetColor === "function";
  const currentColor = String(editor.getAttributes("textStyle")?.color ?? "").toLowerCase();

  if (!canColor) return null;

  function normalizeHexColor(value) {
    const normalized = String(value ?? "").trim();
    if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
    if (/^[0-9a-f]{6}$/i.test(normalized)) return `#${normalized}`;
    return "";
  }

  function applyCustomColor() {
    const safeColor = normalizeHexColor(customColor);
    if (!safeColor) return;
    editor.chain().focus().setColor(safeColor).run();
  }

  return (
    <div className="od-rich-text-editor__color-block" role="group" aria-label="Color de texto">
      <div className="od-rich-text-editor__color-row">
      {OD_CORPORATE_COLORS.map((color) => {
        const value = color.value.toLowerCase();
        const active = currentColor === value;
        return (
          <button
            key={color.key}
            type="button"
            className={`od-rich-text-editor__color-swatch${active ? " is-active" : ""}`}
            style={{ "--od-rich-text-color-swatch": color.value }}
            title={color.label}
            aria-label={`Color ${color.label}`}
            aria-pressed={active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().setColor(color.value).run()}
          />
        );
      })}
      </div>
      {canUnsetColor ? (
        <button
          type="button"
          className="od-rich-text-editor__color-clear"
          title="Quitar color"
          aria-label="Quitar color de texto"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          Sin color
        </button>
      ) : null}
      <div className="od-rich-text-editor__color-custom">
        <input
          type="text"
          className="od-rich-text-editor__color-input"
          value={customColor}
          placeholder="#37374b"
          aria-label="Color personalizado HEX"
          maxLength={7}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => setCustomColor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyCustomColor();
            }
          }}
        />
        <button
          type="button"
          className="od-rich-text-editor__color-apply"
          disabled={!normalizeHexColor(customColor)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={applyCustomColor}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

function sanitizeEditorHref(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 2000) return "";
  const probe = s.slice(0, 24).toLowerCase();
  if (
    probe.startsWith("javascript:") ||
    probe.startsWith("data:") ||
    probe.startsWith("vbscript:")
  ) {
    return "";
  }
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      if (u.protocol !== "http:" && u.protocol !== "https:") return "";
      return u.href;
    } catch {
      return "";
    }
  }
  if (/^mailto:/i.test(s)) {
    const local = s.slice("mailto:".length).split("?")[0];
    if (!local || local.length > 500 || /[\s<>"']/.test(local)) return "";
    return `mailto:${local}`;
  }
  if (s.startsWith("/") && !s.startsWith("//")) {
    if (!/^\/[-a-z0-9/_%.?=&]*$/i.test(s)) return "";
    return s;
  }
  return "";
}

export function promptAndSetEditorLink(editor) {
  if (!editor) return;
  const attrs = editor.getAttributes("link");
  const existing = String(attrs?.href ?? "").trim();
  if (editor.state.selection.empty && !editor.isActive("link")) {
    window.alert("Selecciona texto para crear el enlace.");
    return;
  }
  const input = window.prompt(
    "Introduce URL (http(s), mailto: o ruta interna que empiece por /). Deja vacío para quitar enlace.",
    existing
  );
  if (input === null) return;
  const next = String(input).trim();
  const chain = editor.chain().focus().extendMarkRange("link");
  if (!next) {
    chain.unsetLink().run();
    return;
  }
  const safeHref = sanitizeEditorHref(next);
  if (!safeHref) {
    window.alert("URL no válida o no permitida.");
    return;
  }
  const isExternal = /^https?:\/\//i.test(safeHref);
  chain.setLink({
    href: safeHref,
    rel: "noopener noreferrer",
    target: isExternal ? "_blank" : null,
  }).run();
}

function getBlockActiveState(editor) {
  const inBullet = editor.isActive("bulletList");
  const inOrdered = editor.isActive("orderedList");
  const inTask = editor.isActive("taskList");
  const inList = inBullet || inOrdered || inTask;
  const h1 = editor.isActive("heading", { level: 1 });
  const h2 = editor.isActive("heading", { level: 2 });
  const h3 = editor.isActive("heading", { level: 3 });
  const h4 = editor.isActive("heading", { level: 4 });
  const inHeading = h1 || h2 || h3 || h4;

  return {
    inBullet,
    inOrdered,
    inTask,
    inList,
    h1,
    h2,
    h3,
    h4,
    inHeading,
    paragraph: !inList && !inHeading && editor.isActive("paragraph"),
  };
}

/**
 * Menú contextual vertical compacto (sustituye la barra horizontal tipo bubble).
 * @param {{
 *   editor: import("@tiptap/core").Editor | null,
 *   inlineOnly?: boolean,
 * }} props
 */
export default function RichTextBubbleMenu({ editor, inlineOnly = false }) {
  const [, setTick] = useState(0);

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

  const block = getBlockActiveState(editor);
  const canLink = editor.can().setLink({ href: "https://orangedesk.local" });
  const canTaskList = typeof editor.commands.toggleTaskList === "function";
  const canItalic = editor.can().toggleItalic();
  const canCode = editor.can().toggleCode();
  const canUnderline = editor.can().toggleUnderline();
  const canBlockquote = editor.can().toggleBlockquote();
  const canCodeBlock = editor.can().toggleCodeBlock();
  const canSinkList = editor.can().sinkListItem();
  const canLiftList = editor.can().liftListItem();
  const canTable =
    typeof editor.commands.insertTable === "function" &&
    editor.can().insertTable({ rows: 3, cols: 3, withHeaderRow: true });
  const canGoogleSheetsEmbed = typeof editor.commands.setGoogleSheetsEmbed === "function";

  function handleSetLink() {
    promptAndSetEditorLink(editor);
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        interactive: true,
        zIndex: overlayZIndexForStackDepth(),
      }}
      className="od-rich-text-editor__toolbar-popover"
    >
      <div
        className="od-rich-text-editor__toolbar od-rich-text-editor__toolbar--vertical od-rich-text-block-menu-scroll"
        role="menu"
        aria-label="Formato de texto"
      >
        <MenuSection title="Texto">
          <MenuRow
            glyph={RICH_TEXT_GLYPH.paragraph}
            glyphVariant="paragraph"
            label="Párrafo"
            active={block.paragraph}
            title="Texto normal"
            onClick={() => editor.chain().focus().setParagraph().run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.h1}
            glyphVariant="heading"
            label="Título H1"
            active={block.h1}
            title="Título 1"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.h2}
            glyphVariant="heading"
            label="Subtítulo H2"
            active={block.h2}
            title="Título 2"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.h3}
            glyphVariant="heading"
            label="Título pequeño H3"
            active={block.h3}
            title="Título 3"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.h4}
            glyphVariant="heading"
            label="Título H4"
            active={block.h4}
            title="Título 4"
            onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          />
        </MenuSection>

        <MenuSection title="Formato">
          <MenuRow
            glyph={RICH_TEXT_GLYPH.bold}
            glyphVariant="bold"
            label="Negrita"
            active={editor.isActive("bold")}
            title="Negrita"
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.italic}
            glyphVariant="italic"
            label="Cursiva"
            active={editor.isActive("italic")}
            disabled={!canItalic}
            title={canItalic ? "Cursiva" : "No disponible"}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.underline}
            glyphVariant="underline"
            label="Subrayado"
            active={editor.isActive("underline")}
            disabled={!canUnderline}
            title={canUnderline ? "Subrayado" : "No disponible"}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          />
          <MenuRow
            glyph={RICH_TEXT_GLYPH.strike}
            glyphVariant="strike"
            label="Tachado"
            active={editor.isActive("strike")}
            title="Tachado"
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <MenuRow
            icon={OD_ICONS.richCodeInline}
            label="Código inline"
            active={editor.isActive("code")}
            disabled={!canCode}
            title={canCode ? "Código inline" : "No disponible"}
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
          <MenuRow
            icon={OD_ICONS.copyUrl}
            label="Enlace"
            active={editor.isActive("link")}
            disabled={!canLink}
            title={canLink ? "Crear, editar o quitar enlace" : "No disponible"}
            onClick={handleSetLink}
          />
        </MenuSection>

        <MenuSection title="Color de texto">
          <ColorSwatchRow editor={editor} />
        </MenuSection>

        <MenuSection title="Listas">
          <MenuRow
            icon={OD_ICONS.richList}
            label="Lista con viñetas"
            active={block.inBullet}
            title="Lista con viñetas"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <MenuRow
            icon={OD_ICONS.richListOrdered}
            label="Lista numerada"
            active={block.inOrdered}
            title="Lista numerada"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <MenuRow
            icon={OD_ICONS.richChecklist}
            label="Lista de comprobación"
            active={block.inTask}
            disabled={!canTaskList}
            title={canTaskList ? "Alternar checklist" : TIP_EXTENSION_TASK_LIST}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          />
        </MenuSection>

        {inlineOnly && block.inList && (canSinkList || canLiftList) ? (
          <MenuSection title="Indentación">
            <MenuRow
              icon={OD_ICONS.richOutdent}
              label="Reducir indentación"
              disabled={!canLiftList}
              title={canLiftList ? "Reducir nivel de lista" : "No disponible"}
              onClick={() => editor.chain().focus().liftListItem().run()}
            />
            <MenuRow
              icon={OD_ICONS.richIndent}
              label="Aumentar indentación"
              disabled={!canSinkList}
              title={canSinkList ? "Aumentar nivel de lista" : "No disponible"}
              onClick={() => editor.chain().focus().sinkListItem().run()}
            />
          </MenuSection>
        ) : null}

        {inlineOnly && (canBlockquote || canCodeBlock) ? (
          <MenuSection title="Bloques rápidos">
            {canBlockquote ? (
              <MenuRow
                icon={OD_ICONS.richQuote}
                label="Cita"
                active={editor.isActive("blockquote")}
                title="Cita / pull quote"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              />
            ) : null}
            {canCodeBlock ? (
              <MenuRow
                icon={OD_ICONS.richCodeBlock}
                label="Bloque de código"
                active={editor.isActive("codeBlock")}
                title="Bloque de código"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              />
            ) : null}
          </MenuSection>
        ) : null}

        {!inlineOnly && canGoogleSheetsEmbed ? (
          <MenuSection title="Embeds">
            <MenuRow
              imageSrc={GOOGLE_SHEETS_ICON_SRC}
              label="Google Sheets"
              title="Insertar hoja de Google Sheets desde URL"
              onClick={() => promptAndInsertGoogleSheetsEmbed(editor)}
            />
          </MenuSection>
        ) : null}

        {!inlineOnly ? (
        <MenuSection title="Contenido">
          <MenuRow
            icon={OD_ICONS.richTable}
            label="Tabla"
            disabled={!canTable}
            title={canTable ? "Insertar tabla 3x3" : TIP_EXTENSION_TABLE}
            onClick={() =>
              editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
            }
          />
          <MenuRow
            icon={OD_ICONS.richDivider}
            label="Separador horizontal"
            title="Insertar línea horizontal"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <MenuRow
            icon={OD_ICONS.richColumns}
            label="2 columnas"
            title="Insertar bloque de dos columnas"
            disabled={typeof editor.commands.insertColumns !== "function"}
            onClick={() => editor.chain().focus().insertColumns(2).run()}
          />
          <MenuRow
            icon={OD_ICONS.richColumns3}
            label="3 columnas"
            title="Insertar bloque de tres columnas"
            disabled={typeof editor.commands.insertColumns !== "function"}
            onClick={() => editor.chain().focus().insertColumns(3).run()}
          />
        </MenuSection>
        ) : null}
      </div>
    </BubbleMenu>
  );
}
