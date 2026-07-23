import { useEffect, useState } from "react";
import OrangePhotosFiltersBar from "./OrangePhotosFiltersBar.jsx";
import { OrangePhotosAnchoredPortal } from "./OrangePhotosCreateMenu.jsx";

export default function OrangePhotosFiltersPopover({ open, anchorRef, filters, emptyFilters, onClose, onApply }) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => { if (open) queueMicrotask(() => setDraft(filters)); }, [open, filters]);
  if (!open) return null;
  return <OrangePhotosAnchoredPortal anchorRef={anchorRef} width={360} onClose={onClose} label="Cerrar filtros">{style => <section className="od-orangephotos-filters-popover" style={style} aria-label="Filtros de fotos"><OrangePhotosFiltersBar filters={draft} onChange={setDraft} /><footer><button className="od-button-secondary" type="button" onClick={() => setDraft(emptyFilters)}>Limpiar</button><button className="od-modal-primary" type="button" onClick={() => onApply(draft)}>Aplicar</button></footer></section>}</OrangePhotosAnchoredPortal>;
}
