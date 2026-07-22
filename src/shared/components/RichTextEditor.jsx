import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import RichTextBubbleMenu from "./RichTextBubbleMenu.jsx";
import RichTextImageBubbleMenu from "./RichTextImageBubbleMenu.jsx";
import RichTextGoogleSheetsBubbleMenu from "./RichTextGoogleSheetsBubbleMenu.jsx";
import RichTextFigmaBubbleMenu from "./RichTextFigmaBubbleMenu.jsx";
import RichTextOdContainerBubbleMenu from "./RichTextOdContainerBubbleMenu.jsx";
import RichTextOdColumnsBubbleMenu from "./RichTextOdColumnsBubbleMenu.jsx";
import RichTextBlockInsertMenu from "./RichTextBlockInsertMenu.jsx";
import RichTextSlashCommandMenu from "./RichTextSlashCommandMenu.jsx";
import AttachmentImageLibraryModal from "./AttachmentImageLibraryModal.jsx";
import ImageSourcePickerModal from "./ImageSourcePickerModal.jsx";
import { promptAndInsertGoogleSheetsEmbed } from "./insertGoogleSheetsEmbed.js";
import { promptAndInsertFigmaEmbed } from "./insertFigmaEmbed.js";
import { odRichColumnsExtensions } from "./RichTextOdColumns.js";
import { RichTextAttachmentImage } from "./RichTextAttachmentImage.js";
import { RichTextGoogleSheetsEmbed } from "./RichTextGoogleSheetsEmbed.js";
import { RichTextFigmaEmbed } from "./RichTextFigmaEmbed.js";
import { RichTextOdContainer } from "./RichTextOdContainer.js";
import { OdTabs, OdTabPanel } from "./OdTabsExtension.jsx";
import { OdDisclosure } from "./OdDisclosureExtension.jsx";
import { useRichTextAttachmentEditor } from "../hooks/useRichTextAttachmentEditor.js";
import { fetchSignedUrlsForAttachmentIds } from "../api/attachmentsApi.js";
import {
  extractAttachmentIdsFromHtml,
  hydrateHtmlAttachmentSrc,
  stripAttachmentSrcFromHtml,
} from "../utils/attachmentRichContent.js";
import { isAllowedYoutubeEmbedSrc } from "../utils/youtubeEmbedUrl.js";
import { isAllowedExternalVideoEmbedSrc } from "../utils/videoEmbedUrl.js";
import { isAllowedGoogleSheetsEmbedSrc, parseGoogleSheetsUrl, resolveGoogleSheetsModes, buildGoogleSheetsEmbedClassName } from "../utils/googleSheetsEmbedUrl.js";
import { isAllowedFigmaEmbedSrc, parseFigmaUrl, resolveFigmaModes, buildFigmaEmbedClassName } from "../utils/figmaEmbedUrl.js";
import {
  buildOdContainerClassName,
  buildOdContainerInnerStyle,
  readOdContainerAttrsFromElement,
  renderOdContainerDataAttributes,
} from "../utils/odContainerAttrs.js";
import {
  buildOdRichColumnsClassName,
  readColumnLayoutFromElement,
  resolveColumnLayout,
} from "../utils/odColumnsLayout.js";

function normalizeHtml(value) {
  return String(value ?? "").trim();
}

export function normalizeRichTextHtml(html) {
  const raw = String(html ?? "");
  if (!raw) return "";
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return raw;
  }
  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    const root = doc.body;
    if (!root) return raw;

    const all = root.querySelectorAll("*");
    all.forEach((el) => {
      const tag = String(el.tagName || "").toLowerCase();
      const colOuter = tag === "div" && el.classList?.contains("od-rich-columns");
      const colInner = tag === "div" && el.classList?.contains("od-rich-column");

      if (colOuter) {
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep = new Set(["data-columns", "data-column-layout", "class"]);
          if (!keep.has(name) && (name === "style" || name.startsWith("on"))) {
            el.removeAttribute(attr.name);
          }
        });
        const dcRaw = el.getAttribute("data-columns");
        const cls = String(el.getAttribute("class") || "");
        const cnt = dcRaw === "3" || cls.includes("od-rich-columns--3") ? 3 : 2;
        const columnLayout = resolveColumnLayout(cnt, readColumnLayoutFromElement(el));
        el.setAttribute("data-columns", String(cnt));
        el.setAttribute("data-column-layout", columnLayout);
        el.setAttribute("class", buildOdRichColumnsClassName(cnt, columnLayout));
        return;
      }
      if (colInner) {
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          if (name === "style" || name.startsWith("on")) el.removeAttribute(attr.name);
        });
        el.setAttribute("class", "od-rich-column");
        return;
      }

      const containerWrap = tag === "div" && el.getAttribute("data-type") === "od-container";
      if (containerWrap) {
        const resolved = readOdContainerAttrsFromElement(el);
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep = new Set([
            "data-type",
            "data-width-mode",
            "data-background-type",
            "data-background-color-key",
            "data-background-image-id",
            "data-border-enabled",
            "data-border-color-key",
            "data-border-width",
            "data-border-radius",
            "data-padding-top",
            "data-padding-right",
            "data-padding-bottom",
            "data-padding-left",
            "class",
          ]);
          if (!keep.has(name) && (name === "style" || name.startsWith("on") || name === "data-background-image-url")) {
            el.removeAttribute(attr.name);
          }
        });
        el.setAttribute("class", buildOdContainerClassName(resolved.widthMode));
        Object.entries(renderOdContainerDataAttributes(resolved)).forEach(([key, value]) => {
          el.setAttribute(key, value);
        });
        const inner = el.querySelector(":scope > .od-tiptap-container__inner");
        if (inner) {
          [...inner.attributes].forEach((attr) => {
            const name = String(attr.name || "").toLowerCase();
            if (name === "style" || name.startsWith("on")) inner.removeAttribute(attr.name);
          });

          inner.setAttribute("class", "od-tiptap-container__inner");

          const innerStyle = buildOdContainerInnerStyle(resolved);
          const styleString = Object.entries(innerStyle)
            .map(([key, value]) => {
              const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
              return `${cssKey}:${value}`;
            })
            .join(";");

          if (styleString) {
            inner.setAttribute("style", styleString);
          }
        }
        return;
      }

      const ytWrap = tag === "div" && el.hasAttribute("data-youtube-video");
      const videoEmbedWrap = tag === "div" && el.hasAttribute("data-od-video-embed");
      const gsheetsEmbedWrap = tag === "div" && el.hasAttribute("data-od-gsheets-embed");
      const figmaEmbedWrap = tag === "div" && el.hasAttribute("data-od-figma-embed");
      const ytIframe =
        tag === "iframe" &&
        isAllowedYoutubeEmbedSrc(el.getAttribute("src")) &&
        el.parentElement?.hasAttribute?.("data-youtube-video");
      const externalEmbedIframe =
        tag === "iframe" &&
        isAllowedExternalVideoEmbedSrc(el.getAttribute("src")) &&
        el.parentElement?.hasAttribute?.("data-od-video-embed");
      const gsheetsIframe =
        tag === "iframe" &&
        isAllowedGoogleSheetsEmbedSrc(el.getAttribute("src")) &&
        el.parentElement?.hasAttribute?.("data-od-gsheets-embed");
      const figmaIframe =
        tag === "iframe" &&
        isAllowedFigmaEmbedSrc(el.getAttribute("src")) &&
        el.parentElement?.hasAttribute?.("data-od-figma-embed");

      if (gsheetsEmbedWrap) {
        const rawUrl = String(el.getAttribute("data-url") ?? "").trim();
        if (!rawUrl || !parseGoogleSheetsUrl(rawUrl).ok) {
          el.remove();
          return;
        }
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep = new Set([
            "data-od-gsheets-embed",
            "data-url",
            "data-height",
            "data-view-mode",
            "data-width-mode",
            "data-visual-style",
            "data-show-toolbar",
            "class",
          ]);
          if (!keep.has(name) && (name === "style" || name.startsWith("on"))) {
            el.removeAttribute(attr.name);
          }
        });
        const modes = resolveGoogleSheetsModes({
          viewMode: el.getAttribute("data-view-mode"),
          widthMode: el.getAttribute("data-width-mode"),
          visualStyle: el.getAttribute("data-visual-style"),
        });
        el.setAttribute("class", buildGoogleSheetsEmbedClassName(modes.viewMode, modes.widthMode));
        el.setAttribute("data-view-mode", modes.viewMode);
        el.setAttribute("data-width-mode", modes.widthMode);
        el.setAttribute(
          "data-visual-style",
          modes.widthMode === "full"
            ? "full-screen"
            : modes.viewMode === "clean"
              ? "clean"
              : "normal"
        );
        el.querySelectorAll("iframe").forEach((frame) => frame.remove());
        return;
      }

      if (figmaEmbedWrap) {
        const rawUrl = String(el.getAttribute("data-url") ?? "").trim();
        if (!rawUrl || !parseFigmaUrl(rawUrl).ok) {
          el.remove();
          return;
        }
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep = new Set([
            "data-od-figma-embed",
            "data-url",
            "data-height",
            "data-width-mode",
            "data-show-toolbar",
            "class",
          ]);
          if (!keep.has(name) && (name === "style" || name.startsWith("on"))) {
            el.removeAttribute(attr.name);
          }
        });
        const { widthMode } = resolveFigmaModes({
          widthMode: el.getAttribute("data-width-mode"),
        });
        el.setAttribute("class", buildFigmaEmbedClassName(widthMode));
        el.setAttribute("data-width-mode", widthMode);
        el.querySelectorAll("iframe").forEach((frame) => frame.remove());
        return;
      }

      if (videoEmbedWrap) {
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep = new Set([
            "data-od-video-embed",
            "data-provider",
            "data-original-url",
            "data-aspect-ratio",
            "class",
          ]);
          if (!keep.has(name) && (name === "style" || name.startsWith("on"))) {
            el.removeAttribute(attr.name);
          }
        });
        return;
      }

      if (ytWrap) {
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          if (name !== "data-youtube-video" && (name === "style" || name.startsWith("on"))) {
            el.removeAttribute(attr.name);
          }
        });
        return;
      }

      if (ytIframe || externalEmbedIframe || gsheetsIframe || figmaIframe) {
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep = new Set([
            "src",
            "class",
            "width",
            "height",
            "allow",
            "allowfullscreen",
            "frameborder",
            "title",
            "referrerpolicy",
            "loading",
          ]);
          if (!keep.has(name) && (name === "style" || name.startsWith("on"))) {
            el.removeAttribute(attr.name);
          }
        });
        if (gsheetsIframe) {
          el.setAttribute("class", "od-gsheets-embed__iframe");
        }
        if (figmaIframe) {
          el.setAttribute("class", "od-figma-embed__iframe");
        }
        return;
      }

      if (tag === "iframe") {
        el.remove();
        return;
      }

      const odNode = String(el.getAttribute("data-od-node") || "");
      const odEditorTabs = tag === "div" && odNode === "tabs";
      const odEditorTabPanel = tag === "section" && odNode === "tab-panel";
      const odEditorDisclosure = (tag === "details" || tag === "div") && odNode === "disclosure";
      const odEditorDisclosureSummary =
        tag === "summary" && el.classList?.contains("od-editor-disclosure__summary");
      const odEditorDisclosureContent =
        tag === "div" && el.classList?.contains("od-editor-disclosure__content");

      if (
        odEditorTabs ||
        odEditorTabPanel ||
        odEditorDisclosure ||
        odEditorDisclosureSummary ||
        odEditorDisclosureContent
      ) {
        [...el.attributes].forEach((attr) => {
          const name = String(attr.name || "").toLowerCase();
          const keep =
            name === "class" ||
            name === "open" ||
            name === "data-od-node" ||
            name === "data-active-tab-id" ||
            name === "data-active-tab-index" ||
            name === "data-tab-id" ||
            name === "data-tab-title" ||
            name === "data-title" ||
            name === "data-open";
          if (!keep && (name === "style" || name.startsWith("on") || name.startsWith("data-"))) {
            el.removeAttribute(attr.name);
          }
        });
        return;
      }

      [...el.attributes].forEach((attr) => {
        const name = String(attr.name || "").toLowerCase();
        const keep =
          (tag === "a" && (name === "href" || name === "target" || name === "rel")) ||
          (tag === "img" &&
            (name === "src" ||
              name === "alt" ||
              name === "class" ||
              name === "data-attachment-id" ||
              name === "data-display-width" ||
              name === "data-mail-inline-id")) ||
          ((tag === "td" || tag === "th") && (name === "colspan" || name === "rowspan")) ||
          (tag === "ul" && name === "data-type") ||
          (tag === "li" && (name === "data-type" || name === "data-checked")) ||
          (tag === "input" && (name === "type" || name === "checked" || name === "disabled"));
        if (keep) return;
        if (
          name === "style" ||
          name === "class" ||
          name === "color" ||
          name === "bgcolor" ||
          name === "face" ||
          name === "size" ||
          name.startsWith("data-")
        ) {
          el.removeAttribute(attr.name);
        }
      });
    });

    root.querySelectorAll("font").forEach((el) => {
      el.replaceWith(...el.childNodes);
    });

    return root.innerHTML;
  } catch (_err) {
    return raw;
  }
}

export default function RichTextEditor({
  value,
  onBlurSave,
  saveOnBlur = true,
  onHtmlChange,
  /** Panel lateral de bloques: solo Wiki (WikiTiptapEditor usa WikiBlockInsertMenu). */
  showBlockSidebar = false,
  enableSlashCommand = true,
}) {
  const rootRef = useRef(null);
  const imageInputRef = useRef(null);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [imageLibraryOpen, setImageLibraryOpen] = useState(false);

  const initialContent = useMemo(
    () => normalizeRichTextHtml(String(value ?? "")),
    [value]
  );

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
      RichTextGoogleSheetsEmbed,
      RichTextFigmaEmbed,
      RichTextOdContainer,
      OdTabs,
      OdTabPanel,
      OdDisclosure,
      ...odRichColumnsExtensions,
    ],
    content: initialContent,
  });

  const { uploading, uploadAndInsert, insertLibraryImage } = useRichTextAttachmentEditor(editor);

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
    if (!editor) return undefined;
    let cancelled = false;

    (async () => {
      const raw = normalizeRichTextHtml(String(value ?? ""));
      const ids = extractAttachmentIdsFromHtml(raw);
      let next = raw;
      if (ids.length) {
        const urlById = await fetchSignedUrlsForAttachmentIds(ids);
        if (cancelled) return;
        next = hydrateHtmlAttachmentSrc(raw, urlById);
      }
      if (cancelled) return;
      if (normalizeHtml(editor.getHTML()) !== normalizeHtml(next)) {
        editor.commands.setContent(next, false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, value]);

  useEffect(() => {
    if (!editor || typeof onHtmlChange !== "function") return undefined;
    const onUpdate = () => {
      onHtmlChange(normalizeRichTextHtml(editor.getHTML()));
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, onHtmlChange]);

  function commitSave() {
    if (!editor) return;
    const html = stripAttachmentSrcFromHtml(normalizeRichTextHtml(editor.getHTML()));
    if (typeof onBlurSave === "function") onBlurSave(html);
  }

  function handleBlurCapture() {
    if (!saveOnBlur) return;
    setTimeout(() => {
      if (!rootRef.current) return;
      const active = document.activeElement;
      if (!active || !rootRef.current.contains(active)) {
        commitSave();
      }
    }, 0);
  }

  if (!editor) return null;

  const slashHandlers = {
    onPickImage: handlePickImage,
    onPickGoogleSheets: handlePickGoogleSheets,
    onPickFigma: handlePickFigma,
  };

  const editorChrome = (
    <>
      {enableSlashCommand ? (
        <RichTextSlashCommandMenu editor={editor} handlers={slashHandlers} />
      ) : null}
      <RichTextBubbleMenu editor={editor} inlineOnly />
      <RichTextImageBubbleMenu editor={editor} />
      <RichTextGoogleSheetsBubbleMenu editor={editor} />
      <RichTextFigmaBubbleMenu editor={editor} />
      <RichTextOdContainerBubbleMenu editor={editor} />
      <RichTextOdColumnsBubbleMenu editor={editor} />
      <div className="od-rich-text-editor__content-wrap">
        <EditorContent editor={editor} className="od-rich-text-editor__content" />
      </div>
    </>
  );

  return (
    <div
      ref={rootRef}
      className={`od-rich-text-editor${uploading ? " is-attachment-uploading" : ""}`}
      onBlurCapture={handleBlurCapture}
    >
      {showBlockSidebar ? (
        <RichTextBlockInsertMenu
          editor={editor}
          onPickImage={handlePickImage}
          onPickGoogleSheets={handlePickGoogleSheets}
          onPickFigma={handlePickFigma}
        >
          {editorChrome}
        </RichTextBlockInsertMenu>
      ) : (
        editorChrome
      )}
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
    </div>
  );
}
