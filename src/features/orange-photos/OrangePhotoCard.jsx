/* eslint-disable react-hooks/exhaustive-deps */
import { memo, useEffect, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { checkmarkOutline, people as peopleOutline, searchCircleOutline } from "ionicons/icons";
import { OD_ICONS } from "../../shared/ui/odIcons.js";

let activePreview = null;
function formatDuration(value) {
  const total = Math.max(1, Math.round(Number(value)));
  if (!Number.isFinite(total)) return "";
  const hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), seconds = total % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function OrangePhotoCard({ photo, selectionMode, selected, onSelect, onOpen, eager = false }) {
  const [previewing, setPreviewing] = useState(false), [hoverDuration,setHoverDuration]=useState(null), [mediaCandidateIndex,setMediaCandidateIndex]=useState(0), timerRef = useRef(null), videoRef = useRef(null), cardRef = useRef(null);
  const label = photo.title?.trim() || photo.original_filename?.trim() || "Sin tÃ­tulo";
  const storedDuration=Number(photo.duration_seconds);
  const effectiveDuration=Number.isFinite(storedDuration)&&storedDuration>0?storedDuration:Number.isFinite(hoverDuration)&&hoverDuration>0?hoverDuration:null;
  const previewUrl=photo.media_type==="video"?photo.video_preview_url:null;
  const mediaCandidates=[...new Set((photo.media_type==="video"?[photo.thumbnail_url,photo.poster_url]:[photo.thumbnail_url,photo.preview_url,photo.original_url]).filter(Boolean))];
  const gridUrl=mediaCandidates[mediaCandidateIndex]||null;
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
  const start = () => {
    if (!previewUrl) {
      console.warn("OrangePhotos preview unavailable", {
        photo_id: photo.id,
        filename: photo.original_filename,
        has_video_preview_url: false,
      });
      return;
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (activePreview && activePreview !== stop) activePreview();
      activePreview = stop;
      setPreviewing(true);
    }, 350);
  };
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
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMediaCandidateIndex(0);
  }, [photo.id,photo.thumbnail_url,photo.poster_url,photo.preview_url,photo.original_url]);
  useEffect(() => {
    if (!previewing) return;
    console.debug("OrangePhotos preview mounted", {
      photo_id: photo.id,
      filename: photo.original_filename,
      has_video_preview_url: Boolean(previewUrl),
    });
  }, [previewing, photo.id, photo.original_filename, previewUrl]);
  const sharedNames=(photo.shared_people||[]).map(person=>typeof person==="string"?person:person.display_name).filter(Boolean),oldShareTitle=!photo.is_owner?`Compartida por ${photo.shared_by_display_name||photo.owner_display_name}`:photo.share_kind==="family"?"Compartida con toda la familia":photo.share_kind==="selected"?`Compartida con ${sharedNames.join(", ")}`:"",sharedAlbums=photo.shared_via_albums||[],albumNames=sharedAlbums.map(album=>`Â«${album.title}Â»`),albumText=albumNames.length===1?`el Ã¡lbum ${albumNames[0]}`:`los Ã¡lbumes ${albumNames.join(", ")}`,directlyShared=photo.is_shared_directly??Boolean(photo.share_kind),viaAlbum=photo.is_shared_via_album??sharedAlbums.length>0,ownerName=photo.shared_by_display_name||photo.owner_display_name,shareTitle=photo.is_owner?(directlyShared&&viaAlbum?`Compartida directamente y mediante ${albumText}`:viaAlbum?`Compartida mediante ${albumText}`:oldShareTitle):(viaAlbum?`Compartida por ${ownerName}${directlyShared?" directamente y":""} mediante ${albumText}`:oldShareTitle),effectivelyShared=photo.is_shared_effectively??Boolean(oldShareTitle);
  const handleMediaClick = event => { if (selectionMode) { onSelect(photo.id,event); return; } onOpen(photo); };
  return <article ref={cardRef} className={`od-orange-photo-card${selected ? " is-selected" : ""}${selectionMode ? " is-selection-mode" : ""}`} onMouseEnter={start} onMouseLeave={stop}><button type="button" className="od-orange-photo-card__media" onClick={handleMediaClick} aria-label={`Abrir ${label}`}>{previewing ? <video key={previewUrl} ref={videoRef} src={previewUrl} muted autoPlay playsInline preload="auto" controls={false} disablePictureInPicture disableRemotePlayback controlsList="nodownload noplaybackrate noremoteplayback" onLoadedMetadata={event=>{const video=event.currentTarget;const duration=Number(video.duration);if((!Number(photo.duration_seconds)||Number(photo.duration_seconds)<=0)&&Number.isFinite(duration)&&duration>0)setHoverDuration(duration);video.currentTime=0;video.play().catch(error=>{console.warn("OrangePhotos preview play",{photo_id:photo.id,name:error?.name||null,message:error?.message||null});});}} onPlaying={()=>{console.debug("OrangePhotos preview playing",{photo_id:photo.id});}} onTimeUpdate={event=>{if(event.currentTarget.currentTime>=3)stop();}} onEnded={stop} onError={event=>{const video=event.currentTarget;console.warn("OrangePhotos preview error",{photo_id:photo.id,media_error_code:video.error?.code||null,media_error_message:video.error?.message||null,ready_state:video.readyState,network_state:video.networkState,has_preview_url:Boolean(previewUrl)});stop();}} /> : gridUrl ? <img src={gridUrl} alt="" title={label} loading="eager" fetchPriority={eager?"high":"auto"} width={photo.width||undefined} height={photo.height||undefined} onError={()=>setMediaCandidateIndex(current=>current+1)} /> : photo.media_type === "video" ? <span className="od-orange-photo-card__video-placeholder"><IonIcon icon={OD_ICONS.timerRestart} /></span> : <span className="od-orange-photo-card__loading-placeholder" aria-hidden="true"/>}{photo.media_type === "video" ? <span className="od-orange-photo-card__video"><IonIcon icon={OD_ICONS.timerRestart} />{effectiveDuration ? formatDuration(effectiveDuration) : null}</span> : null}</button>{effectivelyShared&&shareTitle?<span className={`od-orange-photo-card__share od-orange-photo-card__share--${photo.is_owner?"owned":"received"}`} title={shareTitle} aria-label={shareTitle}><IonIcon icon={peopleOutline}/></span>:null}<label className={`od-orange-photo-card__selection-control${selected ? " is-selected" : ""}`} onClick={event => {event.stopPropagation();onSelect(photo.id,event);}}><input className="od-orange-photo-card__selection-input" type="checkbox" checked={selected} onChange={()=>{}} /><span className="od-orange-photo-card__selection-circle" aria-hidden="true">{selected ? <IonIcon icon={checkmarkOutline} /> : null}</span><span className="od-orange-photo-card__sr">Seleccionar</span></label><button type="button" className="od-orange-photo-card__inspect" aria-label={`Abrir ${label}`} title="Abrir" onClick={event => { event.stopPropagation(); onOpen(photo); }}><IonIcon icon={searchCircleOutline} /></button></article>;
}

export default memo(OrangePhotoCard);
