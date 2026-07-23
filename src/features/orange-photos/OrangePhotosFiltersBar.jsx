import ODFilterSelect from "../../shared/components/ODFilterSelect.jsx";

const MEDIA_OPTIONS = [{ value: "image", label: "Fotos" }, { value: "video", label: "Vídeos" }];
const VISIBILITY_OPTIONS = [{ value: "private", label: "Privadas" }, { value: "family", label: "Familia" }, { value: "selected", label: "Compartidas" }];

function ModeToggle({ value, onChange, label }) {
  return <div className="od-orangephotos-mode" role="group" aria-label={label}><button type="button" className={value === "include" ? "is-active" : ""} onClick={() => onChange("include")}>Incluir</button><button type="button" className={value === "exclude" ? "is-active" : ""} onClick={() => onChange("exclude")}>Excluir</button></div>;
}

export default function OrangePhotosFiltersBar({ filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  return <div className="od-orangephotos-filter-fields">
    <div className="od-form-field"><span className="od-form-label">Tipo de contenido</span><ModeToggle label="Modo del tipo de contenido" value={filters.media_type_mode} onChange={value => set("media_type_mode", value)} /><ODFilterSelect mode="multiple" uiVariant="multiselect" searchable panelPortal options={MEDIA_OPTIONS} value={filters.media_types} onChange={value => set("media_types", value)} placeholder="Todos los tipos" /></div>
    <div className="od-form-field"><span className="od-form-label">Visibilidad</span><ModeToggle label="Modo de visibilidad" value={filters.visibility_mode} onChange={value => set("visibility_mode", value)} /><ODFilterSelect mode="multiple" uiVariant="multiselect" searchable panelPortal options={VISIBILITY_OPTIONS} value={filters.visibilities} onChange={value => set("visibilities", value)} placeholder="Toda visibilidad" /></div>
    <div className="od-form-field"><span className="od-form-label">Estado</span><label className="od-orange-photos__check"><input type="checkbox" checked={filters.favorite} onChange={event => set("favorite", event.target.checked)} /> Favoritas</label><label className="od-orange-photos__check"><input type="checkbox" checked={filters.trashed} onChange={event => set("trashed", event.target.checked)} /> Papelera</label></div>
  </div>;
}
