/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IonIcon } from "@ionic/react";
import {
  chevronBackOutline,
  chevronForwardOutline,
  closeOutline,
  informationCircleOutline,
} from "ionicons/icons";
import { OD_ICONS } from "../ui/odIcons.js";

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 1.25;

export default function AttachmentsImageLightbox({
  viewer,
  onClose,
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  renderInfo,
  renderInfoHeaderActions,
  infoOpen = false,
  onToggleInfo,
  renderExtraActions,
}) {
  const [userZoom, setUserZoom] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  const stageRef = useRef(null);
  const imageRef = useRef(null);

  const syncNaturalSize = useCallback((element = imageRef.current) => {
    if (
      typeof HTMLImageElement === "undefined" ||
      !(element instanceof HTMLImageElement)
    ) {
      return;
    }

    const width = element.naturalWidth;
    const height = element.naturalHeight;

    if (!width || !height) {
      return;
    }

    setNatural((current) => {
      if (
        current.w === width &&
        current.h === height
      ) {
        return current;
      }

      return {
        w: width,
        h: height,
      };
    });
  }, []);

  const center = useCallback(() => {
    if (!stageRef.current) return;

    stageRef.current.scrollLeft = 0;
    stageRef.current.scrollTop = 0;
  }, []);

  const resetView = useCallback(() => {
    setUserZoom(1);
    center();
  }, [center]);

  const close = useCallback(() => {
    resetView();
    onClose?.();
  }, [onClose, resetView]);

  const move = useCallback(
    (direction) => {
      setNatural({ w: 0, h: 0 });
      resetView();

      if (direction === "previous") {
        onPrevious?.();
      } else {
        onNext?.();
      }
    },
    [onNext, onPrevious, resetView],
  );

  useEffect(() => {
    const element = stageRef.current;

    if (!element) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setViewport({
        w: entry.contentRect.width,
        h: entry.contentRect.height,
      });
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [infoOpen]);

  useEffect(() => {
    if (!viewer) {
      return undefined;
    }

    setNatural({ w: 0, h: 0 });
    resetView();

    /*
     * La imagen puede proceder de la caché y estar ya
     * cargada antes de que onLoad vuelva a notificarse.
     */
    const frame = window.requestAnimationFrame(() => {
      const image = imageRef.current;

      if (image?.complete) {
        syncNaturalSize(image);
      }
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [
    viewer?.url,
    resetView,
    syncNaturalSize,
  ]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (infoOpen) {
          onToggleInfo?.();
        } else {
          close();
        }

        return;
      }

      if (event.key === "ArrowLeft" && hasPrevious) {
        move("previous");
      }

      if (event.key === "ArrowRight" && hasNext) {
        move("next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    close,
    hasPrevious,
    hasNext,
    infoOpen,
    move,
    onToggleInfo,
  ]);

  const size = useMemo(() => {
    if (
      !natural.w ||
      !natural.h ||
      !viewport.w ||
      !viewport.h
    ) {
      return null;
    }

    const mobile = viewport.w <= 600;
    const horizontalPadding = mobile ? 0 : 48;
    const verticalPadding = mobile ? 0 : 48;

    const availableWidth = Math.max(
      120,
      viewport.w - horizontalPadding,
    );

    const availableHeight = Math.max(
      120,
      viewport.h - verticalPadding,
    );

    const fit = Math.min(
      availableWidth / natural.w,
      availableHeight / natural.h,
      1,
    );

    return {
      width: Math.round(natural.w * fit * userZoom),
      height: Math.round(natural.h * fit * userZoom),
    };
  }, [natural, viewport, userZoom]);

  if (!viewer || typeof document === "undefined") {
    return null;
  }

  const title = viewer.title || viewer.filename || "Imagen";
  const isVideo =
    viewer.mediaType === "video" ||
    viewer.media_type === "video";

  const zoomTitle = `${Math.round(userZoom * 100)}%`;

  return createPortal(
    <div
      className={`od-attachments-lightbox${
        infoOpen ? " is-info-open" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="od-attachments-lightbox__toolbar">
        <div className="od-attachments-lightbox__toolbar-start">
          <button
            type="button"
            className="od-attachments-lightbox__btn od-attachments-lightbox__btn--close"
            aria-label="Cerrar"
            title="Cerrar"
            onClick={close}
          >
            <IonIcon icon={closeOutline} />
          </button>

          <p className="od-attachments-lightbox__title">
            {viewer.positionLabel || title}
          </p>
        </div>

        <div className="od-attachments-lightbox__controls">
          {renderExtraActions?.()}

          {!isVideo ? (
            <div className="od-attachments-lightbox__zoom-actions">
              <button
                type="button"
                className="od-attachments-lightbox__btn"
                aria-label="Reducir zoom"
                title={`Reducir zoom (${zoomTitle})`}
                onClick={() =>
                  setUserZoom((value) =>
                    Math.max(
                      value / ZOOM_STEP,
                      ZOOM_MIN,
                    ),
                  )
                }
              >
                <IonIcon icon={OD_ICONS.richDivider} />
              </button>

              <button
                type="button"
                className="od-attachments-lightbox__btn"
                aria-label="Ampliar zoom"
                title={`Ampliar zoom (${zoomTitle})`}
                onClick={() =>
                  setUserZoom((value) =>
                    Math.min(
                      value * ZOOM_STEP,
                      ZOOM_MAX,
                    ),
                  )
                }
              >
                <IonIcon icon={OD_ICONS.add} />
              </button>

              <button
                type="button"
                className="od-attachments-lightbox__btn"
                aria-label="Ajustar a pantalla"
                title="Ajustar a pantalla"
                onClick={resetView}
              >
                <IonIcon icon={OD_ICONS.expandSections} />
              </button>
            </div>
          ) : null}

          {renderInfo ? (
            <button
              type="button"
              className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--info${
                infoOpen ? " is-active" : ""
              }`}
              aria-label="Información"
              title="Información"
              onClick={onToggleInfo}
            >
              <IonIcon icon={informationCircleOutline} />
            </button>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="od-attachments-lightbox__nav od-attachments-lightbox__nav--previous"
        aria-label="Anterior"
        disabled={!hasPrevious}
        onClick={() => move("previous")}
      >
        <IonIcon icon={chevronBackOutline} />
      </button>

      {infoOpen && renderInfo ? (
        <aside className="od-attachments-lightbox__info">
          <header>
            <div className="od-attachments-lightbox__info-header-actions">
              <button
                type="button"
                className="od-attachments-lightbox__btn od-attachments-lightbox__info-close"
                aria-label="Cerrar información"
                title="Cerrar información"
                onClick={onToggleInfo}
              >
                <IonIcon icon={closeOutline} />
              </button>

              {renderInfoHeaderActions?.()}
            </div>

            <h2>Información</h2>
          </header>

          {renderInfo()}
        </aside>
      ) : null}

      <div
        ref={stageRef}
        className="od-attachments-lightbox__stage"
      >
        {isVideo ? (
          <video
            className="od-attachments-lightbox__video"
            src={viewer.url}
            poster={viewer.poster || undefined}
            controls
            preload="metadata"
          />
        ) : (
          <img
            key={viewer.url}
            ref={imageRef}
            src={viewer.url}
            alt={title}
            className="od-attachments-lightbox__img"
            style={
              size
                ? {
                    ...size,
                    maxWidth: "none",
                    maxHeight: "none",
                    flex: "0 0 auto",
                    margin: "auto",
                  }
                : undefined
            }
            onLoad={(event) => {
              syncNaturalSize(event.currentTarget);
            }}
          />
        )}
      </div>

      <button
        type="button"
        className="od-attachments-lightbox__nav od-attachments-lightbox__nav--next"
        aria-label="Siguiente"
        disabled={!hasNext}
        onClick={() => move("next")}
      >
        <IonIcon icon={chevronForwardOutline} />
      </button>
    </div>,
    document.body,
  );
}
