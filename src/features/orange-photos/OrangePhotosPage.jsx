/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addPhotoToAlbum,
  createOrangeAlbum,
  listOrangeAlbums,
  listOrangePhotoMembers,
  listOrangePhotos,
  restoreOrangePhoto,
  shareOrangePhoto,
  trashOrangePhoto,
  updateOrangePhoto,
  uploadOrangePhoto,
} from "../../shared/api/orangePhotosApi.js";
import OrangeAlbumsPanel from "./OrangeAlbumsPanel.jsx";
import OrangePhotosFiltersBar from "./OrangePhotosFiltersBar.jsx";
import OrangePhotosGrid from "./OrangePhotosGrid.jsx";
import OrangePhotosTimeline from "./OrangePhotosTimeline.jsx";
import OrangePhotoViewer from "./OrangePhotoViewer.jsx";
import OrangePhotoUploadModal from "./OrangePhotoUploadModal.jsx";
import OrangePhotoShareModal from "./OrangePhotoShareModal.jsx";
import "./orangePhotos.css";

const initial = {
  search: "",
  media_type: "",
  visibility: "",
  favorite: false,
  include_trashed: false,
  album_id: "",
  page: 1,
  per_page: 30,
};

const monthFormatter = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const shortMonthFormatter = new Intl.DateTimeFormat("es", { month: "short" });
const dayFormatter = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const capitalize = (value) => value.replace(/(^|\s)(\p{L})/gu, (_, space, letter) => `${space}${letter.toUpperCase()}`);

function groupPhotos(items) {
  const periods = new Map();

  items.forEach((photo) => {
    const date = photo.captured_at ? new Date(photo.captured_at) : null;
    const valid = date && !Number.isNaN(date.getTime());
    const periodKey = valid
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : "unknown";
    const dayKey = valid
      ? `${periodKey}-${String(date.getDate()).padStart(2, "0")}`
      : "unknown";

    if (!periods.has(periodKey)) {
      periods.set(periodKey, {
        key: periodKey,
        label: valid ? capitalize(monthFormatter.format(date)) : "Sin fecha",
        shortLabel: valid ? capitalize(shortMonthFormatter.format(date).replace(".", "")) : "",
        days: new Map(),
      });
    }
    const period = periods.get(periodKey);
    if (!period.days.has(dayKey)) {
      period.days.set(dayKey, {
        key: dayKey,
        label: valid ? capitalize(dayFormatter.format(date).replaceAll(".", "")) : "Fecha desconocida",
        photos: [],
      });
    }
    period.days.get(dayKey).photos.push(photo);
  });

  return [...periods.values()]
    .sort((a, b) => {
      if (a.key === "unknown") return 1;
      if (b.key === "unknown") return -1;
      return b.key.localeCompare(a.key);
    })
    .map((period) => ({
      ...period,
      days: [...period.days.values()].sort((a, b) => {
        if (a.key === "unknown") return 1;
        if (b.key === "unknown") return -1;
        return b.key.localeCompare(a.key);
      }),
    }));
}

export default function OrangePhotosPage() {
  const [filters, setFilters] = useState(initial);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [albums, setAlbums] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [viewer, setViewer] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [albumsOpen, setAlbumsOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState("");
  const groups = useMemo(() => groupPhotos(items), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listOrangePhotos(filters);
      const incoming = data.items || [];
      setItems((current) => {
        const next = filters.page === 1 ? incoming : [...current, ...incoming];
        return [...new Map(next.map((photo) => [photo.id, photo])).values()];
      });
      setTotal(data.total || 0);
      setViewer((current) => incoming.find((photo) => photo.id === current?.id) || current);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadAlbums = useCallback(async () => {
    try {
      setAlbums((await listOrangeAlbums()).items || []);
    } catch {
      // El error principal se muestra en la biblioteca.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadAlbums();
    listOrangePhotoMembers()
      .then((data) => setMembers(data.items || []))
      .catch(() => {});
  }, [loadAlbums]);

  useEffect(() => {
    if (groups.length && !groups.some((group) => group.key === activePeriod)) {
      setActivePeriod(groups[0].key);
    }
  }, [groups, activePeriod]);

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeFilters = (nextFilters) => {
    const nonPageChanged = Object.keys(nextFilters).some(
      (key) => key !== "page" && nextFilters[key] !== filters[key],
    );
    if (nonPageChanged) {
      setSelected(new Set());
      setItems([]);
      setFilters({ ...nextFilters, page: 1 });
      return;
    }
    setFilters(nextFilters);
  };

  const scrollToPeriod = (period) => {
    setActivePeriod(period);
    document
      .getElementById(`orange-photos-period-${period}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function save(body) {
    await updateOrangePhoto(viewer.id, body);
    await load();
  }

  return (
    <div className="od-page">
      <div className="od-page-inner od-page-inner--full od-orange-photos">
        <header className="od-orange-photos__toolbar">
          <div>
            <h1 className="od-page-title">OrangePhotos</h1>
            <span>{total} elementos</span>
          </div>
          <div className="od-orange-photos__toolbar-actions">
            <button
              className={`od-filter-button${albumsOpen ? " od-filter-button--active" : ""}`}
              type="button"
              onClick={() => setAlbumsOpen((open) => !open)}
            >
              Álbumes
            </button>
            <button
              className={`od-filter-button${filtersOpen ? " od-filter-button--active" : ""}`}
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
            >
              Filtros
            </button>
            <button className="od-modal-primary" type="button" onClick={() => setUploadOpen(true)}>
              Subir
            </button>
          </div>
        </header>

        {filtersOpen ? (
          <div className="od-orange-photos__secondary-panel">
            <OrangePhotosFiltersBar
              filters={filters}
              onChange={changeFilters}
              onClose={() => setFiltersOpen(false)}
            />
          </div>
        ) : null}

        {albumsOpen ? (
          <div className="od-orange-photos__secondary-panel">
            <OrangeAlbumsPanel
              albums={albums}
              active={filters.album_id}
              onPick={(albumId) => changeFilters({ ...filters, album_id: albumId, page: 1 })}
              onCreate={async (title) => {
                await createOrangeAlbum({ title });
                await loadAlbums();
              }}
              selectedCount={selected.size}
              onAddSelected={async () => {
                await Promise.all([...selected].map((id) => addPhotoToAlbum(filters.album_id, id)));
                setSelected(new Set());
                await load();
                await loadAlbums();
              }}
            />
          </div>
        ) : null}

        {error ? <p className="od-status-line od-status-line--error">{error}</p> : null}

        <div className="od-orange-photos__library">
          <main>
            <OrangePhotosGrid
              groups={groups}
              loading={loading}
              selected={selected}
              onSelect={toggle}
              onOpen={setViewer}
              onActivePeriodChange={setActivePeriod}
            />
            {filters.page * filters.per_page < total ? (
              <div className="od-orange-photos__load-more">
                <button
                  className="od-button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
                >
                  {loading ? "Cargando…" : "Cargar más"}
                </button>
              </div>
            ) : null}
          </main>
          <OrangePhotosTimeline
            groups={groups}
            activePeriod={activePeriod}
            onPeriodClick={scrollToPeriod}
          />
        </div>
      </div>

      {viewer ? (
        <OrangePhotoViewer
          photo={viewer}
          onClose={() => setViewer(null)}
          onSave={save}
          onShare={() => setShareOpen(true)}
          onTrash={async () => {
            if (viewer.is_trashed) await restoreOrangePhoto(viewer.id);
            else await trashOrangePhoto(viewer.id);
            setViewer(null);
            await load();
          }}
        />
      ) : null}
      {uploadOpen ? (
        <OrangePhotoUploadModal
          onClose={() => setUploadOpen(false)}
          onUpload={async (file) => {
            await uploadOrangePhoto(file);
            setFilters((current) => ({ ...current, page: 1 }));
            await load();
          }}
        />
      ) : null}
      {shareOpen && viewer ? (
        <OrangePhotoShareModal
          photo={viewer}
          members={members}
          onClose={() => setShareOpen(false)}
          onSave={async (body) => {
            await shareOrangePhoto(viewer.id, body);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}
