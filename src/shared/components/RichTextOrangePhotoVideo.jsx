/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { getOrangePhoto } from "../api/orangePhotosApi.js";

function OrangePhotoVideoView({ node, editor, getPos, selected }) {
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState("loading");
  const [errorCode, setErrorCode] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const photoId = node.attrs.photoId;

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    setPhoto(null);
    setErrorCode("");
    getOrangePhoto(photoId, { signal: controller.signal }).then((data) => {
      const item = data.item;
      if (!item || item.media_type !== "video") {
        setStatus("invalid");
        return;
      }
      setPhoto(item);
      setStatus("ready");
    }).catch((error) => {
      if (error.name === "AbortError") return;
      setErrorCode(error.code || "");
      setStatus("error");
    });
    return () => controller.abort();
  }, [photoId, retryKey]);

  const unavailable = errorCode === "NOT_FOUND" || errorCode === "FORBIDDEN";
  function selectNode(event) {
    if (event.target !== event.currentTarget || !editor.isEditable) return;
    event.preventDefault(); event.stopPropagation();
    const position = typeof getPos === "function" ? getPos() : null;
    if (Number.isInteger(position)) editor.commands.setNodeSelection(position);
  }
  return <NodeViewWrapper className={`od-orange-photo-video-embed${selected ? " is-selected" : ""}`} data-orange-photo-video="" contentEditable={false} onMouseDown={selectNode}>
    {status === "loading" ? <p className="od-status-line">Cargando vídeo…</p> : status === "invalid" ? <p className="od-status-line od-status-line--error">El elemento seleccionado ya no es un vídeo válido.</p> : status === "error" ? <div className="od-orange-photo-video-embed__state"><p className="od-status-line od-status-line--error">{unavailable ? "Este vídeo ya no está disponible o no tienes permiso para verlo." : "No se pudo cargar el vídeo."}</p><button type="button" className="od-btn od-btn-secondary" onClick={() => setRetryKey((value) => value + 1)}>Reintentar</button></div> : <div className="od-orange-photo-video-embed__player"><video controls preload="metadata" playsInline poster={photo.poster_url || photo.thumbnail_url || undefined} src={photo.original_url || photo.preview_url} /></div>}
  </NodeViewWrapper>;
}

export const RichTextOrangePhotoVideo = Node.create({
  name: "orangePhotoVideo",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      photoId: { default: null, parseHTML: (element) => element.getAttribute("data-photo-id"), renderHTML: () => ({}) },
      aspectRatio: { default: "16/9", parseHTML: (element) => element.getAttribute("data-aspect-ratio") || "16/9", renderHTML: () => ({}) },
    };
  },
  parseHTML() { return [{ tag: "div[data-orange-photo-video]" }]; },
  renderHTML({ node, HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-orange-photo-video": "", "data-photo-id": node.attrs.photoId, "data-aspect-ratio": node.attrs.aspectRatio })];
  },
  addCommands() {
    return { setOrangePhotoVideo: (options) => ({ commands }) => {
      const photoId = String(options?.photoId || "").trim();
      if (!photoId || options?.aspectRatio !== "16/9") return false;
      return commands.insertContent({ type: this.name, attrs: { photoId, aspectRatio: "16/9" } });
    } };
  },
  addNodeView() { return ReactNodeViewRenderer(OrangePhotoVideoView); },
});
