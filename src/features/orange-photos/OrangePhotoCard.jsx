/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../../shared/ui/odIcons.js";

let activePreview = null;
function formatDuration(value) {
  const total = Math.max(0, Math.round(Number(value)));
  if (!Number.isFinite(total)) return "";
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function OrangePhotoCard({ photo, selected, onSelect, onOpen, eager = false }) {
  const [previewing, setPreviewing] = useState(false), timerRef = useRef(null), videoRef = useRef(null), cardRef = useRef(null);
  const label = photo.title?.trim() || photo.original_filename?.trim() || "Sin título";
  const poster = photo.poster_url || photo.thumbnail_url || photo.preview_url;
  const gridUrl = photo.media_type === "video" ? poster : photo.preview_url || (Number(photo.thumbnail_width) >= 700 ? photo.thumbnail_url : photo.original_url) || photo.thumbnail_url;
  const stop = () => { clearTimeout(timerRef.current); const video = videoRef.current; if (video) { video.pause(); video.removeAttribute("src"); video.load(); } if (activePreview === stop) activePreview = null; setPreviewing(false); };
  const start = () => { if (photo.media_type !== "video" || !photo.original_url || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; timerRef.current = setTimeout(() => { activePreview?.(); activePreview = stop; setPreviewing(true); }, 350); };
  useEffect(() => () => stop(), []);
  useEffect(() => { if (!previewing || !videoRef.current) return; const video = videoRef.current, timeout = setTimeout(stop, 3000); video.src = photo.original_url; video.play().catch(stop); return () => clearTimeout(timeout); }, [previewing, photo.original_url]);
  return <article ref={cardRef} className={`od-orange-photo-card${selected ? " is-selected" : ""}`} onMouseEnter={start} onMouseLeave={stop}><button type="button" className="od-orange-photo-card__media" onClick={() => onOpen(photo)} aria-label={`Abrir ${label}`}>{previewing ? <video ref={videoRef} muted playsInline preload="metadata" /> : gridUrl ? <img src={gridUrl} alt={label} title={label} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "auto" : "low"} width={photo.width || undefined} height={photo.height || undefined} /> : <span className="od-orange-photo-card__video-placeholder"><IonIcon icon={OD_ICONS.timerRestart} /></span>}{photo.media_type === "video" ? <span className="od-orange-photo-card__video"><IonIcon icon={OD_ICONS.timerRestart} />{formatDuration(photo.duration_seconds)}</span> : null}</button><label className="od-orange-photo-card__selection"><input type="checkbox" checked={selected} onChange={() => onSelect(photo.id)} /><span className="od-orange-photo-card__sr">Seleccionar</span></label></article>;
}
