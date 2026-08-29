import { useEffect, useState } from "react";
import OrangePhotosFiltersBar from "./OrangePhotosFiltersBar.jsx";
import { OrangePhotosAnchoredPortal } from "./OrangePhotosCreateMenu.jsx";
export default function OrangePhotosFiltersPopover({ open, anchorRef, filters, emptyFilters, onClose, onApply, members = [], membersLoading = false, allowedAccessSources, centered = false, showIntegratedInLibraryOption = false }) {
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (open) queueMicrotask(() => setDraft(filters));
  }, [open, filters]);

  useEffect(() => {
    if (!open || !centered) return undefined;
    const onKeyDown = event => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, centered, onClose]);

  if (!open) return null;

  const content = <OrangePhotosFiltersBar filters={draft} members={members} membersLoading={membersLoading} allowedAccessSources={allowedAccessSources} showIntegratedInLibraryOption={showIntegratedInLibraryOption} panelPortal={!centered} onChange={setDraft} />;
  if (centered) return <div className="od-modal-backdrop" onMouseDown={onClose}><section className="od-modal od-orangephotos-options-modal" role="dialog" aria-modal="true" aria-labelledby="od-orangephotos-options-title" onMouseDown={event => event.stopPropagation()}><header className="od-modal-header"><h2 className="od-modal-title" id="od-orangephotos-options-title">Opciones</h2><button type="button" className="od-modal-close" aria-label="Cerrar opciones" onClick={onClose}>×</button></header><div className="od-orangephotos-options-modal__body">{content}</div><footer className="od-orangephotos-options-modal__footer"><button className="od-button-secondary" type="button" onClick={() => setDraft(emptyFilters)}>Limpiar</button><button className="od-modal-primary" type="button" onClick={() => onApply(draft)}>Aplicar</button></footer></section></div>;
  return <OrangePhotosAnchoredPortal anchorRef={anchorRef} width={360} onClose={onClose} label="Cerrar filtros">{style => <section className="od-orangephotos-filters-popover" style={style} aria-label="Filtros de fotos">{content}<footer><button className="od-button-secondary" type="button" onClick={() => setDraft(emptyFilters)}>Limpiar</button><button className="od-modal-primary" type="button" onClick={() => onApply(draft)}>Aplicar</button></footer></section>}</OrangePhotosAnchoredPortal>;
}
