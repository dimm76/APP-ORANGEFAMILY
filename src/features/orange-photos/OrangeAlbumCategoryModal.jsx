import { useState } from "react";

export default function OrangeAlbumCategoryModal({ busy = false, error = "", onClose, onSave }) {
  const [name, setName] = useState("");
  const cleanName = name.trim();
  return <div className="od-modal-backdrop"><section className="od-modal" role="dialog" aria-modal="true"><header className="od-modal-header"><h2 className="od-modal-title">Nueva categoría de álbum</h2><button type="button" className="od-modal-close" aria-label="Cerrar" onClick={onClose}>×</button></header><form className="od-modal-body" onSubmit={event => { event.preventDefault(); onSave({ name: cleanName }); }}><label className="od-form-field"><span className="od-form-label">Nombre</span><input className="od-filter-input" value={name} maxLength={120} onChange={event => setName(event.target.value)} required /></label>{error ? <p className="od-status-line od-status-line--error">{error}</p> : null}<div className="od-modal-actions"><button type="button" className="od-btn od-btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="od-btn od-btn-primary" disabled={busy || !cleanName}>Crear</button></div></form></section></div>;
}
