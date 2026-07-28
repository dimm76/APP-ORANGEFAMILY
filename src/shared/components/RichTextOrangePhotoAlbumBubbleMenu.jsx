import { useState } from "react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import OrangePhotoEmbedPickerModal from "./OrangePhotoEmbedPickerModal.jsx";

const HEIGHTS = new Set(["compact", "normal", "large"]);

export default function RichTextOrangePhotoAlbumBubbleMenu({ editor }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const attrs = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.getAttributes("orangePhotoAlbum") || {},
  });
  if (!editor || !editor.isEditable) return null;
  const albumId = String(attrs.albumId || "");
  const height = HEIGHTS.has(attrs.height) ? attrs.height : "normal";
  return <>
    <BubbleMenu editor={editor} pluginKey="orangePhotoAlbumBubbleMenu" shouldShow={({ state }) => state.selection instanceof NodeSelection && state.selection.node?.type?.name === "orangePhotoAlbum"} tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }} className="od-rich-text-editor__toolbar-popover">
      <div className="od-rich-text-editor__toolbar od-orange-photo-bubble-menu">
        <select className="od-filter-input" aria-label="Altura del álbum" value={height} onChange={(event) => editor.chain().focus().updateAttributes("orangePhotoAlbum", { height: event.target.value }).run()}>
          <option value="compact">Compacta</option><option value="normal">Normal</option><option value="large">Grande</option>
        </select>
        <button type="button" className="od-rich-text-editor__button" onMouseDown={(event) => event.preventDefault()} onClick={() => setPickerOpen(true)}>Cambiar álbum</button>
      </div>
    </BubbleMenu>
    <OrangePhotoEmbedPickerModal open={pickerOpen} mode="album" selectedId={albumId} onClose={() => setPickerOpen(false)} onConfirm={(resource) => { const nextAlbumId = String(resource?.id || "").trim(); if (!nextAlbumId) return; editor.chain().focus().updateAttributes("orangePhotoAlbum", { albumId: nextAlbumId }).run(); setPickerOpen(false); }} />
  </>;
}
