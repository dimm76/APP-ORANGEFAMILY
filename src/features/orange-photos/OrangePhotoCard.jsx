/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { checkmarkOutline, searchCircleOutline } from "ionicons/icons";
import { OD_ICONS } from "../../shared/ui/odIcons.js";

let activePreview = null;
function formatDuration(value) {
  const total = Math.max(1, Math.round(Number(value)));
  if (!Number.isFinite(total)) return "";
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function OrangePhotoCard({ photo, selectionMode, selected, onSelect, onOpen, eager = false }) {
  const [previewing, setPreviewing] = useState(false), [hoverDuration,setHoverDuration]=useState(null), timerRef = useRef(null), videoRef = useRef(null), cardRef = useRef(null);
  const label = photo.title?.trim() || photo.original_filename?.trim() || "Sin título";
  const poster = photo.poster_url || photo.thumbnail_url || photo.preview_url;
  const storedDuration=Number(photo.duration_seconds);
  const effectiveDuration=Number.isFinite(storedDuration)&&storedDuration>0?storedDuration:Number.isFinite(hoverDuration)&&hoverDuration>0?hoverDuration:null;
  const previewUrl=photo.media_type==="video"?photo.video_preview_url:null;
  const gridUrl = photo.media_type === "video" ? poster : photo.preview_url || (Number(photo.thumbnail_width) >= 700 ? photo.thumbnail_url : photo.original_url) || photo.thumbnail_url;
  const stop = () => {
    window.clearTimeout(timerRef.current);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (activePreview === stop) activePreview = null;
    setPreviewing(false);
  };
  const start = () => { if (!previewUrl || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; timerRef.current = setTimeout(() => { activePreview?.(); activePreview = stop; setPreviewing(true); }, 350); };
  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    if (activePreview === stop) activePreview = null;
  }, []);
  const handleMediaClick = () => { if (selectionMode) { onSelect(photo.id); return; } onOpen(photo); };
  return <article ref={cardRef} className={`od-orange-photo-card${selected ? " is-selected" : ""}${selectionMode ? " is-selection-mode" : ""}`} onMouseEnter={start} onMouseLeave={stop}><button type="button" className="od-orange-photo-card__media" onClick={handleMediaClick} aria-label={`Abrir ${label}`}>{previewing ? <video ref={videoRef} src={previewUrl} muted playsInline preload="metadata" controls={false} onLoadedMetadata={event=>{const duration=Number(event.currentTarget.duration);if(Number.isFinite(duration)&&duration>0)setHoverDuration(duration);}} onCanPlay={event=>{event.currentTarget.play().catch(()=>stop());}} onTimeUpdate={event=>{if(event.currentTarget.currentTime>=3)stop();}} onError={()=>stop()} /> : gridUrl ? <img src={gridUrl} alt={label} title={label} loading={eager ? "eager" : "lazy"} decoding="async" fetchPriority={eager ? "auto" : "low"} width={photo.width || undefined} height={photo.height || undefined} /> : <span className="od-orange-photo-card__video-placeholder"><IonIcon icon={OD_ICONS.timerRestart} /></span>}{photo.media_type === "video" ? <span className="od-orange-photo-card__video"><IonIcon icon={OD_ICONS.timerRestart} />{effectiveDuration ? formatDuration(effectiveDuration) : null}</span> : null}</button><label className={`od-orange-photo-card__selection-control${selected ? " is-selected" : ""}`} onClick={event => event.stopPropagation()}><input className="od-orange-photo-card__selection-input" type="checkbox" checked={selected} onChange={() => onSelect(photo.id)} /><span className="od-orange-photo-card__selection-circle" aria-hidden="true">{selected ? <IonIcon icon={checkmarkOutline} /> : null}</span><span className="od-orange-photo-card__sr">Seleccionar</span></label><button type="button" className="od-orange-photo-card__inspect" aria-label={`Abrir ${label}`} title="Abrir" onClick={event => { event.stopPropagation(); onOpen(photo); }}><IonIcon icon={searchCircleOutline} /></button></article>;
}
