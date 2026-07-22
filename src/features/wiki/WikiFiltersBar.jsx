import ODFilterSelect from "../../shared/components/ODFilterSelect.jsx";

const SORT_OPTIONS = [
  { value: "updated_desc", label: "Modificación (reciente primero)" },
  { value: "updated_asc", label: "Modificación (antigua primero)" },
  { value: "title_asc", label: "Título (A–Z)" },
  { value: "title_desc", label: "Título (Z–A)" },
];

const PER_PAGE_OPTIONS = [10, 20, 50];

const VIS_OPTS = [
  { value: "internal", label: "Interno" },
  { value: "public_link", label: "Público con enlace" },
];

/**
 * @param {{
 *   filters: {
 *     search: string,
 *     status: string,
 *     visibility: string,
 *     include_archived: boolean,
 *     roots_only: boolean,
 *   },
 *   onFiltersChange: (patch: object) => void,
 *   order: string,
 *   onOrderChange: (order: string) => void,
 *   perPage: number,
 *   onPerPageChange: (n: number) => void,
 *   showRootsOnlyToggle?: boolean,
 * }} props
 */
export default function WikiFiltersBar({
  filters,
  onFiltersChange,
  order,
  onOrderChange,
  perPage,
  onPerPageChange,
  showRootsOnlyToggle = true,
}) {
  const perPageSelectOptions = PER_PAGE_OPTIONS.map((n) => ({
    value: String(n),
    label: String(n),
  }));

  return (
    <div className="od-filters od-list-toolbar" role="search">
      <div className="od-filters-row od-filters-row--main od-list-toolbar__row">
        <div className="od-filter-field od-list-toolbar__search">
          <span className="od-filter-label">Buscar</span>
          <input
            className="od-filter-search-input"
            type="search"
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            placeholder="Título o texto…"
            autoComplete="off"
            maxLength={200}
          />
        </div>
<div className="od-filter-field">
          <span className="od-filter-label">Visibilidad</span>
          <ODFilterSelect
            mode="single"
            options={VIS_OPTS}
            value={filters.visibility}
            onChange={(v) =>
              onFiltersChange({ visibility: typeof v === "string" ? v : "" })
            }
            placeholder="Todas"
            showClear
            searchable={false}
          />
        </div>



        {showRootsOnlyToggle ? (
          <div className="od-filter-field od-wiki-filters__archived">
            <label className="od-wiki-filters__archived-label">
              <input
                type="checkbox"
                checked={Boolean(filters.roots_only)}
                onChange={(e) => onFiltersChange({ roots_only: e.target.checked })}
              />
              <span className="od-filter-label">Solo páginas raíz (listado)</span>
            </label>
          </div>
        ) : null}

        <div className="od-filter-field od-wiki-filters__archived">
          <label className="od-wiki-filters__archived-label">
            <input
              type="checkbox"
              checked={Boolean(filters.include_archived)}
              onChange={(e) =>
                onFiltersChange({ include_archived: e.target.checked })
              }
            />
            <span className="od-filter-label">Incluir archivadas</span>
          </label>
        </div>

        <div className="od-filter-field">
          <span className="od-filter-label">Orden</span>
          <select
            className="od-filter-select od-filter-select--narrow"
            value={order}
            onChange={(e) => onOrderChange(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="od-filter-field od-filter-field--narrow">
          <span className="od-filter-label">Por pág.</span>
          <ODFilterSelect
            mode="single"
            options={perPageSelectOptions}
            value={String(perPage)}
            onChange={(v) => {
              const n = typeof v === "string" ? Number(v) : NaN;
              if (Number.isFinite(n)) onPerPageChange(n);
            }}
            searchable={false}
            showClear={false}
          />
        </div>
      </div>
    </div>
  );
}
