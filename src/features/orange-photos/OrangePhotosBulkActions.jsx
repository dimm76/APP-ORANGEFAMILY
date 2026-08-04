import { useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { albumsOutline, shareSocialOutline } from "ionicons/icons";
import ODFilterSelect from "../../shared/components/ODFilterSelect.jsx";
import { OD_ICONS } from "../../shared/ui/odIcons.js";
import OrangeAlbumCreateModal from "./OrangeAlbumCreateModal.jsx";
import OrangePhotoShareModal from "./OrangePhotoShareModal.jsx";
import OrangePhotosBulkEditModal from "./OrangePhotosBulkEditModal.jsx";

const MAX_BULK_SELECTION = 500;
const MAX_ZIP_SELECTION = 500;
const BULK_LIMIT_MESSAGE = "Puedes realizar acciones sobre un máximo de 500 elementos a la vez.";
const ZIP_LIMIT_MESSAGE = "Puedes descargar un máximo de 500 elementos a la vez.";

export default function OrangePhotosBulkActions({
  photos,
  albums,
  categories = [],
  members,
  onClose,
  onAlbum,
  onCreateAlbum,
  onShare,
  onDownload,
  onTrash,
  onFavorite,
  onEdit,
  capabilities = {},
}) {
  const can = { share: capabilities.share !== false, album: capabilities.album !== false, download: capabilities.download !== false, trash: capabilities.trash !== false, favorite: capabilities.favorite !== false, edit: capabilities.edit !== false };
  const [modal, setModal] = useState("");
  const [albumId, setAlbumId] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const shareRef = useRef(null);
  const allFavorite =
    photos.length > 0 && photos.every(photo => photo.is_favorite);
  const writableAlbums = albums.filter(
    album => album.is_owner || album.can_contribute,
  );
  const validateSelection = (
    limit = MAX_BULK_SELECTION,
    message = BULK_LIMIT_MESSAGE,
  ) => {
    if (photos.length <= limit) return true;
    setResult(message);
    return false;
  };
  const open = value => {
    if (!validateSelection()) return;
    setResult("");
    setModal(value);
  };
  const run = async (
    action,
    {
      showSuccess = true,
      limit = MAX_BULK_SELECTION,
      limitMessage = BULK_LIMIT_MESSAGE,
    } = {},
  ) => {
    if (!validateSelection(limit, limitMessage)) return false;
    setBusy(true);
    setResult("");
    try {
      const summary = await action();
      if (summary || showSuccess) setResult(summary || "Operación completada");
      return true;
    } catch (error) {
      setResult(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const submitAlbum = async id => {
    if (await run(() => onAlbum(id))) {
      setModal("");
    }
  };
  const handleCreatedAlbum = album => {
    setAlbumId(album.id);
    setModal("album");
    void submitAlbum(album.id);
  };

  return (
    <>
      <div
        className="od-orangephotos-selection-actions"
        role="toolbar"
        aria-label="Acciones de selección"
      >
        <button
          className="od-orangephotos-header-icon"
          type="button"
          aria-label="Cerrar selección"
          title="Cerrar selección"
          onClick={onClose}
        >
          <IonIcon icon={OD_ICONS.bulkExit} />
        </button>
        <strong>{photos.length} seleccionadas</strong>
        {can.share ? <button
          ref={shareRef}
          className="od-orangephotos-header-icon"
          type="button"
          aria-label="Compartir"
          title="Compartir"
          onClick={() => open("share")}
        >
          <IonIcon icon={shareSocialOutline} />
        </button> : null}
        {can.album ? <button
          className="od-orangephotos-header-icon"
          type="button"
          aria-label="Añadir a álbum"
          title="Añadir a álbum"
          onClick={() => open("album")}
        >
          <IonIcon icon={albumsOutline} />
        </button> : null}
        {can.download ? <button
          className="od-orangephotos-header-icon"
          type="button"
          aria-label="Descargar"
          title="Descargar"
          onClick={() =>
            void run(onDownload, {
              showSuccess: false,
              limit: MAX_ZIP_SELECTION,
              limitMessage: ZIP_LIMIT_MESSAGE,
            })
          }
        >
          <IonIcon icon={OD_ICONS.export} />
        </button> : null}
        {can.trash ? <button
          className="od-orangephotos-header-icon od-orangephotos-header-icon--danger"
          type="button"
          aria-label="Mover a la papelera"
          title="Mover a la papelera"
          onClick={() => open("trash")}
        >
          <IonIcon icon={OD_ICONS.delete} />
        </button> : null}
        {(can.favorite || can.edit) ? <button
          className="od-orangephotos-header-icon"
          type="button"
          aria-label="Más acciones"
          title="Más acciones"
          onClick={() => setModal(modal === "more" ? "" : "more")}
        >
          <IonIcon icon={OD_ICONS.menuMore} />
        </button> : null}
        {modal === "more" ? (
          <div className="od-orangephotos-bulk-menu">
            {can.favorite ? <button
              className="od-action-menu-item"
              type="button"
              onClick={() => void run(() => onFavorite(!allFavorite))}
            >
              {allFavorite ? "Quitar de favoritas" : "Marcar como favoritas"}
            </button> : null}
            {can.edit ? <button
              className="od-action-menu-item"
              type="button"
              onClick={() => open("date")}
            >
              Cambiar fecha y hora
            </button> : null}
            {can.edit ? <button
              className="od-action-menu-item"
              type="button"
              onClick={() => open("location")}
            >
              Editar ubicación
            </button> : null}
          </div>
        ) : null}
      </div>

      {result ? (
        <span className="od-orangephotos-bulk-result" role="status">
          {result}
        </span>
      ) : null}

      {modal === "album" ? (
        <div className="od-modal-backdrop">
          <section className="od-modal" role="dialog" aria-modal="true">
            <header className="od-modal-header">
              <h2 className="od-modal-title">Añadir a álbum</h2>
              <button
                className="od-modal-close"
                type="button"
                aria-label="Cerrar"
                disabled={busy}
                onClick={() => setModal("")}
              >
                ×
              </button>
            </header>
            <div className="od-modal-body">
              <div className="od-orange-album-form__section">
                <ODFilterSelect
                  mode="single"
                  options={writableAlbums.map(album => ({
                    value: album.id,
                    label: album.title,
                  }))}
                  value={albumId}
                  onChange={setAlbumId}
                  searchable
                  panelPortal
                  placeholder="Selecciona un álbum"
                />
                <div>
                  <button
                    className="od-btn od-btn-secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setResult("");
                      setModal("album-create");
                    }}
                  >
                    Crear álbum con la selección
                  </button>
                </div>
              </div>

              {result ? (
                <p className="od-status-line od-status-line--error">
                  {result}
                </p>
              ) : null}

              <footer className="od-orange-photos-modal__footer">
                <button
                  className="od-btn od-btn-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setModal("")}
                >
                  Cancelar
                </button>
                <button
                  className="od-btn od-btn-primary"
                  type="button"
                  disabled={!albumId || busy}
                  onClick={() => void submitAlbum(albumId)}
                >
                  Añadir
                </button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}

      {modal === "album-create" && onCreateAlbum ? (
        <OrangeAlbumCreateModal
          categories={categories}
          members={members}
          submitLabel="Crear y añadir"
          onClose={() => setModal("album")}
          onCreate={onCreateAlbum}
          onCreated={handleCreatedAlbum}
        />
      ) : null}

      {modal === "trash" ? (
        <div className="od-modal-backdrop">
          <section className="od-modal" role="alertdialog" aria-modal="true">
            <header className="od-modal-header">
              <h2 className="od-modal-title">Mover a la papelera</h2>
            </header>
            <div className="od-modal-body">
              <p>
                Se moverán {photos.length} elementos. Podrán restaurarse
                después.
              </p>
              <footer className="od-orange-photos-modal__footer">
                <button
                  className="od-btn od-btn-secondary"
                  type="button"
                  onClick={() => setModal("")}
                >
                  Cancelar
                </button>
                <button
                  className="od-btn od-btn-danger"
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    if (await run(onTrash)) setModal("");
                  }}
                >
                  Mover
                </button>
              </footer>
            </div>
          </section>
        </div>
      ) : null}

      {modal === "share" ? (
        <OrangePhotoShareModal
          photo={{ visibility: "private", shared_user_ids: [] }}
          photoIds={photos.map(photo => photo.id)}
          members={members}
          returnFocusRef={shareRef}
          onClose={() => setModal("")}
          onSave={async body => {
            if (await run(() => onShare(body))) setModal("");
          }}
        />
      ) : null}

      {modal === "date" || modal === "location" ? (
        <OrangePhotosBulkEditModal
          mode={modal}
          count={photos.length}
          onClose={() => setModal("")}
          onConfirm={async body => {
            if (await run(() => onEdit(body, modal === "date"))) setModal("");
          }}
        />
      ) : null}
    </>
  );
}
