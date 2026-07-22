function duration(value) {
  if (value == null) return "";
  const seconds = Math.round(Number(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function OrangePhotoCard({ photo, selected, onSelect, onOpen }) {
  const label = photo.title || photo.original_filename || "foto";

  return (
    <article className={`od-orange-photo-card${selected ? " is-selected" : ""}`}>
      <button
        type="button"
        className="od-orange-photo-card__media"
        onClick={() => onOpen(photo)}
        aria-label={`Abrir ${label}`}
      >
        <img
          src={photo.thumbnail_url || photo.preview_url}
          alt={label}
          loading="lazy"
        />
        {photo.media_type === "video" ? (
          <span className="od-orange-photo-card__video">▶ {duration(photo.duration_seconds)}</span>
        ) : null}
      </button>
      <label className="od-orange-photo-card__selection">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(photo.id)}
        />
        <span className="od-orange-photo-card__sr">Seleccionar</span>
      </label>
    </article>
  );
}
