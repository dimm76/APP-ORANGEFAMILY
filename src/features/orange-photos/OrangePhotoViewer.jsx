import { useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { shareSocialOutline } from "ionicons/icons";
import AttachmentsImageLightbox from "../../shared/components/AttachmentsImageLightbox.jsx";
import { orangePhotoDownloadUrl } from "../../shared/api/orangePhotosApi.js";
import { OD_ICONS } from "../../shared/ui/odIcons.js";
import OrangePhotoDetailsPanel from "./OrangePhotoDetailsPanel.jsx";
import OrangePhotoShareModal from "./OrangePhotoShareModal.jsx";

export default function OrangePhotoViewer({ photo, members, onClose, onSave, onShareSave, onTrash, onPrevious, onNext, hasPrevious, hasNext, positionLabel }) {
  const [infoOpen, setInfoOpen] = useState(false), [shareOpen, setShareOpen] = useState(false), [feedback, setFeedback] = useState(""), shareButtonRef = useRef(null);
  const displayTitle = photo.title?.trim() || photo.original_filename?.trim() || "Sin título";
  const notify = message => { setFeedback(message); window.setTimeout(() => setFeedback(""), 2000); };
  const save = async body => { setFeedback("Guardando…"); try { await onSave(body); notify("Cambios guardados"); } catch (error) { setFeedback(error.message); } };
  return <><AttachmentsImageLightbox viewer={{ url: photo.original_url || photo.preview_url || photo.thumbnail_url, poster: photo.poster_url || photo.thumbnail_url, mediaType: photo.media_type, title: displayTitle, positionLabel }} onClose={onClose} onPrevious={onPrevious} onNext={onNext} hasPrevious={hasPrevious} hasNext={hasNext} infoOpen={infoOpen} onToggleInfo={() => setInfoOpen(open => !open)} renderInfo={() => <OrangePhotoDetailsPanel photo={photo} members={members} onSave={save} feedback={feedback} />} renderExtraActions={() => <><button ref={shareButtonRef} className={`od-attachments-lightbox__btn${photo.visibility !== "private" ? " is-active" : ""}`} type="button" aria-label="Compartir" title="Compartir" onClick={() => setShareOpen(true)}><IonIcon icon={shareSocialOutline} /></button><a className="od-attachments-lightbox__btn" href={orangePhotoDownloadUrl(photo.id)} aria-label="Descargar" title="Descargar"><IonIcon icon={OD_ICONS.export} /></a>{photo.is_owner ? <button className="od-attachments-lightbox__btn od-attachments-lightbox__btn--danger" type="button" aria-label={photo.is_trashed ? "Restaurar" : "Mover a la papelera"} title={photo.is_trashed ? "Restaurar" : "Mover a la papelera"} onClick={onTrash}><IonIcon icon={OD_ICONS.delete} /></button> : null}</>} />{shareOpen ? <OrangePhotoShareModal photo={photo} members={members} returnFocusRef={shareButtonRef} onClose={() => setShareOpen(false)} onSave={async body => { await onShareSave(body); setShareOpen(false); notify("Compartición actualizada"); }} /> : null}</>;
}
