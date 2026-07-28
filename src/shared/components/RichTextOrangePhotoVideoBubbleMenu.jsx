import { useState } from "react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import OrangePhotoEmbedPickerModal from "./OrangePhotoEmbedPickerModal.jsx";

export default function RichTextOrangePhotoVideoBubbleMenu({ editor }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const photoId = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => String(currentEditor?.getAttributes("orangePhotoVideo").photoId || ""),
  });
  if (!editor || !editor.isEditable) return null;
  return <>
    <BubbleMenu editor={editor} pluginKey="orangePhotoVideoBubbleMenu" shouldShow={({ state }) => state.selection instanceof NodeSelection && state.selection.node?.type?.name === "orangePhotoVideo"} tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }} className="od-rich-text-editor__toolbar-popover">
      <div className="od-rich-text-editor__toolbar od-orange-photo-bubble-menu">
        <button type="button" className="od-rich-text-editor__button" onMouseDown={(event) => event.preventDefault()} onClick={() => setPickerOpen(true)}>Cambiar vídeo</button>
      </div>
    </BubbleMenu>
    <OrangePhotoEmbedPickerModal open={pickerOpen} mode="video" selectedId={photoId} onClose={() => setPickerOpen(false)} onConfirm={(resource) => { const nextPhotoId = String(resource?.id || "").trim(); if (!nextPhotoId) return; editor.chain().focus().updateAttributes("orangePhotoVideo", { photoId: nextPhotoId }).run(); setPickerOpen(false); }} />
  </>;
}
