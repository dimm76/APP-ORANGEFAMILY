import { IonIcon } from "@ionic/react";
import { OD_ICONS } from "../ui/odIcons.js";

export default function ImageSourcePickerModal({
  open,
  onClose,
  onPickUpload,
  onPickLibrary,
}) {
  if (!open) return null;

  return (
    <div
      className="od-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="od-image-source-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section className="od-modal od-image-source-modal">
        <header className="od-modal-header">
          <div>
            <h2 id="od-image-source-title" className="od-modal-title">
              Insertar imagen
            </h2>
            <p className="od-modal-subtitle">
              Elige desde donde quieres anadir la imagen.
            </p>
          </div>
          <button type="button" className="od-modal-close" onClick={onClose} aria-label="Cerrar">
            <IonIcon icon={OD_ICONS.bulkExit} aria-hidden="true" />
          </button>
        </header>

        <div className="od-modal-body">
          <div className="od-image-source-options">
            <button type="button" className="od-image-source-card" onClick={onPickUpload}>
              <span className="od-image-source-card__icon">
                <IonIcon icon={OD_ICONS.import} aria-hidden="true" />
              </span>
              <span className="od-image-source-card__content">
                <strong>Subir imagen del ordenador</strong>
                <span>Abre el explorador de archivos y sube la imagen a Wasabi.</span>
              </span>
            </button>

            <button type="button" className="od-image-source-card" onClick={onPickLibrary}>
              <span className="od-image-source-card__icon">
                <IonIcon icon={OD_ICONS.richImage} aria-hidden="true" />
              </span>
              <span className="od-image-source-card__content">
                <strong>Elegir imagen de la biblioteca</strong>
                <span>Usa una imagen ya guardada como attachment.</span>
              </span>
            </button>
          </div>

          <div className="od-modal-actions">
            <button type="button" className="od-button-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
