import { MenuRow, MenuSection } from "./RichTextBubbleMenu.jsx";
import { getRichTextBlockMenuGroups } from "./richTextBlockActions.js";

/**
 * Menú vertical de inserción/transformación de bloques (reutilizable en Wiki, "/" u otros editores).
 * @param {{
 *   editor: import("@tiptap/core").Editor | null,
 *   groups?: ReturnType<typeof getRichTextBlockMenuGroups>,
 *   handlers?: { onPickImage?: () => void },
 *   className?: string,
 *   ariaLabel?: string,
 * }} props
 */
export default function RichTextBlockMenu({
  editor,
  groups: groupsProp,
  handlers,
  className = "",
  ariaLabel = "Añadir bloque",
  onItemSelect,
}) {
  const groups = groupsProp ?? getRichTextBlockMenuGroups(editor, handlers);
  if (!groups.length) return null;

  return (
    <div
      className={`od-rich-text-editor__toolbar od-rich-text-editor__toolbar--vertical od-rich-text-block-menu-panel${className ? ` ${className}` : ""}`}
      role="menu"
      aria-label={ariaLabel}
    >
      {groups.map((section) => (
        <MenuSection key={section.title} title={section.title}>
          {section.items.map((item) => (
            <MenuRow
              key={item.id}
              icon={item.icon}
              imageSrc={item.imageSrc}
              glyph={item.glyph}
              glyphVariant={item.glyphVariant}
              label={item.label}
              title={item.title}
              disabled={item.disabled}
              onClick={() => {
                item.onClick();
                onItemSelect?.();
              }}
            />
          ))}
        </MenuSection>
      ))}
    </div>
  );
}
