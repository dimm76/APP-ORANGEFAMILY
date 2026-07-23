import { useEffect, useRef, useState } from "react";
import OrangePhotoCard from "./OrangePhotoCard.jsx";

function aspectRatio(photo) {
  const width = Number(photo.width);
  const height = Number(photo.height);
  return width > 0 && height > 0 ? width / height : photo.media_type === "video" ? 16 / 9 : 1;
}

function buildJustifiedRows(photos, availableWidth) {
  const mobile = availableWidth < 600;
  const tablet = availableWidth >= 600 && availableWidth < 900;
  const targetHeight = mobile ? 120 : tablet ? 145 : availableWidth >= 1280 ? 180 : 165;
  const gap = mobile ? 3 : 6;
  const rows = [];
  let current = [];
  let currentWidth = 0;

  photos.forEach((photo) => {
    const itemWidth = aspectRatio(photo) * targetHeight;
    const nextWidth = currentWidth + (current.length ? gap : 0) + itemWidth;
    if (current.length && nextWidth > availableWidth) {
      const ratio = current.reduce((sum, item) => sum + aspectRatio(item), 0);
      rows.push({ photos: current, height: Math.min(targetHeight * 1.15, (availableWidth - gap * (current.length - 1)) / ratio), gap, complete: true });
      current = [photo];
      currentWidth = itemWidth;
    } else {
      current.push(photo);
      currentWidth = nextWidth;
    }
  });

  if (current.length) {
    rows.push({ photos: current, height: targetHeight, gap, complete: false });
  }

  return rows;
}

export default function OrangePhotosGrid({
  groups,
  loading,
  selected,
  onSelect,
  onOpen,
  onActivePeriodChange,
}) {
  const contentRef = useRef(null);
  const [availableWidth, setAvailableWidth] = useState(960);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(Math.max(280, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
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

  if (!groups.length) return <p className="od-status-line">No hay fotos para estos filtros.</p>;

  return (
    <div className="od-orange-photos__content" ref={contentRef}>
      {groups.map((period) => (
        <section
          className="od-orange-photos__period"
          id={`orange-photos-period-${period.key}`}
          data-orange-photos-period={period.key}
          key={period.key}
        >
          <h2>{period.label}</h2>
          {period.days.map((day) => (
            <section className="od-orange-photos__day" key={day.key}>
              <h3>{day.label}</h3>
              {buildJustifiedRows(day.photos, availableWidth).map((row, rowIndex) => (
                <div
                  className="od-orange-photos__justified-row"
                  style={{ height: row.height, gap: row.gap }}
                  key={`${day.key}-${rowIndex}`}
                >
                  {row.photos.map((photo, photoIndex) => (
                    <div
                      className="od-orange-photos__justified-item"
                      style={{ width: aspectRatio(photo) * row.height, height: row.height }}
                      key={photo.id}
                    >
                      <OrangePhotoCard
                        photo={photo}
                        selected={selected.has(photo.id)}
                        onSelect={onSelect}
                        onOpen={onOpen}
                        eager={rowIndex === 0 && photoIndex < 4}
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
