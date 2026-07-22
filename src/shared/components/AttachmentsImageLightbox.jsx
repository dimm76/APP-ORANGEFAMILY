import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

const LIGHTBOX_MARGIN = 48;
const LIGHTBOX_TOOLBAR = 56;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;

function computeFitScale(naturalW, naturalH) {
  if (!naturalW || !naturalH) return 1;

  const maxW = Math.max(120, window.innerWidth - LIGHTBOX_MARGIN);
  const maxH = Math.max(120, window.innerHeight - LIGHTBOX_TOOLBAR - LIGHTBOX_MARGIN);

  return Math.min(maxW / naturalW, maxH / naturalH, 1);
}

export default function AttachmentsImageLightbox({ viewer, onClose }) {
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerNatural, setViewerNatural] = useState({ w: 0, h: 0 });

  const closeViewer = useCallback(() => {
    setViewerZoom(1);
    setViewerNatural({ w: 0, h: 0 });
    onClose?.();
  }, [onClose]);

  const viewerDisplaySize = useMemo(() => {
    const { w, h } = viewerNatural;

    if (!w || !h) return null;

    const fit = computeFitScale(w, h);

    return {
      width: Math.round(w * fit * viewerZoom),
      height: Math.round(h * fit * viewerZoom),
    };
  }, [viewerNatural, viewerZoom]);

  useEffect(() => {
    if (!viewer) return undefined;

    setViewerZoom(1);
    setViewerNatural({ w: 0, h: 0 });

    const onKey = (event) => {
      if (event.key === "Escape") closeViewer();
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, closeViewer]);

  if (!viewer || typeof document === "undefined") return null;

  const title = viewer.title || viewer.filename || "Imagen";

  const lightbox = (
    <div
      className="od-attachments-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeViewer();
      }}
    >
      <div
        className="od-attachments-lightbox__toolbar"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="od-attachments-lightbox__title" title={title}>
          {title}
        </p>

        <div className="od-attachments-lightbox__controls">
          <button
            type="button"
            className="od-attachments-lightbox__btn"
            aria-label="Reducir zoom"
            onClick={() => setViewerZoom((zoom) => Math.max(zoom / ZOOM_STEP, ZOOM_MIN))}
          >
            <IonIcon icon={OD_ICONS.richStrike} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="od-attachments-lightbox__btn"
            aria-label="Ampliar zoom"
            onClick={() => setViewerZoom((zoom) => Math.min(zoom * ZOOM_STEP, ZOOM_MAX))}
          >
            <IonIcon icon={OD_ICONS.add} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="od-attachments-lightbox__btn"
            aria-label="Ajustar a pantalla"
            onClick={() => setViewerZoom(1)}
          >
            <IonIcon icon={OD_ICONS.collapseSections} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="od-attachments-lightbox__btn od-attachments-lightbox__btn--close"
            aria-label="Cerrar"
            onClick={closeViewer}
          >
            <IonIcon icon={OD_ICONS.bulkExit} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        className="od-attachments-lightbox__stage"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeViewer();
        }}
      >
        <img
          src={viewer.url}
          alt={title}
          className="od-attachments-lightbox__img"
          style={
            viewerDisplaySize
              ? {
                  width: viewerDisplaySize.width,
                  height: viewerDisplaySize.height,
                }
              : undefined
          }
          onLoad={(event) => {
            const img = event.currentTarget;
            setViewerNatural({
              w: img.naturalWidth,
              h: img.naturalHeight,
            });
          }}
          onMouseDown={(event) => event.stopPropagation()}
        />
      </div>
    </div>
  );

  return createPortal(lightbox, document.body);
}
