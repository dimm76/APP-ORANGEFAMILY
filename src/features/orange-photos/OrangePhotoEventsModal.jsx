import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { getOrangePhotoEvents } from "../../shared/api/orangePhotosApi.js";
import { acquireModalStackLayer, OD_OVERLAY_Z } from "../../shared/overlay/odModalStack.js";

const EVENT_LABELS = {
  uploaded: "Subida a OrangeFamily", duplicate_resolved: "Copia ya existente confirmada", upload_suppressed: "Subida automática omitida", restore_available_detected: "Elemento encontrado en la papelera", downloaded: "Original descargado", bulk_downloaded: "Incluida en una descarga ZIP", shared: "Compartida", unshared: "Compartición retirada", moved_to_trash: "Movida a la papelera", restored: "Restaurada", purged: "Eliminada definitivamente", metadata_updated: "Información modificada", added_to_album: "Añadida a un álbum", removed_from_album: "Eliminada de un álbum",
};
const CLIENT_LABELS = { web:"Web", android_sync:"Agente Android", desktop:"Aplicación de escritorio", public:"Acceso público", system:"OrangeFamily", legacy:"Importación anterior" };
const FIELD_LABELS = { original_filename:"Archivo", size_bytes:"Tamaño", upload_mode:"Modo de subida", format:"Formato", item_count:"Elementos", changed_fields:"Campos modificados", album_id:"Álbum", visibility:"Visibilidad", shared_user_ids:"Usuarios compartidos", checksum_sha256:"Checksum", installation_id:"Instalación" };
const KNOWN_FIELDS = Object.keys(FIELD_LABELS);

const readable = value => String(value || "").replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase()) || "Actividad";
const formatDate = value => value ? new Date(value).toLocaleString("es-ES") : "Fecha desconocida";
const formatBytes = value => { const bytes=Number(value);if(!Number.isFinite(bytes))return null;if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toLocaleString("es-ES",{maximumFractionDigits:1})} KB`;if(bytes<1024*1024*1024)return `${(bytes/1024/1024).toLocaleString("es-ES",{maximumFractionDigits:1})} MB`;return `${(bytes/1024/1024/1024).toLocaleString("es-ES",{maximumFractionDigits:2})} GB`; };
const shorten = (value,length) => value ? `${String(value).slice(0,length)}…` : null;

function metadataRows(event) {
  const metadata={...(event.metadata||{})};
  if(event.installation_id)metadata.installation_id=event.installation_id;
  return KNOWN_FIELDS.flatMap(key=>{const value=metadata[key];if(value==null||value===""||Array.isArray(value)&&!value.length)return[];let display=value;if(key==="size_bytes")display=formatBytes(value);else if(key==="checksum_sha256")display=shorten(value,12);else if(key==="installation_id")display=shorten(value,8);else if(Array.isArray(value))display=key==="shared_user_ids"?`${value.length} usuario${value.length===1?"":"s"}`:value.map(readable).join(", ");return display==null?[]:[[FIELD_LABELS[key],display]];});
}

function EventItem({ event }) {
  const [detailsOpen,setDetailsOpen]=useState(false),rows=metadataRows(event);
  return <li className="od-orange-photo-events__item"><div className="od-orange-photo-events__summary"><strong>{EVENT_LABELS[event.event_type]||readable(event.event_type)}</strong><time dateTime={event.occurred_at}>{formatDate(event.occurred_at)}</time><span>{CLIENT_LABELS[event.client_type]||readable(event.client_type)} · Usuario de OrangeFamily</span></div>{rows.length?<><button type="button" className="od-button-secondary od-orange-photo-events__details-toggle" aria-expanded={detailsOpen} onClick={()=>setDetailsOpen(open=>!open)}>Detalles</button>{detailsOpen?<dl className="od-orange-photo-events__metadata">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>:null}</>:null}</li>;
}

export default function OrangePhotoEventsModal({ photo, onClose, returnFocusRef }) {
  const [events,setEvents]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [attempt,setAttempt]=useState(0);
  const retry=useCallback(()=>{setLoading(true);setError("");setAttempt(value=>value+1);},[]);

  useEffect(()=>{const controller=new AbortController();let active=true;getOrangePhotoEvents(photo.id,{signal:controller.signal}).then(data=>{if(active)setEvents(data.items||[]);}).catch(requestError=>{if(active&&requestError.name!=="AbortError"){setEvents([]);setError("No se pudo cargar el historial de la foto.");}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;controller.abort();};},[photo.id,attempt]);
  useEffect(()=>{const layer=acquireModalStackLayer(),returnFocus=returnFocusRef?.current;const key=event=>{if(event.key==="Escape"){event.stopImmediatePropagation();onClose();}};window.addEventListener("keydown",key,true);return()=>{window.removeEventListener("keydown",key,true);layer.release();returnFocus?.focus();};},[onClose,returnFocusRef]);
  if(typeof document==="undefined")return null;
  return createPortal(<div className="od-modal-backdrop od-orange-photo-events-backdrop" style={{zIndex:OD_OVERLAY_Z.LIGHTBOX+100}} onMouseDown={event=>{event.stopPropagation();if(event.target===event.currentTarget)onClose();}}><section className="od-modal od-orange-photo-events-modal" role="dialog" aria-modal="true" aria-labelledby="orange-photo-events-title" onMouseDown={event=>event.stopPropagation()}><header className="od-modal-header"><h2 className="od-modal-title" id="orange-photo-events-title">Historial de la foto</h2><button className="od-modal-close" type="button" aria-label="Cerrar historial" onClick={onClose}><IonIcon icon={closeOutline}/></button></header><div className="od-modal-body od-orange-photo-events__body">{loading?<p className="od-status-line" role="status">Cargando historial…</p>:error?<div className="od-orange-photo-events__error"><p className="od-status-line od-status-line--error">{error}</p><button className="od-button-secondary" type="button" onClick={retry}>Reintentar</button></div>:events.length?<ol className="od-orange-photo-events__list">{events.map(event=><EventItem key={event.id} event={event}/>)}</ol>:<p className="od-status-line">Todavía no hay actividad registrada para esta foto.</p>}</div></section></div>,document.body);
}
