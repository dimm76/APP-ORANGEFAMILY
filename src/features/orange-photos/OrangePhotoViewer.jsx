import { useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import {
  arrowUndoOutline,
  checkboxOutline,
  ellipsisVerticalOutline,
  heart,
  heartOutline,
  shareSocialOutline,
} from "ionicons/icons";
import AttachmentsImageLightbox from "../../shared/components/AttachmentsImageLightbox.jsx";
import { orangePhotoDownloadUrl } from "../../shared/api/orangePhotosApi.js";
import { OD_ICONS } from "../../shared/ui/odIcons.js";
import OrangePhotoDetailsPanel from "./OrangePhotoDetailsPanel.jsx";
import OrangePhotoShareModal from "./OrangePhotoShareModal.jsx";

export default function OrangePhotoViewer({
  photo,
  members,
  selected,
  trashMode,
  onToggleSelected,
  onToggleFavorite,
  onClose,
  onSave,
  onShareSave,
  onTrash,
  onRestore,
  onPurge,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  positionLabel,
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  const shareButtonRef = useRef(null);
  const moreButtonRef = useRef(null);

  const displayTitle =
    photo.title?.trim() ||
    photo.original_filename?.trim() ||
    "Sin título";

  const notify = (message) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2000);
  };

  const save = async (body) => {
    setFeedback("Guardando…");

    try {
      await onSave(body);
      notify("Cambios guardados");
    } catch (error) {
      setFeedback(error.message);
    }
  };

  const closeMore = () => {
    setMoreOpen(false);
  };

  const handleTrash = () => {
    closeMore();
    onTrash();
  };

  const handleRestore = () => {
    closeMore();
    onRestore();
  };

  const handlePurge = () => {
    closeMore();
    onPurge();
  };

  return (
    <>
      <AttachmentsImageLightbox
        viewer={{
          url:
            photo.original_url ||
            photo.preview_url ||
            photo.thumbnail_url,
          poster: photo.poster_url || photo.thumbnail_url,
          mediaType: photo.media_type,
          title: displayTitle,
          positionLabel,
        }}
        onClose={onClose}
        onPrevious={onPrevious}
        onNext={onNext}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        infoOpen={infoOpen}
        onToggleInfo={() => setInfoOpen((open) => !open)}
        renderInfo={() => (
          <OrangePhotoDetailsPanel
            photo={photo}
            members={members}
            onSave={save}
            feedback={feedback}
          />
        )}
        renderExtraActions={() => (
          <>
            {!trashMode ? (
              <>
                <button
                  className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--primary-action${selected ? " is-selected" : ""}`}
                  type="button"
                  aria-label={selected ? "Quitar de la selección" : "Añadir a la selección"}
                  title={selected ? "Quitar de la selección" : "Añadir a la selección"}
                  onClick={onToggleSelected}
                >
                  <IonIcon icon={checkboxOutline} />
                </button>

                <button
                  className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--primary-action${photo.is_favorite ? " is-active" : ""}`}
                  type="button"
                  aria-label={photo.is_favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
                  title={photo.is_favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
                  onClick={onToggleFavorite}
                >
                  <IonIcon icon={photo.is_favorite ? heart : heartOutline} />
                </button>

                <button
                  ref={shareButtonRef}
                  className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--primary-action${photo.visibility !== "private" ? " is-active" : ""}`}
                  type="button"
                  aria-label="Compartir"
                  title="Compartir"
                  onClick={() => setShareOpen(true)}
                >
                  <IonIcon icon={shareSocialOutline} />
                </button>
              </>
            ) : null}

            <div className="od-attachments-lightbox__more">
              <button
                ref={moreButtonRef}
                className="od-attachments-lightbox__btn od-attachments-lightbox__btn--more"
                type="button"
                aria-label="Más acciones"
                title="Más acciones"
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((open) => !open)}
              >
                <IonIcon icon={ellipsisVerticalOutline} />
              </button>

              {moreOpen ? (
                <>
                  <button
                    className="od-attachments-lightbox__more-backdrop"
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={closeMore}
                  />

                  <div className="od-attachments-lightbox__more-menu" role="menu">
                    {!trashMode ? (
                      <a
                        className="od-attachments-lightbox__more-item"
                        href={orangePhotoDownloadUrl(photo.id)}
                        role="menuitem"
                        onClick={closeMore}
                      >
                        <IonIcon icon={OD_ICONS.export} />
                        <span>Descargar</span>
                      </a>
                    ) : null}

                    {trashMode && photo.is_owner ? (
                      <>
                        <button
                          className="od-attachments-lightbox__more-item"
                          type="button"
                          role="menuitem"
                          onClick={handleRestore}
                        >
                          <IonIcon icon={arrowUndoOutline} />
                          <span>Restaurar</span>
                        </button>

                        <button
                          className="od-attachments-lightbox__more-item od-attachments-lightbox__more-item--danger"
                          type="button"
                          role="menuitem"
                          onClick={handlePurge}
                        >
                          <IonIcon icon={OD_ICONS.delete} />
                          <span>Eliminar definitivamente</span>
                        </button>
                      </>
                    ) : photo.is_owner ? (
                      <button
                        className="od-attachments-lightbox__more-item od-attachments-lightbox__more-item--danger"
                        type="button"
                        role="menuitem"
                        onClick={handleTrash}
                      >
                        <IonIcon icon={OD_ICONS.delete} />
                        <span>Mover a la papelera</span>
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </>
        )}
      />

      {!trashMode && shareOpen ? (
        <OrangePhotoShareModal
          photo={photo}
          members={members}
          returnFocusRef={shareButtonRef}
          onClose={() => setShareOpen(false)}
          onSave={async (body) => {
            await onShareSave(body);
            setShareOpen(false);
            notify("Compartición actualizada");
          }}
        />
      ) : null}
    </>
  );
}
