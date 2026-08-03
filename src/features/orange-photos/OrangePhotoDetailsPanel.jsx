/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { IonIcon } from "@ionic/react";
import {
  calendarOutline,
  cameraOutline,
  documentOutline,
  locationOutline,
  personOutline,
} from "ionicons/icons";

function toLocalDateTimeInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number) => String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function DetailSection({ icon, title, children }) {
  return (
    <section className="od-orange-photo-details__section">
      <div className="od-orange-photo-details__section-icon">
        <IonIcon icon={icon} />
      </div>

      <div className="od-orange-photo-details__section-content">
        <h3>{title}</h3>
        {children}
      </div>
    </section>
  );
}

export default function OrangePhotoDetailsPanel({
  photo,
  members = [],
  onSave,
  feedback,
  readOnly = false,
}) {
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({
      title: photo?.title || "",
      description: photo?.description || "",
      captured_at: toLocalDateTimeInput(photo?.captured_at),
      timezone: photo?.timezone || "",
      location_name: photo?.location_name || "",
    });
  }, [photo]);

  if (!photo) return null;

  const set = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const names = (photo.shared_user_ids || [])
    .map(
      (id) =>
        members.find((member) => member.id === id)
          ?.display_name,
    )
    .filter(Boolean);

  const visibility =
    photo.visibility === "family"
      ? "Compartida con toda la familia"
      : photo.visibility === "selected"
        ? `Compartida con ${names.length ? names.join(", ") : "personas concretas"}`
        : "Privada";

  const camera = [
    photo.camera_make,
    photo.camera_model,
  ]
    .filter(Boolean)
    .join(" ");

  if(readOnly){const date=photo.captured_at?new Date(photo.captured_at).toLocaleString("es-ES"):"â€”",duration=photo.duration_seconds?`${Math.round(Number(photo.duration_seconds))} s`:"â€”";return <div className="od-orange-photo-details"><DetailSection icon={documentOutline} title="Descripción"><p>{photo.description||"â€”"}</p></DetailSection><DetailSection icon={personOutline} title="Propiedad"><p><strong>Propietario:</strong> {photo.owner_display_name||"â€”"}</p></DetailSection><DetailSection icon={calendarOutline} title="Fecha y hora"><p>{date}</p></DetailSection><DetailSection icon={cameraOutline} title="Cámara y captura"><p>{camera||"â€”"}</p><p><strong>Lente:</strong> {photo.lens_model||"â€”"}</p></DetailSection><DetailSection icon={documentOutline} title="Archivo"><p><strong>{photo.title||"â€”"}</strong></p><p>{photo.original_filename||"â€”"}</p><small>{photo.width&&photo.height?`${photo.width} × ${photo.height}`:"â€”"}{photo.media_type==="video"?` · ${duration}`:""}</small></DetailSection><DetailSection icon={locationOutline} title="Ubicación"><p>{photo.location_name||"â€”"}</p></DetailSection></div>;}

  return (
    <div className="od-orange-photo-details">
      <DetailSection icon={documentOutline} title="Descripción">
        <textarea
          className="od-filter-input od-orange-photo-details__textarea"
          placeholder="Añadir una descripción"
          value={form.description}
          onChange={(event) =>
            set("description", event.target.value)
          }
        />
      </DetailSection>

      <DetailSection icon={personOutline} title="Propiedad y compartición">
        <p className="od-orange-photo-details__primary">
          <strong>Propietario:</strong>{" "}
          {photo.owner_display_name || "No disponible"}
        </p>

        <p className="od-orange-photo-details__secondary">
          {visibility}
        </p>
      </DetailSection>

      <DetailSection icon={calendarOutline} title="Fecha y hora">
        <input
          className="od-filter-input"
          type="datetime-local"
          value={form.captured_at}
          onChange={(event) =>
            set("captured_at", event.target.value)
          }
        />

        {form.timezone ? (
          <small>{form.timezone}</small>
        ) : null}
      </DetailSection>

      {camera ? (
        <DetailSection icon={cameraOutline} title="Cámara y captura">
          <p className="od-orange-photo-details__primary">
            {camera}
          </p>
        </DetailSection>
      ) : null}

      <DetailSection icon={documentOutline} title="Archivo">
        {photo.title ? (
          <label className="od-orange-photo-details__field">
            <span>Nombre visible</span>

            <input
              className="od-filter-input"
              value={form.title}
              onChange={(event) =>
                set("title", event.target.value)
              }
            />
          </label>
        ) : null}

        <p className="od-orange-photo-details__primary">
          <strong>
            {photo.original_filename || "Archivo"}
          </strong>
        </p>

        {photo.width && photo.height ? (
          <small>
            {photo.width} × {photo.height}
          </small>
        ) : null}
      </DetailSection>

      <DetailSection icon={locationOutline} title="Ubicación">
        <input
          className="od-filter-input"
          placeholder="Añadir una ubicación"
          value={form.location_name}
          onChange={(event) =>
            set("location_name", event.target.value)
          }
        />

        <details className="od-orange-photo-details__technical">
          <summary>Detalles técnicos</summary>

          {photo.latitude != null ||
          photo.longitude != null ? (
            <p>
              {photo.latitude ?? "—"},{" "}
              {photo.longitude ?? "—"}
            </p>
          ) : (
            <p>Sin coordenadas</p>
          )}
        </details>
      </DetailSection>

      {photo.is_owner ? (
        <button
          className="od-modal-primary od-orange-photo-details__save"
          type="button"
          disabled={feedback === "Guardando…"}
          onClick={() => {
            const body = {
              ...form,
              captured_at: form.captured_at
                ? new Date(
                    form.captured_at,
                  ).toISOString()
                : null,
            };

            onSave(body);
          }}
        >
          {feedback === "Guardando…"
            ? feedback
            : "Guardar cambios"}
        </button>
      ) : null}

      {feedback ? (
        <p
          className="od-orange-photo-details__feedback"
          role="status"
        >
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
