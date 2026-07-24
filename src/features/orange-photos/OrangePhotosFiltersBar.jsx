import ODFilterSelect from "../../shared/components/ODFilterSelect.jsx";

const LIBRARY_OPTIONS = [{ value: "all", label: "Todas" }, { value: "owned", label: "Propias" }, { value: "shared_with_me", label: "Compartidas conmigo" }, { value: "shared_by_me", label: "Compartidas por mí" }];
const SHARE_OPTIONS = [{ value: "all", label: "Todos" }, { value: "family", label: "Toda la familia" }, { value: "selected", label: "Personas concretas" }];

function MediaToggle({ value, onChange }) {
  const options = [{ value: "all", label: "Todos" }, { value: "image", label: "Fotos" }, { value: "video", label: "Vídeos" }];
  return <div className="od-orangephotos-mode" role="group" aria-label="Tipo de contenido">{options.map(option => <button key={option.value} type="button" className={value === option.value ? "is-active" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export default function OrangePhotosFiltersBar({ filters, onChange }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  return <div className="od-orangephotos-filter-fields">
    <div className="od-form-field"><span className="od-form-label">Tipo de contenido</span><MediaToggle value={filters.media_type} onChange={value => set("media_type", value)} /></div>
    <div className="od-form-field"><span className="od-form-label">Mostrar</span><ODFilterSelect mode="single" panelPortal options={LIBRARY_OPTIONS} value={filters.library_scope} onChange={value => set("library_scope", value)} /></div>
    {filters.library_scope === "shared_by_me" ? <div className="od-form-field"><span className="od-form-label">Compartidas con</span><ODFilterSelect mode="single" panelPortal options={SHARE_OPTIONS} value={filters.share_scope} onChange={value => set("share_scope", value)} /></div> : null}
  </div>;
}
