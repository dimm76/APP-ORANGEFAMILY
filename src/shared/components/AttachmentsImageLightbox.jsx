/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import { chevronBackOutline, chevronForwardOutline, informationCircleOutline } from "ionicons/icons";
import { OD_ICONS } from "../ui/odIcons.js";

const MARGIN = 48, TOOLBAR = 56, ZOOM_MIN = 0.25, ZOOM_MAX = 4, ZOOM_STEP = 1.25;
function fitScale(width, height) { if (!width || !height) return 1; return Math.min(Math.max(120, window.innerWidth - MARGIN) / width, Math.max(120, window.innerHeight - TOOLBAR - MARGIN) / height, 1); }

export default function AttachmentsImageLightbox({ viewer, onClose, onPrevious, onNext, hasPrevious = false, hasNext = false, renderInfo, infoOpen = false, onToggleInfo, renderExtraActions }) {
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const stageRef = useRef(null);
  const resetView = useCallback(() => { setZoom(1); setNatural({ w: 0, h: 0 }); if (stageRef.current) { stageRef.current.scrollLeft = 0; stageRef.current.scrollTop = 0; } }, []);
  const close = useCallback(() => { resetView(); onClose?.(); }, [onClose, resetView]);
  const size = useMemo(() => natural.w && natural.h ? { width: Math.round(natural.w * fitScale(natural.w, natural.h) * zoom), height: Math.round(natural.h * fitScale(natural.w, natural.h) * zoom) } : null, [natural, zoom]);
  const move = useCallback(direction => { resetView(); direction === "previous" ? onPrevious?.() : onNext?.(); }, [onNext, onPrevious, resetView]);
  useEffect(() => { if (!viewer) return undefined; resetView(); const key = event => { if (event.key === "Escape") close(); if (event.key === "ArrowLeft" && hasPrevious) move("previous"); if (event.key === "ArrowRight" && hasNext) move("next"); }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [viewer, close, hasPrevious, hasNext, move, resetView]);
  if (!viewer || typeof document === "undefined") return null;
  const title = viewer.title || viewer.filename || "Imagen";
  const isVideo = viewer.mediaType === "video" || viewer.media_type === "video";
  const zoomTitle = `${Math.round(zoom * 100)}%`;
  return createPortal(<div className={`od-attachments-lightbox${infoOpen ? " is-info-open" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><div className="od-attachments-lightbox__toolbar" onMouseDown={event => event.stopPropagation()}><p className="od-attachments-lightbox__title">{viewer.positionLabel || title}</p><div className="od-attachments-lightbox__controls">{renderExtraActions?.()}{!isVideo ? <><button type="button" className="od-attachments-lightbox__btn" aria-label="Reducir zoom" title={zoomTitle} onClick={() => setZoom(value => Math.max(value / ZOOM_STEP, ZOOM_MIN))}>−</button><button type="button" className="od-attachments-lightbox__btn" aria-label="Ampliar zoom" title={zoomTitle} onClick={() => setZoom(value => Math.min(value * ZOOM_STEP, ZOOM_MAX))}><IonIcon icon={OD_ICONS.add} /></button><button type="button" className="od-attachments-lightbox__btn" aria-label="Ajustar a pantalla" title="Ajustar a pantalla" onClick={resetView}><IonIcon icon={OD_ICONS.collapseSections} /></button></> : null}{renderInfo ? <button type="button" className="od-attachments-lightbox__btn" aria-label="Información" onClick={onToggleInfo}><IonIcon icon={informationCircleOutline} /></button> : null}<button type="button" className="od-attachments-lightbox__btn od-attachments-lightbox__btn--close" aria-label="Cerrar" onClick={close}><IonIcon icon={OD_ICONS.bulkExit} /></button></div></div><button type="button" className="od-attachments-lightbox__nav od-attachments-lightbox__nav--previous" aria-label="Anterior" disabled={!hasPrevious} onClick={() => move("previous")}><IonIcon icon={chevronBackOutline} /></button><div ref={stageRef} className="od-attachments-lightbox__stage">{isVideo ? <video className="od-attachments-lightbox__video" src={viewer.url} poster={viewer.poster || undefined} controls onMouseDown={event => event.stopPropagation()} /> : <img src={viewer.url} alt={title} className="od-attachments-lightbox__img" style={size || undefined} onLoad={event => setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })} onMouseDown={event => event.stopPropagation()} />}</div><button type="button" className="od-attachments-lightbox__nav od-attachments-lightbox__nav--next" aria-label="Siguiente" disabled={!hasNext} onClick={() => move("next")}><IonIcon icon={chevronForwardOutline} /></button>{infoOpen && renderInfo ? <aside className="od-attachments-lightbox__info">{renderInfo()}</aside> : null}</div>, document.body);
}
