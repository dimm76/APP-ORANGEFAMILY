import { useCallback, useEffect, useState } from "react";
import { linkAttachmentToEntity, uploadAttachmentImage } from "../api/attachmentsApi.js";

/**
 * Paste/drop de imágenes en editores Tiptap (subida antes de insertar nodo).
 * La hidratación al cargar contenido la gestiona cada editor en su efecto de `value`.
 * @param {import("@tiptap/react").Editor | null} editor
 */
export function useRichTextAttachmentEditor(editor, context = {}) {
  const [uploading, setUploading] = useState(false);

  const insertUploadedImage = useCallback((editorInstance, payload) => {
    if (!editorInstance || !payload?.id) return;
    editorInstance
      .chain()
      .focus()
      .setImage({
        attachmentId: payload.id,
        src: payload.signed_url,
        alt: payload.original_filename || "",
        displayWidth: 100,
      })
      .run();
  }, []);

  const uploadAndInsert = useCallback(
    async (file) => {
      if (!editor || !file) return;
      setUploading(true);
      try {
        const payload = await uploadAttachmentImage(file);
        insertUploadedImage(editor, payload);
      } finally {
        setUploading(false);
      }
    },
    [editor, insertUploadedImage]
  );

  const insertLibraryImage = useCallback(
    async (image) => {
      if (!editor || !image?.id || !image?.url) return;

      let imageToInsert = image;
      if (context.entityType && context.entityId) {
        imageToInsert = await linkAttachmentToEntity({
          attachmentId: image.id,
          entityType: context.entityType,
          entityId: context.entityId,
          fieldKey: context.fieldKey,
        });
      }

      if (!imageToInsert?.url) {
        throw new Error("La imagen seleccionada no tiene URL renderizable.");
      }

      editor
        .chain()
        .focus()
        .setImage({
          attachmentId: imageToInsert.id,
          src: imageToInsert.url,
          alt: imageToInsert.alt || imageToInsert.filename || "",
          displayWidth: 100,
        })
        .run();
    },
    [context.entityId, context.entityType, context.fieldKey, editor]
  );

  useEffect(() => {
    if (!editor) return undefined;

    const onPaste = (event) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (!item.type.startsWith("image/")) continue;
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        event.stopPropagation();
        void uploadAndInsert(file);
        return;
      }
    };

    const onDrop = (event) => {
      const files = event.dataTransfer?.files;
      if (!files?.length) return;
      const imageFile = [...files].find((f) => f.type.startsWith("image/"));
      if (!imageFile) return;
      event.preventDefault();
      event.stopPropagation();
      void uploadAndInsert(imageFile);
    };

    const root = editor.view?.dom;
    if (!root) return undefined;
    root.addEventListener("paste", onPaste, true);
    root.addEventListener("drop", onDrop, true);
    return () => {
      root.removeEventListener("paste", onPaste, true);
      root.removeEventListener("drop", onDrop, true);
    };
  }, [editor, uploadAndInsert]);

  return { uploading, uploadAndInsert, insertLibraryImage };
}
