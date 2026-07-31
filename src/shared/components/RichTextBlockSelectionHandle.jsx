import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";
import { selectRichTextNode } from "../utils/richTextNodeSelection.js";

/**
 * @param {{
 *   editor: import("@tiptap/core").Editor|null|undefined,
 *   getPos?: () => number,
 *   nodeName: string,
 *   label?: string,
 * }} props
 */
export default function RichTextBlockSelectionHandle({
  editor,
  getPos,
  nodeName,
  label = "Seleccionar bloque",
}) {
  function stopPointerSelection(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleClick(event) {
    event.preventDefault();
    event.stopPropagation();
    selectRichTextNode(editor, getPos, nodeName);
  }

  return (
    <button
      type="button"
      className="od-editor-block__selection-handle"
      aria-label={label}
      title={label}
      contentEditable={false}
      onMouseDown={stopPointerSelection}
      onClick={handleClick}
    >
      <IonIcon icon={OD_ICONS.expandSections} aria-hidden="true" />
    </button>
  );
}
