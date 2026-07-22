export default function OrangePhotosFiltersBar({ filters, onChange, onClose }) {
  const set = (key, value) => onChange({ ...filters, [key]: value, page: 1 });

  return (
    <div className="od-orange-photos__filters">
      <input
        className="od-filter-search-input"
        aria-label="Buscar fotos"
        placeholder="Buscar"
        value={filters.search}
        onChange={(event) => set("search", event.target.value)}
      />
      <select
        className="od-filter-input"
        aria-label="Tipo"
        value={filters.media_type}
        onChange={(event) => set("media_type", event.target.value)}
      >
        <option value="">Fotos y vídeos</option>
        <option value="image">Imágenes</option>
        <option value="video">Vídeos</option>
      </select>
      <select
        className="od-filter-input"
        aria-label="Visibilidad"
        value={filters.visibility}
        onChange={(event) => set("visibility", event.target.value)}
      >
        <option value="">Toda visibilidad</option>
        <option value="private">Privadas</option>
        <option value="family">Familia</option>
        <option value="selected">Compartidas</option>
      </select>
      <label className="od-orange-photos__check">
        <input
          type="checkbox"
          checked={filters.favorite}
          onChange={(event) => set("favorite", event.target.checked)}
        />
        Favoritas
      </label>
      <label className="od-orange-photos__check">
        <input
          type="checkbox"
          checked={filters.include_trashed}
          onChange={(event) => set("include_trashed", event.target.checked)}
        />
        Papelera
      </label>
      {onClose ? <button className="od-button-secondary" type="button" onClick={onClose}>Cerrar</button> : null}
    </div>
  );
}
