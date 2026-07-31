import { useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import AttachmentsImageLightbox from "./AttachmentsImageLightbox.jsx";

function getVisibleEditorImages(editor, currentImage) {
  const editorDom = editor?.view?.dom;

  if (!(editorDom instanceof HTMLElement)) {
    return null;
  }

  const elements = [
    ...editorDom.querySelectorAll("img.od-rich-attachment-image"),
  ].filter((element) => {
    if (!(element instanceof HTMLImageElement)) {
      return false;
    }

    const src = String(element.currentSrc || element.src || "").trim();

    if (!src) {
      return false;
    }

    if (element.closest('[aria-hidden="true"]')) {
      return false;
    }

    return element.getClientRects().length > 0;
  });

  const index = elements.findIndex((element) => element === currentImage);

  if (index < 0) {
    return null;
  }

  return {
    index,
    items: elements.map((element) => {
      const title = String(element.title || element.alt || "Imagen").trim() || "Imagen";

      return {
        url: String(element.currentSrc || element.src).trim(),
        title,
      };
    }),
  };
}

export default function RichTextAttachmentImageView({ editor, node, selected }) {
  const [gallery, setGallery] = useState(null);

  const width = Math.min(
    100,
    Math.max(25, Number(node.attrs.displayWidth) || 100)
  );

  const viewer = gallery?.items?.[gallery.index] ?? null;

  function openReadonlyViewer(event) {
    if (editor?.isEditable) {
      return;
    }

    const src = String(node.attrs.src || "").trim();

    if (!src) {
      return;
    }

    const nextGallery = getVisibleEditorImages(editor, event.currentTarget);

    if (!nextGallery) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    setGallery(nextGallery);
  }

  function closeViewer() {
    setGallery(null);
  }

  function showPrevious() {
    setGallery((current) => {
      if (!current || current.index <= 0) {
        return current;
      }

      return {
        ...current,
        index: current.index - 1,
      };
    });
  }

  function showNext() {
    setGallery((current) => {
      if (!current || current.index >= current.items.length - 1) {
        return current;
      }

      return {
        ...current,
        index: current.index + 1,
      };
    });
  }

  const lightboxViewer = viewer
    ? {
        ...viewer,
        positionLabel:
          gallery.items.length > 1
            ? `${gallery.index + 1} de ${gallery.items.length} · ${viewer.title}`
            : viewer.title,
      }
    : null;

  return (
    <NodeViewWrapper
      className={`od-editor-block od-rich-attachment-image-view${
        selected ? " is-selected" : ""
      }`}
      style={{ width: `${width}%` }}
    >
      <img
        className="od-rich-attachment-image"
        src={node.attrs.src || undefined}
        alt={node.attrs.alt || ""}
        title={node.attrs.title || undefined}
        onClick={openReadonlyViewer}
      />

      <AttachmentsImageLightbox
        viewer={lightboxViewer}
        onClose={closeViewer}
        onPrevious={showPrevious}
        onNext={showNext}
        hasPrevious={Boolean(gallery) && gallery.index > 0}
        hasNext={Boolean(gallery) && gallery.index < gallery.items.length - 1}
      />
    </NodeViewWrapper>
  );
}
