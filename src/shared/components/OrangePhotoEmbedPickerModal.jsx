/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { listOrangeAlbums, listOrangePhotoVideos } from "../api/orangePhotosApi.js";

function resourceTitle(resource, mode) {
  if (mode === "album") return resource.title || "Álbum sin título";
  return resource.title || resource.original_filename || "Vídeo sin título";
}

export default function OrangePhotoEmbedPickerModal({ open, mode, selectedId, onClose, onConfirm }) {
  const [items, setItems] = useState([]);
  const [selection, setSelection] = useState(selectedId || null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const pageControllerRef = useRef(null);

  useEffect(() => {
    if (!open || !mode) return undefined;
    const controller = new AbortController();
    setSelection(selectedId || null);
    setQuery("");
    setItems([]);
    setPage(1);
    setHasMore(false);
    setError("");
    setLoading(true);
    const request = mode === "album"
      ? listOrangeAlbums({ signal: controller.signal })
      : listOrangePhotoVideos({ page: 1, signal: controller.signal });
    request.then((data) => {
      const next = (data.items || []).filter((item) => mode !== "video" || item.media_type === "video");
      setItems(next);
      setHasMore(mode === "video" && data.has_more === true);
    }).catch((requestError) => {
      if (requestError.name !== "AbortError") setError(requestError.message || "No se pudieron cargar los recursos.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => { controller.abort(); pageControllerRef.current?.abort(); };
  }, [open, mode, selectedId, retryKey]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    if (!needle) return items;
    return items.filter((item) => resourceTitle(item, mode).toLocaleLowerCase("es").includes(needle));
  }, [items, mode, query]);

  async function loadMore() {
    const nextPage = page + 1;
    pageControllerRef.current?.abort();
    const controller = new AbortController();
    pageControllerRef.current = controller;
    setLoadingMore(true);
    setError("");
    try {
      const data = await listOrangePhotoVideos({ page: nextPage, signal: controller.signal });
      setItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of data.items || []) if (item.media_type === "video") byId.set(item.id, item);
        return [...byId.values()];
      });
      setPage(nextPage);
      setHasMore(data.has_more === true);
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "No se pudieron cargar más vídeos.");
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  if (!open || !mode || typeof document === "undefined") return null;
  const isAlbum = mode === "album";
  const selected = items.find((item) => item.id === selection);
  return createPortal(
    <div className="od-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="od-modal od-orange-photo-embed-picker" role="dialog" aria-modal="true" aria-labelledby="od-orange-photo-picker-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="od-modal-header">
          <h2 id="od-orange-photo-picker-title" className="od-modal-title">{isAlbum ? "Seleccionar álbum de Orange Photos" : "Seleccionar vídeo de Orange Photos"}</h2>
          <button type="button" className="od-modal-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        <div className="od-modal-body">
          <input className="od-filter-search-input od-orange-photo-embed-picker__search" type="search" placeholder={isAlbum ? "Buscar álbum" : "Buscar vídeo"} value={query} onChange={(event) => setQuery(event.target.value)} />
          {loading ? <p className="od-status-line">Cargando…</p> : error && !items.length ? <div><p className="od-status-line od-status-line--error">{error}</p><button type="button" className="od-btn od-btn-secondary" onClick={() => setRetryKey((value) => value + 1)}>Reintentar</button></div> : !items.length ? <p className="od-status-line">{isAlbum ? "No hay álbumes disponibles." : "No hay vídeos disponibles."}</p> : !filtered.length ? <p className="od-status-line">No hay resultados para esta búsqueda.</p> : <div className="od-orange-photo-embed-picker__list" role="radiogroup">{filtered.map((item) => {
            const image = isAlbum ? item.cover_thumbnail_url : item.poster_url || item.thumbnail_url;
            const shared = item.is_owner === true ? "Propio" : "Compartido";
            return <button type="button" role="radio" aria-checked={selection === item.id} className={`od-orange-photo-embed-picker__item${selection === item.id ? " is-selected" : ""}`} key={item.id} onClick={() => setSelection(item.id)}>{image ? <img src={image} alt="" /> : <span className="od-orange-photo-embed-picker__placeholder" aria-hidden="true" />}<span><strong>{resourceTitle(item, mode)}</strong><small>{isAlbum ? `${item.photo_count || 0} elementos · ${shared}` : item.captured_at ? new Date(item.captured_at).toLocaleDateString("es-ES") : "Vídeo"}</small></span></button>;
          })}</div>}
          {mode === "video" && hasMore ? <button type="button" className="od-btn od-btn-secondary od-orange-photo-embed-picker__more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? "Cargando…" : "Cargar más"}</button> : null}
          {error && items.length ? <p className="od-status-line od-status-line--error">{error}</p> : null}
          <div className="od-modal-actions"><button type="button" className="od-btn od-btn-secondary" onClick={onClose}>Cancelar</button><button type="button" className="od-btn od-btn-primary" disabled={!selected} onClick={() => { onConfirm?.(selected); onClose?.(); }}>{selectedId ? "Aplicar" : isAlbum ? "Insertar álbum" : "Insertar vídeo"}</button></div>
        </div>
      </section>
    </div>, document.body
  );
}
