import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Youtube from "@tiptap/extension-youtube";
import { normalizeRichTextHtml } from "./RichTextEditor.jsx";
import { promptAndInsertYoutubeVideo } from "./insertYoutubeVideo.js";
import {
  promptAndInsertGoogleDriveVideo,
  promptAndInsertVentoVideo,
} from "./insertExternalVideo.js";
import { promptAndInsertGoogleSheetsEmbed } from "./insertGoogleSheetsEmbed.js";
import { promptAndInsertFigmaEmbed } from "./insertFigmaEmbed.js";
import { odRichColumnsExtensions } from "./RichTextOdColumns.js";
import { RichTextAttachmentImage } from "./RichTextAttachmentImage.js";
import { RichTextVideoEmbed } from "./RichTextVideoEmbed.js";
import { RichTextGoogleSheetsEmbed } from "./RichTextGoogleSheetsEmbed.js";
import { RichTextFigmaEmbed } from "./RichTextFigmaEmbed.js";
import { RichTextOdContainer } from "./RichTextOdContainer.js";
import { OdTabs, OdTabPanel } from "./OdTabsExtension.jsx";
import { OdDisclosure } from "./OdDisclosureExtension.jsx";
import RichTextBubbleMenu from "./RichTextBubbleMenu.jsx";
import RichTextSlashCommandMenu from "./RichTextSlashCommandMenu.jsx";
import RichTextImageBubbleMenu from "./RichTextImageBubbleMenu.jsx";
import RichTextGoogleSheetsBubbleMenu from "./RichTextGoogleSheetsBubbleMenu.jsx";
import RichTextFigmaBubbleMenu from "./RichTextFigmaBubbleMenu.jsx";
import RichTextOdContainerBubbleMenu from "./RichTextOdContainerBubbleMenu.jsx";
import RichTextOdColumnsBubbleMenu from "./RichTextOdColumnsBubbleMenu.jsx";
import AttachmentImageLibraryModal from "./AttachmentImageLibraryModal.jsx";
import ImageSourcePickerModal from "./ImageSourcePickerModal.jsx";
import { WikiBlockInsertMenu } from "./WikiBlockInsertMenu.jsx";
import { useRichTextAttachmentEditor } from "../hooks/useRichTextAttachmentEditor.js";
import { fetchSignedUrlsForAttachmentIds } from "../api/attachmentsApi.js";
import {
  extractAttachmentIdsFromHtml,
  extractAttachmentIdsFromJson,
  hydrateHtmlAttachmentSrc,
  hydrateJsonAttachmentSrc,
  stripAttachmentSrcFromHtml,
  stripAttachmentSrcFromJson,
} from "../utils/attachmentRichContent.js";

function normalizeHtml(value) {
  return String(value ?? "").trim();
}

function isDocJson(value) {
  return (
    value != null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    String(value.type ?? "") === "doc"
  );
}

/**
 * Editor Tiptap que persiste como JSON TipTap (`content_json`) y HTML saneado (`content_html`).
 *
 * @param {{
 *   pageKey: string,
 *   contentJson: unknown,
 *   contentHtml: string|null|undefined,
 *   disabled?: boolean,
 *   onSave: (payload: { content_json: unknown, content_html: string }) => void,
 * }} props
 */
export default function WikiTiptapEditor({
  pageKey,
  contentJson,
  contentHtml,
  disabled = false,
  onSave,
}) {
  const rootRef = useRef(null);
  const imageInputRef = useRef(null);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);

  const initialContent = useMemo(() => {
    if (isDocJson(contentJson)) {
      return contentJson;
    }
    return normalizeRichTextHtml(String(contentHtml ?? ""));
  }, [pageKey]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
      }),
      Link.configure({
        autolink: false,
        openOnClick: false,
        defaultProtocol: "https",
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
      TextStyle,
      Color.configure({
        types: ["textStyle"],
      }),
      Underline,
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      RichTextAttachmentImage.configure({
        inline: false,
        allowBase64: false,
      }),
      Youtube.configure({
        inline: false,
        width: 640,
        height: 360,
        nocookie: true,
        allowFullscreen: true,
        controls: true,
        HTMLAttributes: {
          class: "od-youtube-iframe",
        },
      }),
      RichTextVideoEmbed,
      RichTextGoogleSheetsEmbed,
      RichTextFigmaEmbed,
      RichTextOdContainer,
      OdTabs,
      OdTabPanel,
      OdDisclosure,
      ...odRichColumnsExtensions,
    ],
    editable: !disabled,
    content: initialContent,
  });

  const { uploading, uploadAndInsert, insertLibraryImage } = useRichTextAttachmentEditor(editor, {
    entityType: "wiki_page",
    entityId: pageKey,
    fieldKey: "content",
  });

  function handlePickImage() {
    setImageSourceOpen(true);
  }

  function handlePickImageUpload() {
    setImageSourceOpen(false);
    imageInputRef.current?.click();
  }

  function handlePickImageLibrary() {
    setImageSourceOpen(false);
    setImageLibraryOpen(true);
  }

  async function handleConfirmLibraryImage(image) {
    await insertLibraryImage(image);
    setImageLibraryOpen(false);
  }

  function handlePickYoutube() {
    promptAndInsertYoutubeVideo(editor);
  }

  function handlePickGoogleDriveVideo() {
    promptAndInsertGoogleDriveVideo(editor);
  }

  function handlePickVentoVideo() {
    promptAndInsertVentoVideo(editor);
  }

  function handlePickGoogleSheets() {
    promptAndInsertGoogleSheetsEmbed(editor);
  }

  function handlePickFigma() {
    promptAndInsertFigmaEmbed(editor);
  }

  function handleImageFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void uploadAndInsert(file);
  }

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor) return undefined;
    let cancelled = false;

    (async () => {
      const ids = [
        ...extractAttachmentIdsFromJson(contentJson),
        ...extractAttachmentIdsFromHtml(String(contentHtml ?? "")),
      ];
      const unique = [...new Set(ids)];
      const urlById = unique.length ? await fetchSignedUrlsForAttachmentIds(unique) : {};

      if (cancelled) return;

      if (isDocJson(contentJson)) {
        const hydrated = hydrateJsonAttachmentSrc(contentJson, urlById);
        const current = JSON.stringify(editor.getJSON());
        const next = JSON.stringify(hydrated);
        if (current !== next) {
          editor.commands.setContent(hydrated, false);
        }
        return;
      }

      const raw = normalizeRichTextHtml(String(contentHtml ?? ""));
      const next = hydrateHtmlAttachmentSrc(raw, urlById);
      if (normalizeHtml(editor.getHTML()) !== normalizeHtml(next)) {
        editor.commands.setContent(next, false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, pageKey, contentJson, contentHtml]);

  function commitSave() {
    if (!editor || disabled) return;
    const html = stripAttachmentSrcFromHtml(normalizeRichTextHtml(editor.getHTML()));
    const json = stripAttachmentSrcFromJson(editor.getJSON());
    if (typeof onSave === "function") onSave({ content_json: json, content_html: html });
  }

  function handleBlurCapture() {
    setTimeout(() => {
      if (!rootRef.current) return;
      const active = document.activeElement;
      if (!active || !rootRef.current.contains(active)) {
        commitSave();
      }
    }, 0);
  }

  if (!editor) return null;

  return (
    <div
      ref={rootRef}
      className={`od-rich-text-editor od-wiki-tiptap${disabled ? " is-wiki-readonly" : ""}${
        uploading ? " is-attachment-uploading" : ""
      }`}
      onBlurCapture={handleBlurCapture}
    >
      {!disabled ? <RichTextBubbleMenu editor={editor} inlineOnly /> : null}
      {!disabled ? <RichTextImageBubbleMenu editor={editor} /> : null}
      {!disabled ? <RichTextGoogleSheetsBubbleMenu editor={editor} /> : null}
      {!disabled ? <RichTextFigmaBubbleMenu editor={editor} /> : null}
      {!disabled ? <RichTextOdContainerBubbleMenu editor={editor} /> : null}
      {!disabled ? <RichTextOdColumnsBubbleMenu editor={editor} /> : null}
      {!disabled ? (
        <RichTextSlashCommandMenu
          editor={editor}
          handlers={{
            onPickImage: handlePickImage,
            onPickYoutube: handlePickYoutube,
            onPickGoogleDriveVideo: handlePickGoogleDriveVideo,
            onPickVentoVideo: handlePickVentoVideo,
            onPickGoogleSheets: handlePickGoogleSheets,
            onPickFigma: handlePickFigma,
          }}
          menuClassName="od-wiki-add-block-menu"
        />
      ) : null}
      {!disabled ? (
        <WikiBlockInsertMenu
          editor={editor}
          insertId={pageKey}
          onPickImage={handlePickImage}
          onPickYoutube={handlePickYoutube}
          onPickGoogleDriveVideo={handlePickGoogleDriveVideo}
          onPickVentoVideo={handlePickVentoVideo}
          onPickGoogleSheets={handlePickGoogleSheets}
          onPickFigma={handlePickFigma}
        />
      ) : null}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleImageFileChange}
      />
      <ImageSourcePickerModal
        open={imageSourceOpen}
        onClose={() => setImageSourceOpen(false)}
        onPickUpload={handlePickImageUpload}
        onPickLibrary={handlePickImageLibrary}
      />
      <AttachmentImageLibraryModal
        open={imageLibraryOpen}
        onClose={() => setImageLibraryOpen(false)}
        onConfirm={handleConfirmLibraryImage}
      />
      <div className="od-rich-text-editor__content-wrap">
        <EditorContent editor={editor} className="od-rich-text-editor__content" />
      </div>
    </div>
  );
}
