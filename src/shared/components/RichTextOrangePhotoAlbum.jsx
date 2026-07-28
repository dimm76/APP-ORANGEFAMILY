/* eslint-disable react-hooks/set-state-in-effect, react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { IonIcon } from "@ionic/react";
import { listOrangeAlbums, listOrangeAlbumPhotos } from "../api/orangePhotosApi.js";
import { OD_ICONS } from "../ui/odIcons.js";
import AttachmentsImageLightbox from "./AttachmentsImageLightbox.jsx";

const HEIGHTS = new Set(["compact", "normal", "large"]);

function OrangePhotoAlbumView({ node, editor, getPos, selected }) {
  const albumId = node.attrs.albumId;
  const height = HEIGHTS.has(node.attrs.height) ? node.attrs.height : "normal";
  const [album, setAlbum] = useState(null);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [errorCode, setErrorCode] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerId, setViewerId] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const pageControllerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading"); setAlbum(null); setItems([]); setPage(1); setHasMore(false); setErrorCode(""); setViewerId(null);
    Promise.all([listOrangeAlbums({ signal: controller.signal }), listOrangeAlbumPhotos(albumId, { page: 1, signal: controller.signal })]).then(([albumData, photoData]) => {
      const match = (albumData.items || []).find((candidate) => candidate.id === albumId);
      if (!match) { setStatus("unavailable"); return; }
      setAlbum(match); setItems(photoData.items || []); setHasMore(photoData.has_more === true); setStatus("ready");
    }).catch((error) => {
      if (error.name === "AbortError") return;
      setErrorCode(error.code || ""); setStatus("error");
    });
    return () => { controller.abort(); pageControllerRef.current?.abort(); };
  }, [albumId, retryKey]);

  async function loadMore() {
    pageControllerRef.current?.abort();
    const controller = new AbortController();
    pageControllerRef.current = controller;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await listOrangeAlbumPhotos(albumId, { page: nextPage, signal: controller.signal });
      setItems((current) => { const byId = new Map(current.map((item) => [item.id, item])); for (const item of data.items || []) byId.set(item.id, item); return [...byId.values()]; });
      setPage(nextPage); setHasMore(data.has_more === true);
    } catch (error) { if (error.name !== "AbortError") { setErrorCode(error.code || ""); setStatus("error"); } } finally { if (!controller.signal.aborted) setLoadingMore(false); }
  }

  const viewerIndex = useMemo(() => items.findIndex((item) => item.id === viewerId), [items, viewerId]);
  const viewer = viewerIndex >= 0 ? items[viewerIndex] : null;
  const unavailable = status === "unavailable" || errorCode === "NOT_FOUND" || errorCode === "FORBIDDEN";
  function selectNode(event) {
    if (!editor.isEditable) return;
    event.preventDefault(); event.stopPropagation();
    const position = typeof getPos === "function" ? getPos() : null;
    if (Number.isInteger(position)) editor.commands.setNodeSelection(position);
  }
  return <NodeViewWrapper className={`od-orange-photo-album-embed is-${height}${selected ? " is-selected" : ""}`} data-orange-photo-album="" contentEditable={false} onMouseDown={(event) => { if (event.target === event.currentTarget) selectNode(event); }}>
    <header className="od-orange-photo-album-embed__header" onMouseDown={selectNode}><span className="od-orange-photo-album-embed__identity"><IonIcon icon={OD_ICONS.richImage} aria-hidden="true" /><span><strong>{album?.title || "Álbum de Orange Photos"}</strong>{album ? <small>{album.photo_count || 0} elementos</small> : null}</span></span></header>
    <div className="od-orange-photo-album-embed__content">{status === "loading" ? <p className="od-status-line">Cargando álbum…</p> : unavailable ? <div><p className="od-status-line od-status-line--error">Este álbum ya no está disponible o no tienes permiso para verlo.</p><button type="button" className="od-btn od-btn-secondary" onClick={() => setRetryKey((value) => value + 1)}>Reintentar</button></div> : status === "error" ? <div><p className="od-status-line od-status-line--error">No se pudo cargar el álbum.</p><button type="button" className="od-btn od-btn-secondary" onClick={() => setRetryKey((value) => value + 1)}>Reintentar</button></div> : !items.length ? <p className="od-status-line">Este álbum no contiene fotos ni vídeos.</p> : <><div className="od-orange-photo-album-embed__grid">{items.map((photo) => { const src = photo.thumbnail_url || photo.poster_url || photo.preview_url; return <button type="button" className="od-orange-photo-album-embed__item" key={photo.id} aria-label={`Abrir ${photo.title || photo.original_filename || "Sin título"}`} onClick={(event) => { event.stopPropagation(); setViewerId(photo.id); }}>{src ? <img src={src} alt="" loading="lazy" /> : <span className="od-orange-photo-album-embed__placeholder" />}{photo.media_type === "video" ? <span className="od-orange-photo-album-embed__video"><IonIcon icon={OD_ICONS.richVideo} /></span> : null}</button>; })}</div>{hasMore ? <button type="button" className="od-btn od-btn-secondary od-orange-photo-album-embed__more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Cargando…" : "Cargar más"}</button> : null}</>}</div>
    {viewer ? <AttachmentsImageLightbox viewer={{ url: viewer.original_url || viewer.preview_url || viewer.thumbnail_url, poster: viewer.poster_url || viewer.thumbnail_url, mediaType: viewer.media_type, title: viewer.title || viewer.original_filename || "Sin título", positionLabel: `${viewerIndex + 1} de ${items.length}` }} onClose={() => setViewerId(null)} onPrevious={() => setViewerId(items[viewerIndex - 1].id)} onNext={() => setViewerId(items[viewerIndex + 1].id)} hasPrevious={viewerIndex > 0} hasNext={viewerIndex < items.length - 1} /> : null}
  </NodeViewWrapper>;
}

export const RichTextOrangePhotoAlbum = Node.create({
  name: "orangePhotoAlbum", group: "block", atom: true, selectable: true, draggable: true, isolating: true,
  addAttributes() { return { albumId: { default: null, parseHTML: (element) => element.getAttribute("data-album-id"), renderHTML: () => ({}) }, height: { default: "normal", parseHTML: (element) => element.getAttribute("data-height") || "normal", renderHTML: () => ({}) } }; },
  parseHTML() { return [{ tag: "div[data-orange-photo-album]" }]; },
  renderHTML({ node, HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-orange-photo-album": "", "data-album-id": node.attrs.albumId, "data-height": node.attrs.height })]; },
  addCommands() { return { setOrangePhotoAlbum: (options) => ({ commands }) => { const albumId = String(options?.albumId || "").trim(); const height = String(options?.height || ""); if (!albumId || !HEIGHTS.has(height)) return false; return commands.insertContent({ type: this.name, attrs: { albumId, height } }); } }; },
  addNodeView() { return ReactNodeViewRenderer(OrangePhotoAlbumView); },
});
