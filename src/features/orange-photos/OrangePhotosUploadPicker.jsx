import { useEffect, useRef, useState } from "react";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString("es-ES", { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

export default function OrangePhotosUploadPicker({ open, files, onAddFiles, onCancel, onStart, onBrowse }) {
  const [dragActive, setDragActive] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const preventDrop = event => event.preventDefault();
    const handleKey = event => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("dragover", preventDrop);
    window.addEventListener("drop", preventDrop);
    window.addEventListener("keydown", handleKey);
    modalRef.current?.focus();
    return () => {
      window.removeEventListener("dragover", preventDrop);
      window.removeEventListener("drop", preventDrop);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onCancel]);

  if (!open) return null;
  const count = files.length;
  return <div className="od-orangephotos-upload-picker__backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section ref={modalRef} className="od-orangephotos-upload-picker" role="dialog" aria-modal="true" aria-labelledby="orangephotos-upload-picker-title" tabIndex={-1}>
      <header className="od-orangephotos-upload-picker__header"><h2 id="orangephotos-upload-picker-title">Seleccionar archivos</h2></header>
      <div className="od-orangephotos-upload-picker__body">
        <div className={`od-orangephotos-upload-picker__dropzone${dragActive ? " is-active" : ""}`} onDragEnter={event => { event.preventDefault(); setDragActive(true); }} onDragOver={event => { event.preventDefault(); setDragActive(true); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }} onDrop={event => { event.preventDefault(); event.stopPropagation(); setDragActive(false); onAddFiles(event.dataTransfer.files); }}>
          <strong>Arrastra aquí tus fotos y vídeos</strong><span>o usa “Elegir archivos”</span>
        </div>
        <p className="od-orangephotos-upload-picker__file-count">{count} {count === 1 ? "archivo seleccionado" : "archivos seleccionados"}</p>
        {count ? <ul className="od-orangephotos-upload-picker__file-list">{files.map(file => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span>{file.name}</span><small>{formatSize(file.size)}</small></li>)}</ul> : null}
      </div>
      <footer className="od-orangephotos-upload-picker__footer"><button type="button" className="od-btn od-btn-secondary" onClick={onCancel}>Cancelar</button><button type="button" className="od-btn od-btn-secondary" onClick={onBrowse}>Elegir archivos</button><button type="button" className="od-btn od-btn-primary" disabled={!count} onClick={onStart}>Iniciar subida</button></footer>
    </section>
  </div>;
}
