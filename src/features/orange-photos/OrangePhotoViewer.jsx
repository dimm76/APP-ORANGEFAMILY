import { useRef, useState } from "react";
import AttachmentsImageLightbox from "../../shared/components/AttachmentsImageLightbox.jsx";
import OrangePhotoDetailsPanel from "./OrangePhotoDetailsPanel.jsx";
import OrangePhotoShareModal from "./OrangePhotoShareModal.jsx";

export default function OrangePhotoViewer({ photo, members, onClose, onSave, onShareSave, onTrash, onPrevious, onNext, hasPrevious, hasNext, positionLabel }) {
  const [infoOpen, setInfoOpen] = useState(false), [shareOpen, setShareOpen] = useState(false), shareButtonRef = useRef(null);
  const displayTitle = photo.title?.trim() || photo.original_filename?.trim() || "Sin título";
  return <><AttachmentsImageLightbox viewer={{ url: photo.original_url || photo.preview_url || photo.thumbnail_url, poster: photo.poster_url || photo.thumbnail_url, mediaType: photo.media_type, title: displayTitle, positionLabel }} onClose={onClose} onPrevious={onPrevious} onNext={onNext} hasPrevious={hasPrevious} hasNext={hasNext} infoOpen={infoOpen} onToggleInfo={() => setInfoOpen(open => !open)} renderInfo={() => <OrangePhotoDetailsPanel photo={photo} onSave={onSave} />} renderExtraActions={() => <><button ref={shareButtonRef} className="od-attachments-lightbox__action" type="button" onClick={() => setShareOpen(true)}>Compartir</button>{photo.is_owner ? <button className="od-attachments-lightbox__action" type="button" onClick={onTrash}>{photo.is_trashed ? "Restaurar" : "Papelera"}</button> : null}<a className="od-attachments-lightbox__action" href={photo.original_url || photo.preview_url} download>Descargar</a></>} />{shareOpen ? <OrangePhotoShareModal photo={photo} members={members} returnFocusRef={shareButtonRef} onClose={() => setShareOpen(false)} onSave={async body => { await onShareSave(body); setShareOpen(false); }} /> : null}</>;
}
