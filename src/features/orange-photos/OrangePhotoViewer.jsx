import { useState } from "react";
import AttachmentsImageLightbox from "../../shared/components/AttachmentsImageLightbox.jsx";
import OrangePhotoDetailsPanel from "./OrangePhotoDetailsPanel.jsx";

export default function OrangePhotoViewer({photo,onClose,onSave,onShare,onTrash,onPrevious,onNext,hasPrevious,hasNext,positionLabel}){
  const [infoOpen,setInfoOpen]=useState(false);
  return <AttachmentsImageLightbox viewer={{url:photo.preview_url||photo.thumbnail_url,poster:photo.thumbnail_url,mediaType:photo.media_type,title:photo.title||photo.original_filename,positionLabel}} onClose={onClose} onPrevious={onPrevious} onNext={onNext} hasPrevious={hasPrevious} hasNext={hasNext} infoOpen={infoOpen} onToggleInfo={()=>setInfoOpen(open=>!open)} renderInfo={()=> <OrangePhotoDetailsPanel photo={photo} onSave={onSave}/>} renderExtraActions={()=> <><button className="od-attachments-lightbox__action" type="button" onClick={onShare}>Compartir</button>{photo.is_owner?<button className="od-attachments-lightbox__action" type="button" onClick={onTrash}>{photo.is_trashed?'Restaurar':'Papelera'}</button>:null}<a className="od-attachments-lightbox__action" href={photo.preview_url} download>Descargar</a></>}/>;
}
