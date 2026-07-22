import { useEffect, useMemo, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { listImageAttachments } from "../api/attachmentsApi.js";
import { OD_ICONS } from "../ui/odIcons.js";
import {
  modalBackdropLevelClass,
  useModalStackLayer,
} from "../overlay/useModalStackLayer.js";
import AttachmentsImageLightbox from "./AttachmentsImageLightbox.jsx";

const DATE_INTERVAL_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana pasada" },
  { value: "this_month", label: "Este mes" },
  { value: "last_month", label: "Mes pasado" },
  { value: "last_30_days", label: "Ultimos 30 dias" },
  { value: "this_year", label: "Este ano" },
  { value: "last_year", label: "Ano pasado" },
];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDateIntervalRangeIso(intervalKey) {
  const now = new Date();
  const today0 = startOfLocalDay(now);
  const tomorrow0 = addDays(today0, 1);

  switch (intervalKey) {
    case "today":
      return { from: today0.toISOString(), to: tomorrow0.toISOString() };

    case "yesterday": {
      const yesterday0 = addDays(today0, -1);
      return { from: yesterday0.toISOString(), to: today0.toISOString() };
    }

    case "this_week": {
      const dow = now.getDay();
      const mondayOffset = (dow + 6) % 7;
      const monday = addDays(today0, -mondayOffset);
      return { from: monday.toISOString(), to: tomorrow0.toISOString() };
    }

    case "last_week": {
      const dow = now.getDay();
      const mondayOffset = (dow + 6) % 7;
      const thisMonday = addDays(today0, -mondayOffset);
      const lastMonday = addDays(thisMonday, -7);
      return { from: lastMonday.toISOString(), to: thisMonday.toISOString() };
    }

    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: first.toISOString(), to: tomorrow0.toISOString() };
    }

    case "last_month": {
      const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        from: firstLastMonth.toISOString(),
        to: firstThisMonth.toISOString(),
      };
    }

    case "last_30_days": {
      const start = addDays(today0, -30);
      return { from: start.toISOString(), to: tomorrow0.toISOString() };
    }

    case "this_year": {
      const first = new Date(now.getFullYear(), 0, 1);
      return { from: first.toISOString(), to: tomorrow0.toISOString() };
    }

    case "last_year": {
      const year = now.getFullYear();
      const firstLastYear = new Date(year - 1, 0, 1);
      const firstThisYear = new Date(year, 0, 1);
      return {
        from: firstLastYear.toISOString(),
        to: firstThisYear.toISOString(),
      };
    }

    case "all":
    default:
      return { from: "", to: "" };
  }
}

function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AttachmentImageLibraryModal({ open, onClose, onConfirm, composeMode = false, onSelectLocalFile, showDisabledUrlSource = false }) {
  const localFileInputRef = useRef(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [dateInterval, setDateInterval] = useState("all");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const limit = 30;

  const selectedImage = useMemo(
    () => items.find((item) => String(item.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const dateRange = useMemo(
    () => getDateIntervalRangeIso(dateInterval),
    [dateInterval]
  );
  const stackLevel = useModalStackLayer(open);

  useEffect(() => {
    if (!open) return undefined;

    const timeout = window.setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [open, q]);

  useEffect(() => {
    if (!open) return undefined;

    setPage(1);
  }, [open, dateInterval]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    async function loadImages() {
      setLoading(true);
      setError("");

      try {
        const result = await listImageAttachments({
          q: debouncedQ,
          page,
          limit,
          from: dateRange.from,
          to: dateRange.to,
        });

        if (cancelled) return;

        setItems(result.items);
        setTotal(result.total);
        setSelectedId((current) =>
          current && result.items.some((item) => String(item.id) === String(current))
            ? current
            : null
        );
      } catch (loadError) {
        if (cancelled) return;

        setError(loadError?.message || "No se han podido cargar las imagenes.");
        setItems([]);
        setTotal(0);
        setSelectedId(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadImages();

    return () => {
      cancelled = true;
    };
  }, [debouncedQ, dateRange.from, dateRange.to, open, page]);

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));

  async function handleConfirm() {
    if (!selectedImage || confirming) return;

    setConfirming(true);
    setError("");

    try {
      await onConfirm?.(selectedImage);
    } catch (confirmError) {
      setError(confirmError?.message || "No se ha podido insertar la imagen.");
    } finally {
      setConfirming(false);
    }
  }

  function openViewer(image) {
    if (!image?.url) return;

    setViewer({
      url: image.url,
      title: image.filename || image.alt || "Imagen",
      id: image.id,
    });
  }

  return (
    <>
      <div
        className={`od-modal-backdrop ${modalBackdropLevelClass(stackLevel)}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="od-image-library-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !confirming) onClose?.();
        }}
      >
        <section className="od-modal od-attachment-library-modal">
          <header className="od-modal-header">
            <div>
              <h2 id="od-image-library-title" className="od-modal-title">
                Biblioteca de imagenes
              </h2>
              <p className="od-modal-subtitle">
                Selecciona una imagen ya subida a Wasabi.
              </p>
            </div>

            <button
              type="button"
              className="od-modal-close"
              onClick={onClose}
              aria-label="Cerrar"
              disabled={confirming}
            >
              <IonIcon icon={OD_ICONS.bulkExit} aria-hidden="true" />
            </button>
          </header>

          <div className="od-modal-body">
            {composeMode ? (
              <div className="od-attachment-library-compose-sources">
                <button type="button" className="od-filter-button od-filter-button--active" aria-pressed="true">
                  Biblioteca OrangeDesk
                </button>
                <input
                  ref={localFileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onSelectLocalFile?.(file);
                    event.target.value = "";
                  }}
                />
                <button type="button" className="od-filter-button" onClick={() => localFileInputRef.current?.click()}>
                  Subir desde equipo
                </button>
                {showDisabledUrlSource ? (
                  <span title="Inserción por URL pendiente de implementación">
                    <button type="button" className="od-filter-button" title="Inserción por URL pendiente de implementación" disabled>
                      Dirección web
                    </button>
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="od-filters od-attachment-library-toolbar">
              <div className="od-filters-row od-filters-row--main od-attachment-library-toolbar__row">
                <div className="od-filter-field od-attachment-library-search">
                  <label className="od-filter-label" htmlFor="od-image-library-search">
                    Buscar imagen
                  </label>
                  <input
                    id="od-image-library-search"
                    className="od-filter-input"
                    type="search"
                    value={q}
                    placeholder="Buscar por nombre..."
                    onChange={(event) => setQ(event.target.value)}
                  />
                </div>

                <div className="od-filter-field od-attachment-library-date-filter">
                  <label className="od-filter-label" htmlFor="od-image-library-date">
                    Fecha
                  </label>
                  <select
                    id="od-image-library-date"
                    className="od-filter-select"
                    value={dateInterval}
                    onChange={(event) => setDateInterval(event.target.value)}
                  >
                    {DATE_INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="od-filter-field od-attachment-library-view-field">
                  <span className="od-filter-label">Vista</span>
                  <button
                    type="button"
                    className="od-filter-button od-filter-button--active od-attachment-library-grid-toggle"
                    aria-pressed="true"
                    title="Vista grid"
                  >
                    <IonIcon icon={OD_ICONS.kanbanColumns} aria-hidden="true" />
                    <span>Grid</span>
                  </button>
                </div>
              </div>
            </div>

            {error ? <p className="od-status-line od-status-line--error">{error}</p> : null}
            {loading ? <p className="od-status-line">Cargando imagenes...</p> : null}

            {!loading && !items.length ? (
              <p className="od-status-line">No hay imagenes disponibles.</p>
            ) : null}

            {!loading && items.length ? (
              <div className="od-attachment-library-grid" role="list">
                {items.map((item) => {
                  const selected = String(item.id) === String(selectedId);
                  const title = item.filename || "Imagen";

                  return (
                    <article
                      key={item.id}
                      className={`od-attachment-library-card${selected ? " is-selected" : ""}`}
                      role="listitem"
                    >
                      <button
                        type="button"
                        className="od-attachment-library-card__image-btn"
                        onClick={() => openViewer(item)}
                        title="Ver imagen"
                      >
                        <img
                          className="od-attachment-library-card__image"
                          src={item.url}
                          alt={item.alt || title}
                          loading="lazy"
                        />
                      </button>

                      <div className="od-attachment-library-card__body">
                        <p className="od-attachment-library-card__title" title={title}>
                          {title}
                        </p>
                        <p className="od-attachment-library-card__date">
                          {formatDate(item.createdAt)}
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`od-button-secondary od-attachment-library-card__select${
                          selected ? " is-selected" : ""
                        }`}
                        onClick={() => setSelectedId(item.id)}
                      >
                        {selected ? "Seleccionada" : "Seleccionar"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : null}

            {!loading && totalPages > 1 ? (
              <div className="od-attachment-library-pagination">
                <button
                  type="button"
                  className="od-button-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </button>

                <span className="od-attachment-library-pagination__status">
                  Pagina {page} de {totalPages}
                </span>

                <button
                  type="button"
                  className="od-button-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                >
                  Siguiente
                </button>
              </div>
            ) : null}

            <div className="od-modal-actions od-attachment-library-actions">
              <button
                type="button"
                className="od-button-secondary"
                onClick={onClose}
                disabled={confirming}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="od-modal-primary"
                onClick={handleConfirm}
                disabled={!selectedImage || confirming}
              >
                {confirming ? "Anadiendo..." : "Anadir imagen"}
              </button>
            </div>
          </div>
        </section>
      </div>

      <AttachmentsImageLightbox
        viewer={viewer}
        onClose={() => setViewer(null)}
      />
    </>
  );
}
