/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { acquireModalStackLayer, OD_OVERLAY_Z } from "../../shared/overlay/odModalStack.js";

export default function OrangePhotoShareModal({ photo, members, onClose, onSave, returnFocusRef }) {
  const [visibility, setVisibility] = useState(photo.visibility);
  const [ids, setIds] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => setVisibility(photo.visibility), [photo]);
  useEffect(() => { const layer = acquireModalStackLayer(), returnFocus = returnFocusRef?.current; const key = event => { if (event.key === "Escape") { event.stopImmediatePropagation(); onClose(); } }; window.addEventListener("keydown", key, true); return () => { window.removeEventListener("keydown", key, true); layer.release(); returnFocus?.focus(); }; }, [onClose, returnFocusRef]);
  const toggle = id => setIds(value => value.includes(id) ? value.filter(item => item !== id) : [...value, id]);
  if (typeof document === "undefined") return null;
  return createPortal(<div className="od-modal-backdrop od-orange-photo-share-backdrop" style={{ zIndex: OD_OVERLAY_Z.LIGHTBOX + 100 }} onMouseDown={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}><section className="od-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><header className="od-modal-header"><h2 className="od-modal-title">Compartir foto</h2><button className="od-modal-close" type="button" onClick={onClose}>×</button></header><div className="od-modal-body"><label>Visibilidad<select className="od-filter-input" value={visibility} onChange={event => setVisibility(event.target.value)}><option value="private">Solo yo</option><option value="family">Toda la familia</option><option value="selected">Miembros concretos</option></select></label>{visibility === "selected" ? <fieldset className="od-orange-photo-share__members"><legend>Miembros</legend>{members.map(member => <label key={member.id}><input type="checkbox" checked={ids.includes(member.id)} onChange={() => toggle(member.id)} />{member.display_name}</label>)}</fieldset> : null}<div className="od-modal-actions"><button className="od-button-secondary" type="button" onClick={onClose}>Cancelar</button><button className="od-modal-primary" type="button" disabled={busy || visibility === "selected" && !ids.length} onClick={async () => { setBusy(true); try { await onSave({ visibility, user_ids: ids }); } finally { setBusy(false); } }}>Guardar</button></div></div></section></div>, document.body);
}
