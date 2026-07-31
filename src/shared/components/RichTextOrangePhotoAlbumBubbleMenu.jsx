import { useRef, useState } from "react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import OrangePhotoEmbedPickerModal from "./OrangePhotoEmbedPickerModal.jsx";
import {
  getRichTextNodeSelectionContext,
  isRichTextNodeSelection,
} from "../utils/richTextNodeSelection.js";

const HEIGHTS = new Set(["compact", "normal", "large"]);

export default function RichTextOrangePhotoAlbumBubbleMenu({ editor }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const targetPosRef = useRef(null);
  const attrs = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor?.getAttributes("orangePhotoAlbum") || {},
  });
  if (!editor || !editor.isEditable) return null;
  const albumId = String(attrs.albumId || "");
  const height = HEIGHTS.has(attrs.height) ? attrs.height : "normal";
  function openPicker() {
    const context = getRichTextNodeSelectionContext(editor.state, "orangePhotoAlbum");
    if (!context) return;

    targetPosRef.current = context.pos;
    setPickerOpen(true);
  }

  function closePicker() {
    targetPosRef.current = null;
    setPickerOpen(false);
  }

  function confirmAlbum(resource) {
    const nextAlbumId = String(resource?.id || "").trim();
    const targetPos = targetPosRef.current;

    if (!nextAlbumId || !Number.isInteger(targetPos)) {
      return;
    }

    const targetNode = editor.state.doc.nodeAt(targetPos);

    if (!targetNode || targetNode.type.name !== "orangePhotoAlbum") {
      return;
    }

    if (String(targetNode.attrs.albumId || "") === nextAlbumId) {
      return;
    }

    const transaction = editor.state.tr.setNodeMarkup(
      targetPos,
      undefined,
      {
        ...targetNode.attrs,
        albumId: nextAlbumId,
      }
    );

    transaction.setSelection(
      NodeSelection.create(transaction.doc, targetPos)
    );

    editor.view.dispatch(transaction);
    editor.view.focus();
  }
  return <>
    <BubbleMenu editor={editor} pluginKey="orangePhotoAlbumBubbleMenu" shouldShow={({ editor: currentEditor, state }) => currentEditor.isEditable && isRichTextNodeSelection(state, "orangePhotoAlbum")} tippyOptions={{ duration: 100, zIndex: overlayZIndexForStackDepth() }} className="od-rich-text-editor__toolbar-popover">
      <div className="od-rich-text-editor__toolbar od-orange-photo-bubble-menu">
        <select className="od-filter-input" aria-label="Altura del álbum" value={height} onChange={(event) => editor.chain().focus().updateAttributes("orangePhotoAlbum", { height: event.target.value }).run()}>
          <option value="compact">Compacta</option><option value="normal">Normal</option><option value="large">Grande</option>
        </select>
        <button type="button" className="od-rich-text-editor__button" onMouseDown={(event) => event.preventDefault()} onClick={openPicker}>Cambiar álbum</button>
      </div>
    </BubbleMenu>
    <OrangePhotoEmbedPickerModal open={pickerOpen} mode="album" selectedId={albumId} onClose={closePicker} onConfirm={confirmAlbum} />
  </>;
}
