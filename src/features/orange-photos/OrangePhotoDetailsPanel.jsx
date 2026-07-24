/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = number => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function OrangePhotoDetailsPanel({ photo, members = [], onSave, feedback }) {
  const [form, setForm] = useState({});
  useEffect(() => setForm({ title:photo?.title||"", description:photo?.description||"", captured_at:toLocalDateTimeInput(photo?.captured_at), timezone:photo?.timezone||"", location_name:photo?.location_name||"" }), [photo]);
  if (!photo) return null;
  const set=(key,value)=>setForm(current=>({...current,[key]:value}));
  const names=(photo.shared_user_ids||[]).map(id=>members.find(member=>member.id===id)?.display_name).filter(Boolean);
  const visibility=photo.visibility==="family"?"Compartida con toda la familia":photo.visibility==="selected"?`Compartida con ${names.length?names.join(", "):"personas concretas"}`:"Privada";
  return <div className="od-orange-photo-details"><section><h3>Descripción</h3><textarea className="od-filter-input" placeholder="Añadir una descripción" value={form.description} onChange={event=>set("description",event.target.value)} /></section><section><h3>Compartición</h3><p>{visibility}</p></section><section><h3>Fecha y hora</h3><input className="od-filter-input" type="datetime-local" value={form.captured_at} onChange={event=>set("captured_at",event.target.value)} />{form.timezone?<small>{form.timezone}</small>:null}</section>{photo.camera_make||photo.camera_model?<section><h3>Cámara y captura</h3><p>{[photo.camera_make,photo.camera_model].filter(Boolean).join(" ")}</p></section>:null}<section><h3>Archivo</h3>{photo.title?<label>Nombre visible<input className="od-filter-input" value={form.title} onChange={event=>set("title",event.target.value)} /></label>:null}<p><strong>{photo.original_filename||"Archivo"}</strong></p>{photo.width&&photo.height?<small>{photo.width} × {photo.height}</small>:null}</section><section><h3>Ubicación</h3><input className="od-filter-input" placeholder="Añadir una ubicación" value={form.location_name} onChange={event=>set("location_name",event.target.value)} /><details><summary>Detalles técnicos</summary>{photo.latitude!=null||photo.longitude!=null?<p>{photo.latitude??"—"}, {photo.longitude??"—"}</p>:<p>Sin coordenadas</p>}</details></section>{photo.is_owner?<button className="od-modal-primary" type="button" disabled={feedback==="Guardando…"} onClick={()=>{const body={...form,captured_at:form.captured_at?new Date(form.captured_at).toISOString():null};onSave(body);}}>{feedback==="Guardando…"?feedback:"Guardar cambios"}</button>:null}{feedback?<p className="od-orange-photo-details__feedback" role="status">{feedback}</p>:null}</div>;
}
