import { useState } from "react";

export default function OrangeAlbumCreateModal({
  categories = [],
  members = [],
  onClose,
  onCreate,
  onCreated,
  submitLabel = "Crear",
}) {
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState("private");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [canContribute, setCanContribute] = useState(false);
  const [associateDate, setAssociateDate] = useState(false);
  const [dateMode, setDateMode] = useState("single");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const invalidDate =
    associateDate &&
    (!dateStart || (dateMode === "range" && (!dateEnd || dateEnd < dateStart)));

  const invalidMembers =
    visibility === "selected" && selectedUserIds.length === 0;

  const toggleMember = id => {
    setSelectedUserIds(current =>
      current.includes(id)
        ? current.filter(value => value !== id)
        : [...current, id],
    );
  };

  const toggleCategory = id => {
    setSelectedCategoryIds(current =>
      current.includes(id)
        ? current.filter(value => value !== id)
        : [...current, id],
    );
  };

  const handleClose = () => {
    if (!busy) onClose();
  };

  const handleSubmit = async event => {
    event.preventDefault();

    if (busy || !title.trim() || invalidDate || invalidMembers) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const album = await onCreate({
        title: title.trim(),
        visibility,
        user_ids: visibility === "selected" ? selectedUserIds : [],
        can_contribute: visibility === "private" ? false : canContribute,
        category_ids: selectedCategoryIds,
        date_mode: associateDate ? dateMode : null,
        date_start: associateDate ? dateStart : null,
        date_end: associateDate
          ? dateMode === "single"
            ? dateStart
            : dateEnd
          : null,
      });

      if (album) {
        onCreated(album);
      }
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="od-modal-backdrop">
      <section
        className="od-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="od-orange-album-create-title"
      >
        <header className="od-modal-header">
          <h2 className="od-modal-title" id="od-orange-album-create-title">
            Crear álbum
          </h2>

          <button
            className="od-modal-close"
            type="button"
            aria-label="Cerrar"
            disabled={busy}
            onClick={handleClose}
          >
            ×
          </button>
        </header>

        <form
          className="od-modal-body od-orange-album-form"
          onSubmit={handleSubmit}
        >
          <div className="od-orange-album-form__section">
            <label className="od-form-field">
              <span className="od-form-label">Título</span>
              <input
                className="od-filter-input"
                value={title}
                onChange={event => setTitle(event.target.value)}
                required
              />
            </label>

            <label className="od-form-field">
              <span className="od-form-label">Visibilidad</span>
              <select
                className="od-filter-input"
                value={visibility}
                onChange={event => setVisibility(event.target.value)}
              >
                <option value="private">Solo yo</option>
                <option value="family">Toda la familia</option>
                <option value="selected">Miembros concretos</option>
              </select>
            </label>
          </div>

          <div className="od-orange-album-form__section">
            {visibility === "selected" ? (
              <fieldset className="od-orange-album-form__section od-orange-album-form__fieldset">
                <legend>Miembros</legend>
                {members.map(member => (
                  <label
                    key={member.id}
                    className="od-orange-album-form__check"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                    />
                    <span>{member.display_name}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}

            <fieldset className="od-orange-album-form__section od-orange-album-form__fieldset">
              <legend>Permisos</legend>
              <label className="od-orange-album-form__check">
                <input
                  type="radio"
                  name="orange-album-create-permission"
                  checked={!canContribute}
                  disabled={visibility === "private"}
                  onChange={() => setCanContribute(false)}
                />
                Solo ver
              </label>
              <label className="od-orange-album-form__check">
                <input
                  type="radio"
                  name="orange-album-create-permission"
                  checked={canContribute}
                  disabled={visibility === "private"}
                  onChange={() => setCanContribute(true)}
                />
                Puede contribuir
              </label>
            </fieldset>
          </div>

          <fieldset className="od-orange-album-form__section od-orange-album-form__fieldset">
            <legend>Categorías</legend>
            {categories.length ? (
              categories.map(category => (
                <label
                  key={category.id}
                  className="od-orange-album-form__check"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategoryIds.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  />
                  <span>{category.name}</span>
                </label>
              ))
            ) : (
              <p>Todavía no has creado categorías.</p>
            )}
          </fieldset>

          <fieldset className="od-orange-album-form__section od-orange-album-form__fieldset">
            <legend>Fecha</legend>
            <label className="od-orange-album-form__check">
              <input
                type="checkbox"
                checked={associateDate}
                onChange={event => setAssociateDate(event.target.checked)}
              />
              Asociar fecha
            </label>

            {associateDate ? (
              <>
                <div className="od-orange-album-form__inline-options">
                  <label>
                    <input
                      type="radio"
                      name="orange-album-create-date-mode"
                      checked={dateMode === "single"}
                      onChange={() => setDateMode("single")}
                    />
                    Fecha única
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="orange-album-create-date-mode"
                      checked={dateMode === "range"}
                      onChange={() => setDateMode("range")}
                    />
                    Intervalo
                  </label>
                </div>

                <label className="od-form-field">
                  <span className="od-form-label">
                    {dateMode === "single" ? "Fecha" : "Desde"}
                  </span>
                  <input
                    className="od-filter-input"
                    type="date"
                    value={dateStart}
                    onChange={event => setDateStart(event.target.value)}
                  />
                </label>

                {dateMode === "range" ? (
                  <label className="od-form-field">
                    <span className="od-form-label">Hasta</span>
                    <input
                      className="od-filter-input"
                      type="date"
                      value={dateEnd}
                      onChange={event => setDateEnd(event.target.value)}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </fieldset>

          {error ? (
            <p className="od-status-line od-status-line--error">{error}</p>
          ) : null}

          <div className="od-modal-actions">
            <button
              className="od-btn od-btn-secondary"
              type="button"
              disabled={busy}
              onClick={handleClose}
            >
              Cancelar
            </button>
            <button
              className="od-btn od-btn-primary"
              disabled={
                busy || !title.trim() || invalidDate || invalidMembers
              }
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
