import { useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import {
  addOutline,
  arrowUndoOutline,
  checkboxOutline,
  ellipsisVerticalOutline,
  eyeOffOutline,
  eyeOutline,
  heart,
  heartOutline,
  imageOutline,
  removeOutline,
  shareSocialOutline,
  timeOutline,
} from "ionicons/icons";
import AttachmentsImageLightbox from "../../shared/components/AttachmentsImageLightbox.jsx";
import { orangePhotoDownloadUrl } from "../../shared/api/orangePhotosApi.js";
import { OD_ICONS } from "../../shared/ui/odIcons.js";
import OrangePhotoDetailsPanel from "./OrangePhotoDetailsPanel.jsx";
import OrangePhotoShareModal from "./OrangePhotoShareModal.jsx";
import OrangePhotoEventsModal from "./OrangePhotoEventsModal.jsx";
const DEFAULT_CAPABILITIES = Object.freeze({select:true,favorite:true,share:true,download:true,editDetails:true,history:true,generatePoster:true,trash:true,restore:true,purge:true,addToLibrary:false,removeFromLibrary:false,hide:false});

export default function OrangePhotoViewer({
  photo,
  members,
  selected,
  trashMode,
  onToggleSelected,
  onToggleFavorite,
  onClose,
  onSave,
  onGeneratePoster,
  onShareSave,
  onTrash,
  onRestore,
  onPurge,
  onAddToLibrary,
  onRemoveFromLibrary,
  onSetHidden,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  positionLabel,
  capabilities,
  downloadUrl,
  onPublicLinkChange,
}) {
  const allowed={...DEFAULT_CAPABILITIES,...(capabilities||{})};
  const effectiveDownloadUrl=downloadUrl||orangePhotoDownloadUrl(photo.id);
  const [infoOpen, setInfoOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [eventsPhotoId, setEventsPhotoId] = useState(null);
  const [posterBusy,setPosterBusy]=useState(false);
  const [posterError,setPosterError]=useState("");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [hiddenBusy, setHiddenBusy] = useState(false);
  const [hiddenError, setHiddenError] = useState("");

  const shareButtonRef = useRef(null);
  const moreButtonRef = useRef(null);
  const eventsButtonRef = useRef(null);

  const eventsOpen = eventsPhotoId === photo.id;
  const hasPoster = Boolean(photo.poster_url || photo.thumbnail_url);

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
      await onSave?.(body);
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

  const handleGeneratePoster = async () => {
    if (
      hasPoster &&
      !window.confirm(
        "Se sustituirá la miniatura actual del vídeo. El vídeo original no se modificará.",
      )
    ) {
      return;
    }

    setPosterBusy(true);
    setPosterError("");

    try {
      await onGeneratePoster(hasPoster);
      notify(hasPoster ? "Miniatura recreada" : "Miniatura generada");
      closeMore();
    } catch (error) {
      setPosterError(
        error?.message || "No se pudo generar la miniatura.",
      );
    } finally {
      setPosterBusy(false);
    }
  };

  const handleAddToLibrary = async () => {
    if (libraryBusy) return;

    setLibraryBusy(true);
    setLibraryError("");

    try {
      await onAddToLibrary?.();
      notify("Añadida a tu biblioteca");
      closeMore();
    } catch (error) {
      setLibraryError(
        error?.message || "No se pudo añadir a tu biblioteca.",
      );
    } finally {
      setLibraryBusy(false);
    }
  };

  const handleRemoveFromLibrary = async () => {
    if (libraryBusy) return;

    if (
      !window.confirm(
        "Se quitará de tu biblioteca. La foto original no se eliminará. Si ya no está compartida contigo, dejarás de tener acceso.",
      )
    ) {
      return;
    }

    setLibraryBusy(true);
    setLibraryError("");

    let removed = false;

    try {
      await onRemoveFromLibrary?.();
      removed = true;
      closeMore();
    } catch (error) {
      setLibraryError(
        error?.message || "No se pudo quitar de tu biblioteca.",
      );
    } finally {
      setLibraryBusy(false);
    }

    if (removed) {
      onClose?.();
    }
  };

  const handleSetHidden = async () => {
    if (hiddenBusy) return;
    setHiddenBusy(true);
    setHiddenError("");
    try {
      await onSetHidden?.(!photo.is_hidden);
      closeMore();
    } catch (error) {
      setHiddenError(error?.message || "No se pudo actualizar la visibilidad personal de la foto.");
    } finally {
      setHiddenBusy(false);
    }
  };

  return (
    <>
      <AttachmentsImageLightbox
        viewer={{
          url:
            photo.preview_url ||
            photo.original_url ||
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
            readOnly={!photo.is_owner || !allowed.editDetails}
          />
        )}
        renderInfoHeaderActions={photo.is_owner&&allowed.history ? () => (
          <button
            ref={eventsButtonRef}
            type="button"
            className="od-attachments-lightbox__btn od-attachments-lightbox__info-history"
            aria-label="Ver historial de la foto"
            title="Ver historial de la foto"
            onClick={() => setEventsPhotoId(photo.id)}
          >
            <IonIcon icon={timeOutline} />
          </button>
        ) : undefined}
        renderExtraActions={() => (
          <>
            {!trashMode ? (
              <>
                {allowed.select?<button
                  className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--primary-action${selected ? " is-selected" : ""}`}
                  type="button"
                  aria-label={selected ? "Quitar de la selección" : "Añadir a la selección"}
                  title={selected ? "Quitar de la selección" : "Añadir a la selección"}
                  onClick={onToggleSelected}
                >
                  <IonIcon icon={checkboxOutline} />
                </button>:null}

                {allowed.favorite&&photo.is_owner?<button
                  className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--primary-action${photo.is_favorite ? " is-active" : ""}`}
                  type="button"
                  aria-label={photo.is_favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
                  title={photo.is_favorite ? "Quitar de favoritas" : "Añadir a favoritas"}
                  onClick={onToggleFavorite}
                >
                  <IonIcon icon={photo.is_favorite ? heart : heartOutline} />
                </button>:null}

                {allowed.share&&photo.is_owner?<button
                  ref={shareButtonRef}
                  className={`od-attachments-lightbox__btn od-attachments-lightbox__btn--primary-action${photo.visibility !== "private" ? " is-active" : ""}`}
                  type="button"
                  aria-label="Compartir"
                  title="Compartir"
                  onClick={() => setShareOpen(true)}
                >
                  <IonIcon icon={shareSocialOutline} />
                </button>:null}
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
                    {photo.media_type==="video"&&photo.is_original_owner===true?<button className="od-attachments-lightbox__more-item" type="button" role="menuitem" disabled={posterBusy} onClick={handleGeneratePoster}><IonIcon icon={imageOutline}/><span>{posterBusy?"Generando miniatura…":hasPoster?"Recrear miniatura":"Generar miniatura"}</span></button>:null}
                    {posterError?<small className="od-status-line od-status-line--error">{posterError}</small>:null}
                    {!trashMode&&allowed.addToLibrary&&photo.is_original_owner===false&&photo.is_in_library!==true ? <>
                      <button className="od-attachments-lightbox__more-item" type="button" role="menuitem" disabled={libraryBusy} onClick={handleAddToLibrary}>
                        <IonIcon icon={addOutline} />
                        <span>{libraryBusy ? "Añadiendo a tu biblioteca…" : "Añadir a mi biblioteca"}</span>
                      </button>
                      {libraryError ? <small className="od-status-line od-status-line--error">{libraryError}</small> : null}
                    </> : null}
                    {!trashMode&&allowed.removeFromLibrary&&photo.is_original_owner===false&&photo.is_in_library===true ? <>
                      <button className="od-attachments-lightbox__more-item" type="button" role="menuitem" disabled={libraryBusy} onClick={handleRemoveFromLibrary}>
                        <IonIcon icon={removeOutline} />
                        <span>{libraryBusy ? "Quitando de tu biblioteca…" : "Quitar de mi biblioteca"}</span>
                      </button>
                      {libraryError ? <small className="od-status-line od-status-line--error">{libraryError}</small> : null}
                    </> : null}
                    {!trashMode&&allowed.hide&&photo.is_original_owner===false ? <>
                      <button className="od-attachments-lightbox__more-item" type="button" role="menuitem" disabled={hiddenBusy} onClick={handleSetHidden}>
                        <IonIcon icon={photo.is_hidden===true ? eyeOutline : eyeOffOutline} />
                        <span>{photo.is_hidden===true ? "Mostrar imagen" : "Ocultar imagen"}</span>
                      </button>
                      {hiddenError ? <small className="od-status-line od-status-line--error">{hiddenError}</small> : null}
                    </> : null}
                    {!trashMode&&allowed.download ? (
                      <a
                        className="od-attachments-lightbox__more-item"
                        href={effectiveDownloadUrl}
                        role="menuitem"
                        onClick={closeMore}
                      >
                        <IonIcon icon={OD_ICONS.export} />
                        <span>Descargar</span>
                      </a>
                    ) : null}

                    {trashMode && photo.is_owner&&(allowed.restore||allowed.purge) ? (
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
                    ) : photo.is_owner&&allowed.trash ? (
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

      {!trashMode && shareOpen&&allowed.share ? (
        <OrangePhotoShareModal
          photo={photo}
          members={members}
          returnFocusRef={shareButtonRef}
          onClose={() => setShareOpen(false)}
          onSave={async (body) => {
            await onShareSave?.(body);
            setShareOpen(false);
            notify("Compartición actualizada");
          }}
          onPublicLinkChange={onPublicLinkChange}
        />
      ) : null}

      {eventsOpen && photo.is_owner&&allowed.history ? (
        <OrangePhotoEventsModal
          photo={photo}
          returnFocusRef={eventsButtonRef}
          onClose={() => setEventsPhotoId(null)}
        />
      ) : null}
    </>
  );
}
