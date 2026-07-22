import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import { addOutline, closeOutline, contractOutline, removeOutline } from "ionicons/icons";

const STEP = 1.25;
function fitScale(width, height) {
  return Math.min((window.innerWidth - 48) / width, (window.innerHeight - 104) / height, 1);
}

export default function AttachmentsImageLightbox({ viewer, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const close = useCallback(() => { setZoom(1); setNatural({ width: 0, height: 0 }); onClose?.(); }, [onClose]);
  useEffect(() => {
    if (!viewer) return undefined;
    const onKey = (event) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, close]);
  const size = useMemo(() => natural.width ? { width: natural.width * fitScale(natural.width, natural.height) * zoom, height: natural.height * fitScale(natural.width, natural.height) * zoom } : null, [natural, zoom]);
  if (!viewer || typeof document === "undefined") return null;
  const button = (label, icon, action, extra = "") => <button type="button" className={`od-attachments-lightbox__btn ${extra}`} aria-label={label} onClick={action}><IonIcon icon={icon} aria-hidden="true" /></button>;
  return createPortal(
    <div className="od-attachments-lightbox" role="dialog" aria-modal="true" aria-label={viewer.title} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="od-attachments-lightbox__toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <p className="od-attachments-lightbox__title">{viewer.title}</p>
        <div className="od-attachments-lightbox__controls">
          {button("Reducir zoom", removeOutline, () => setZoom((v) => Math.max(v / STEP, 0.25)))}
          {button("Ampliar zoom", addOutline, () => setZoom((v) => Math.min(v * STEP, 4)))}
          {button("Ajustar a pantalla", contractOutline, () => setZoom(1))}
          {button("Cerrar", closeOutline, close, "od-attachments-lightbox__btn--close")}
        </div>
      </div>
      <div className="od-attachments-lightbox__stage" onMouseDown={(e) => e.target === e.currentTarget && close()}>
        <img className="od-attachments-lightbox__img" src={viewer.url} alt={viewer.title} style={size || undefined} onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })} onMouseDown={(e) => e.stopPropagation()} />
      </div>
    </div>, document.body
  );
}
