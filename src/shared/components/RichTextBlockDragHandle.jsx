import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

export default function RichTextBlockDragHandle({ editor, label = "Arrastrar bloque" }) {
  if (!editor?.isEditable) return null;

  return (
    <button
      type="button"
      className="od-editor-block__drag-handle"
      aria-label={label}
      data-drag-handle
      contentEditable={false}
    >
      <IonIcon icon={OD_ICONS.reorder} aria-hidden="true" />
    </button>
  );
}
