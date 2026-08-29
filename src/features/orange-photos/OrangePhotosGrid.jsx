import { memo, useEffect, useMemo, useRef, useState } from "react";
import { IonIcon } from "@ionic/react";
import { checkmarkOutline } from "ionicons/icons";
import OrangePhotoCard from "./OrangePhotoCard.jsx";

function aspectRatio(photo) {
  const width = Number(photo.width);
  const height = Number(photo.height);

  if (width > 0 && height > 0) {
    return Math.min(8, Math.max(0.125, width / height));
  }

  return photo.media_type === "video" ? 16 / 9 : 1;
}

function buildJustifiedRows(photos, availableWidth, albumMode = false) {
  const mobile = availableWidth < 600;
  const tablet = availableWidth >= 600 && availableWidth < 900;

  const targetHeight = mobile
    ? 170
    : tablet
      ? 155
      : albumMode
        ? 200
      : availableWidth >= 1280
        ? 180
        : 165;

  const minimumMobileHeight = 140;
  const maximumMobileItems = 3;
  const gap = mobile ? 2 : 6;

  const rows = [];
  let current = [];

  function calculateRowHeight(rowPhotos) {
    const ratio = rowPhotos.reduce(
      (sum, item) => sum + aspectRatio(item),
      0,
    );

    return (
      (availableWidth - gap * Math.max(0, rowPhotos.length - 1)) /
      Math.max(ratio, 0.01)
    );
  }

  function pushIncompleteRow(rowPhotos) {
    if (!rowPhotos.length) return;

    /*
     * En móvil todas las filas, incluida la última, deben ocupar
     * exactamente el ancho disponible. Se aumenta la altura cuando
     * sea necesario en lugar de dejar espacio vacío a la derecha.
     *
     * En tablet y escritorio se conserva la última fila sin estirar.
     */
    rows.push({
      photos: rowPhotos,
      height: mobile
        ? calculateRowHeight(rowPhotos)
        : targetHeight,
      gap,
      complete: mobile,
    });
  }

  function pushCompleteRow(rowPhotos) {
    if (!rowPhotos.length) return;

    rows.push({
      photos: rowPhotos,
      height: calculateRowHeight(rowPhotos),
      gap,
      complete: true,
    });
  }

  photos.forEach((photo) => {
    if (!mobile) {
      const candidate = [...current, photo];
      const candidateHeight = calculateRowHeight(candidate);

      current = candidate;

      if (candidateHeight <= targetHeight) {
        pushCompleteRow(current);
        current = [];
      }

      return;
    }

    /*
     * En móvil:
     * - máximo 3 imágenes por fila;
     * - nunca cerrar una fila si la altura resultante baja de 140 px;
     * - una panorámica puede ocupar una fila por sí sola;
     * - la última fila no se estira.
     */

    if (!current.length) {
      const singleHeight = calculateRowHeight([photo]);

      if (singleHeight <= targetHeight) {
        pushCompleteRow([photo]);
      } else {
        current = [photo];
      }

      return;
    }

    const candidate = [...current, photo];
    const candidateHeight = calculateRowHeight(candidate);

    if (candidateHeight < minimumMobileHeight) {
      pushIncompleteRow(current);
      current = [photo];

      const singleHeight = calculateRowHeight(current);

      if (singleHeight <= targetHeight) {
        pushCompleteRow(current);
        current = [];
      }

      return;
    }

    current = candidate;

    if (
      current.length >= maximumMobileItems ||
      candidateHeight <= targetHeight
    ) {
      pushCompleteRow(current);
      current = [];
    }
  });

  if (current.length) {
    pushIncompleteRow(current);
  }

  return rows;
}

function DaySelectionToggle({ dayKey, photoIds, selected, selectionMode, onSelectMany }) {
  const inputRef = useRef(null);
  const selectedCount = photoIds.filter(id => selected.has(id)).length;
  const checked = selectedCount === photoIds.length && photoIds.length > 0;
  const indeterminate = selectedCount > 0 && !checked;
  useEffect(() => { if (inputRef.current) inputRef.current.indeterminate = indeterminate; }, [indeterminate]);
  return <label className={`od-orange-photos__day-selection${checked ? " is-selected" : ""}${selectionMode ? " is-selection-mode" : ""}`}><input ref={inputRef} className="od-orange-photo-card__selection-input" type="checkbox" checked={checked} onChange={() => onSelectMany(dayKey, photoIds, !checked)} /><span className="od-orange-photo-card__selection-circle" aria-hidden="true">{checked || indeterminate ? <IonIcon icon={checkmarkOutline} /> : null}</span><span className="od-orange-photo-card__sr">Seleccionar todas las fotografías del día</span></label>;
}

function OrangePhotosGrid({
  groups,
  loading,
  selected,
  selectionMode,
  onSelect,
  onSelectMany,
  onOpen,
  onActivePeriodChange,
  albumMode = false,
  publicMode = false,
  selectable = true,
  showOwnerLabel = false,
}) {
  const contentRef = useRef(null);
  const measuredWidthRef = useRef(0);
  const resizeFrameRef = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(960);
  const layout = useMemo(() => {
    let globalIndex = 0;
    return groups.map(period => ({
      ...period,
      days: period.days.map(day => ({
        ...day,
        rows: buildJustifiedRows(day.photos, availableWidth, albumMode).map(row => ({
          ...row,
          photos: row.photos.map(photo => ({ photo, globalIndex: globalIndex++ })),
        })),
      })),
    }));
  }, [groups, availableWidth, albumMode]);

  useEffect(() => {
    const content = contentRef.current;
    const container = content?.parentElement;
    if (!container) return undefined;
    const updateWidth = () => {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        const measured = Math.max(
          280,
          Math.round(container.getBoundingClientRect().width),
        );
        if (Math.abs(measured - measuredWidthRef.current) < 2) return;
        measuredWidthRef.current = measured;
        setAvailableWidth(measured);
      });
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(resizeFrameRef.current);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const sections = contentRef.current?.querySelectorAll("[data-orange-photos-period]");
    if (!sections?.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) onActivePeriodChange(visible.target.dataset.orangePhotosPeriod);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [groups, onActivePeriodChange]);

  if (loading && !groups.length) {
    return (
      <div className="od-orange-photos__content" aria-label="Cargando" ref={contentRef}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className="od-orange-photos__justified-row" key={index}>
            <div className="od-orange-photo-card--skeleton" />
            <div className="od-orange-photo-card--skeleton" />
            <div className="od-orange-photo-card--skeleton" />
          </div>
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="od-orange-photos__content" ref={contentRef}>
        <p className="od-status-line">No hay fotos para estos filtros.</p>
      </div>
    );
  }

  return (
    <div className={`od-orange-photos__content${publicMode?" od-orange-photos__content--public":""}`} ref={contentRef}>
      {layout.map((period) => (
        <section
          className="od-orange-photos__period"
          id={`orange-photos-period-${period.key}`}
          data-orange-photos-period={period.key}
          key={period.key}
        >
          <h2>{period.label}</h2>
          {period.days.map((day) => (
            <section className="od-orange-photos__day" key={day.key}>
              <header className="od-orange-photos__day-header">{selectable?<DaySelectionToggle dayKey={day.key} photoIds={day.photos.map(photo => photo.id)} selected={selected} selectionMode={selectionMode} onSelectMany={onSelectMany}/>:null}<h3>{day.label}</h3></header>
              {day.rows.map((row) => (
                <div
                  className="od-orange-photos__justified-row"
                  style={{ height: row.height, gap: row.gap }}
                  key={`${day.key}:${row.photos.map(item => item.photo.id).join(",")}`}
                >
                  {row.photos.map(({ photo, globalIndex }) => (
                    <div
                      className="od-orange-photos__justified-item"
                      data-photo-id={photo.id}
                      style={{ width: aspectRatio(photo) * row.height, flexBasis: aspectRatio(photo) * row.height, height: row.height, maxWidth: "100%" }}
                      key={photo.id}
                    >
                      <OrangePhotoCard
                        photo={photo}
                        selectionMode={selectable&&selectionMode}
                        selected={selected.has(photo.id)}
                        onSelect={selectable?onSelect:()=>{}}
                        onOpen={onOpen}
                        eager={globalIndex < 8}
                        showOwnerLabel={showOwnerLabel}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}
        </section>
      ))}
    </div>
  );
}

export default memo(OrangePhotosGrid);
