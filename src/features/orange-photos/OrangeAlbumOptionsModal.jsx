import { useState } from "react";

export default function OrangeAlbumOptionsModal({ album, categories, busy = false, error = "", onClose, onSave }) {
  const [selectedCategoryIds, setSelectedCategoryIds] = useState((album.categories || []).map(category => category.id));
  const [allowContributions, setAllowContributions] = useState(album.allow_contributions === true);
  const [allowComments, setAllowComments] = useState(album.allow_comments === true);
  const [associateDate, setAssociateDate] = useState(Boolean(album.date_mode));
  const [dateMode, setDateMode] = useState(album.date_mode || "single");
  const [dateStart, setDateStart] = useState(album.date_start ? String(album.date_start).slice(0, 10) : "");
  const [dateEnd, setDateEnd] = useState(album.date_end ? String(album.date_end).slice(0, 10) : "");
  const invalid = busy || (associateDate && !dateStart) || (associateDate && dateMode === "range" && (!dateEnd || dateEnd < dateStart));
  const toggle = id => setSelectedCategoryIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const submit = event => {
    event.preventDefault();
    onSave({
      category_ids: selectedCategoryIds,
      album_patch: album.is_owner ? {
        date_mode: associateDate ? dateMode : null,
        date_start: associateDate ? dateStart : null,
        date_end: associateDate ? dateMode === "single" ? dateStart : dateEnd : null,
        allow_contributions: allowContributions,
        allow_comments: allowComments,
      } : null,
    });
  };

  return (
    <div className="od-modal-backdrop">
      <section className="od-modal" role="dialog" aria-modal="true">
        <header className="od-modal-header">
          <h2 className="od-modal-title">Opciones del álbum</h2>
          <button type="button" className="od-modal-close" aria-label="Cerrar" disabled={busy} onClick={onClose}>×</button>
        </header>
        <form className="od-modal-body od-orange-album-options-modal" onSubmit={submit}>
          <section className="od-orange-album-options-section">
            <h3 className="od-orange-album-options-section__title">CATEGORÍAS</h3>
            {categories.length ? categories.map(category => (
              <label key={category.id} className="od-orange-album-options-modal__check">
                <input type="checkbox" checked={selectedCategoryIds.includes(category.id)} disabled={busy} onChange={() => toggle(category.id)} />
                <span>{category.name}</span>
              </label>
            )) : <p>Todavía no has creado categorías.</p>}
          </section>
          {album.is_owner ? <section className="od-orange-album-options-section">
            <h3 className="od-orange-album-options-section__title">PERMISOS</h3>
            <label className="od-orange-album-options-modal__check"><input type="checkbox" checked={allowContributions} disabled={busy} onChange={event => setAllowContributions(event.target.checked)} /><span>Permitir añadir fotos y vídeos</span></label>
            <label className="od-orange-album-options-modal__check"><input type="checkbox" checked={allowComments} disabled={busy} onChange={event => setAllowComments(event.target.checked)} /><span>Permitir comentarios</span></label>
            <p className="od-orange-album-options-modal__hint">Los comentarios se habilitarán cuando esta función esté disponible.</p>
          </section> : null}
          {album.is_owner ? <section className="od-orange-album-options-section">
            <h3 className="od-orange-album-options-section__title">FECHA</h3>
            <label className="od-orange-album-options-modal__check"><input type="checkbox" checked={associateDate} disabled={busy} onChange={event => setAssociateDate(event.target.checked)} /><span>Asociar fecha</span></label>
            {associateDate ? <>
              <div className="od-orange-album-options-modal__inline-options"><label><input type="radio" checked={dateMode === "single"} disabled={busy} onChange={() => setDateMode("single")} />Fecha única</label><label><input type="radio" checked={dateMode === "range"} disabled={busy} onChange={() => setDateMode("range")} />Intervalo</label></div>
              <label className="od-form-field"><span className="od-form-label">{dateMode === "single" ? "Fecha" : "Desde"}</span><input className="od-filter-input" type="date" value={dateStart} disabled={busy} onChange={event => setDateStart(event.target.value)} /></label>
              {dateMode === "range" ? <label className="od-form-field"><span className="od-form-label">Hasta</span><input className="od-filter-input" type="date" value={dateEnd} disabled={busy} onChange={event => setDateEnd(event.target.value)} /></label> : null}
            </> : null}
          </section> : null}
          {error ? <p className="od-status-line od-status-line--error">{error}</p> : null}
          <div className="od-modal-actions od-orange-album-options-actions"><button type="button" className="od-btn od-btn-secondary" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" className="od-btn od-btn-primary" disabled={invalid}>Guardar</button></div>
        </form>
      </section>
    </div>
  );
}
