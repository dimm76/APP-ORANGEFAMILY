/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";

/**
 * @typedef {{ value: string, label: string, count?: number }} ODFilterOption
 */

function asMulti(v) {
  return Array.isArray(v) ? v.map((x) => String(x)) : [];
}

function normQuery(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

/** @type {Record<'dropdown' | 'multiselect', Record<string, string>>} */
const UI_CLASS_MAP = {
  dropdown: {
    root: "od-filter-dropdown",
    rootNarrow: "od-filter-dropdown--narrow",
    trigger: "od-filter-dropdown__trigger",
    value: "od-filter-dropdown__value",
    panel: "od-filter-dropdown__panel",
    panelUp: "od-filter-dropdown__panel--up",
    panelPortal: "od-filter-dropdown__panel--portal",
    toolbar: "od-filter-dropdown__toolbar",
    toolbarSpacer: "od-filter-dropdown__toolbar-spacer",
    toolbarAddon: "od-filter-dropdown__toolbar-addon",
    search: "od-filter-dropdown__search",
    clear: "od-filter-dropdown__clear",
    list: "od-filter-dropdown__list",
    empty: "od-filter-dropdown__empty",
    option: "od-filter-dropdown__option",
    optionSelected: "od-filter-dropdown__option--selected",
    optionMain: "od-filter-dropdown__option-main",
    mark: "od-filter-dropdown__mark",
    label: "od-filter-dropdown__label",
    count: "od-filter-dropdown__count",
  },
  multiselect: {
    root: "od-filter-multiselect",
    rootNarrow: "od-filter-multiselect--narrow",
    trigger: "od-filter-multiselect__trigger",
    value: "od-filter-multiselect__value",
    panel: "od-filter-multiselect__panel",
    panelUp: "od-filter-multiselect__panel--up",
    panelPortal: "od-filter-multiselect__panel--portal",
    toolbar: "od-filter-multiselect__toolbar",
    toolbarSpacer: "od-filter-multiselect__toolbar-spacer",
    toolbarAddon: "od-filter-multiselect__toolbar-addon",
    search: "od-filter-multiselect__search",
    clear: "od-filter-multiselect__clear",
    list: "od-filter-multiselect__list",
    empty: "od-filter-multiselect__empty",
    option: "od-filter-multiselect__option",
    optionSelected: "od-filter-multiselect__option--selected",
    optionMain: "od-filter-multiselect__option-main",
    mark: "od-filter-multiselect__mark",
    label: "od-filter-multiselect__label",
    count: "od-filter-multiselect__count",
  },
};

/**
 * Selector compacto global (single / multiple) con panel flotante y búsqueda opcional.
 *
 * @param {{
 *   id?: string,
 *   labelId?: string,
 *   mode: 'single' | 'multiple',
 *   options: ODFilterOption[],
 *   value: string | string[],
 *   onChange: (next: string | string[]) => void,
 *   placeholder?: string,
 *   searchPlaceholder?: string,
 *   searchable?: boolean,
 *   hint?: import('react').ReactNode,
 *   disabled?: boolean,
 *   className?: string,
 *   triggerClassName?: string,
 *   showClear?: boolean,
 *   emptySelectionLabel?: string,
 *   onDebouncedPanelSearchChange?: (query: string) => void,
 *   panelPortal?: boolean,
 *   panelToolbarAddon?: import('react').ReactNode,
 *   uiVariant?: 'dropdown' | 'multiselect',
 * }} props
 */
export default function ODFilterSelect({
  id: idProp,
  labelId,
  mode,
  options,
  value,
  onChange,
  placeholder = "Todos",
  searchPlaceholder = "Buscar…",
  searchable: searchableProp,
  hint,
  disabled = false,
  className = "",
  triggerClassName = "",
  showClear = true,
  emptySelectionLabel,
  onDebouncedPanelSearchChange,
  panelPortal = false,
  panelToolbarAddon = null,
  uiVariant = "dropdown",
}) {
  const ui = UI_CLASS_MAP[uiVariant] ?? UI_CLASS_MAP.dropdown;
  const reactId = useId();
  const baseId = idProp || `odfs-${reactId}`;
  const listId = `${baseId}-listbox`;
  const searchId = `${baseId}-search`;

  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openUp, setOpenUp] = useState(false);
  const [portalPositionStyle, setPortalPositionStyle] = useState(null);

  const safeOptions = useMemo(
    () =>
      (Array.isArray(options) ? options : [])
        .map((o) => ({
          value: String(o?.value ?? ""),
          label: String(o?.label ?? o?.value ?? ""),
          count:
            o?.count != null && Number.isFinite(Number(o.count))
              ? Number(o.count)
              : undefined,
        }))
        .filter((o) => o.value !== ""),
    [options]
  );

  const searchable =
    searchableProp !== undefined
      ? searchableProp
      : safeOptions.length >= 6;

  const qn = normQuery(query);
  const filtered = useMemo(() => {
    if (qn === "") return safeOptions;
    return safeOptions.filter((o) => {
      const ln = o.label.toLowerCase();
      const vn = o.value.toLowerCase();
      return ln.includes(qn) || vn.includes(qn);
    });
  }, [safeOptions, qn]);

  const selectedMulti = useMemo(
    () => (mode === "multiple" ? asMulti(value) : []),
    [mode, value]
  );
  const selectedSingle = useMemo(
    () => (mode === "single" ? String(value ?? "") : ""),
    [mode, value]
  );

  const summary = useMemo(() => {
    if (mode === "single") {
      if (!selectedSingle) {
        return emptySelectionLabel != null && emptySelectionLabel !== ""
          ? emptySelectionLabel
          : placeholder;
      }
      const hit = safeOptions.find((o) => o.value === selectedSingle);
      return hit ? hit.label : selectedSingle;
    }
    if (selectedMulti.length === 0) {
      return emptySelectionLabel != null && emptySelectionLabel !== ""
        ? emptySelectionLabel
        : placeholder;
    }
    if (selectedMulti.length === 1) {
      const v0 = selectedMulti[0];
      const hit = safeOptions.find((o) => o.value === v0);
      return hit ? hit.label : v0;
    }
    return `${selectedMulti.length} seleccionados`;
  }, [
    mode,
    placeholder,
    emptySelectionLabel,
    safeOptions,
    selectedMulti,
    selectedSingle,
  ]);

  const canClear =
    showClear &&
    !disabled &&
    (mode === "single"
      ? selectedSingle !== ""
      : selectedMulti.length > 0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e) {
      const el = rootRef.current;
      const panelEl = panelRef.current;
      const t = e.target;
      if (el && typeof el.contains === "function" && el.contains(t)) return;
      if (
        panelPortal &&
        panelEl &&
        typeof panelEl.contains === "function" &&
        panelEl.contains(t)
      ) {
        return;
      }
      close();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, panelPortal]);

  useEffect(() => {
    if (!open || !searchable) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, searchable]);

  useEffect(() => {
    if (!onDebouncedPanelSearchChange || !open || !searchable) return undefined;
    const t = window.setTimeout(() => {
      onDebouncedPanelSearchChange(String(query ?? ""));
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, open, searchable, onDebouncedPanelSearchChange]);

  useEffect(() => {
    if (!open || panelPortal) {
      if (!open) setOpenUp(false);
      return;
    }
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const viewportH =
      typeof window !== "undefined" && Number.isFinite(window.innerHeight)
        ? window.innerHeight
        : 0;
    if (viewportH <= 0) return;
    const panelDesired = 300;
    const below = viewportH - rect.bottom;
    const above = rect.top;
    setOpenUp(below < panelDesired && above > below);
  }, [open, filtered.length, panelPortal]);

  const updatePortalPosition = useCallback(() => {
    if (!panelPortal) return;
    const triggerEl = triggerRef.current;
    if (!triggerEl || typeof window === "undefined") return;
    const rect = triggerEl.getBoundingClientRect();
    const margin = 8;
    const gap = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelWidth = Math.min(Math.max(rect.width, 200), 400, vw - 2 * margin);
    const left = Math.min(Math.max(margin, rect.left), vw - margin - panelWidth);
    const spaceBelow = vh - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const preferUp = spaceBelow < 200 && spaceAbove > spaceBelow;
    const maxPanel = Math.min(300, preferUp ? spaceAbove : spaceBelow);
    const safeMax = Math.max(120, maxPanel);
    const zIndex = overlayZIndexForStackDepth();
    if (preferUp) {
      setPortalPositionStyle({
        position: "fixed",
        zIndex,
        left,
        width: panelWidth,
        bottom: vh - rect.top + gap,
        maxHeight: safeMax,
      });
    } else {
      setPortalPositionStyle({
        position: "fixed",
        zIndex,
        left,
        width: panelWidth,
        top: rect.bottom + gap,
        maxHeight: safeMax,
      });
    }
  }, [panelPortal]);

  useLayoutEffect(() => {
    if (!open || !panelPortal) {
      setPortalPositionStyle(null);
      return undefined;
    }
    updatePortalPosition();
    const triggerEl = triggerRef.current;
    let ro;
    if (triggerEl && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => updatePortalPosition());
      ro.observe(triggerEl);
    }
    window.addEventListener("resize", updatePortalPosition);
    document.addEventListener("scroll", updatePortalPosition, true);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updatePortalPosition);
      document.removeEventListener("scroll", updatePortalPosition, true);
      setPortalPositionStyle(null);
    };
  }, [open, panelPortal, updatePortalPosition, filtered.length, searchable, canClear]);

  function handleTriggerClick() {
    if (disabled) return;
    setOpen((o) => !o);
    if (!open) setQuery("");
  }

  function handleClearClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (mode === "single") onChange("");
    else onChange([]);
    close();
    triggerRef.current?.focus();
  }

  function selectSingle(nextVal) {
    onChange(nextVal);
    close();
    triggerRef.current?.focus();
  }

  function toggleMulti(val) {
    const cur = new Set(selectedMulti);
    if (cur.has(val)) cur.delete(val);
    else cur.add(val);
    onChange(Array.from(cur));
  }

  const expanded = open;
  const listboxMulti = mode === "multiple";

  const panelClassName =
    `${ui.panel}${
      !panelPortal && openUp ? ` ${ui.panelUp}` : ""
    }${panelPortal ? ` ${ui.panelPortal}` : ""}`.trim();

  function renderPanel() {
    return (
      <div
        id={listId}
        role="listbox"
        aria-multiselectable={listboxMulti ? true : undefined}
        aria-labelledby={labelId}
        ref={panelRef}
        className={panelClassName}
        style={panelPortal ? portalPositionStyle ?? undefined : undefined}
        onMouseDown={(e) => {
          /* evita blur del trigger antes del click en opción */
          e.preventDefault();
        }}
      >
        {(searchable || canClear || panelToolbarAddon) && (
          <div className={ui.toolbar}>
            {searchable ? (
              <input
                ref={searchRef}
                id={searchId}
                type="search"
                className={ui.search}
                value={query}
                onChange={(e) =>
                  setQuery(String(e.target.value).slice(0, 200))
                }
                placeholder={searchPlaceholder}
                autoComplete="off"
                maxLength={200}
                aria-label={searchPlaceholder}
              />
            ) : (
              <span className={ui.toolbarSpacer} />
            )}
            {canClear ? (
              <button
                type="button"
                className={ui.clear}
                onClick={handleClearClick}
              >
                Limpiar
              </button>
            ) : null}
          </div>
        )}
        {panelToolbarAddon ? (
          <div className={ui.toolbarAddon}>{panelToolbarAddon}</div>
        ) : null}
        <ul className={ui.list} role="presentation">
          {filtered.length === 0 ? (
            <li className={ui.empty} role="presentation">
              Sin resultados.
            </li>
          ) : (
            filtered.map((o) => {
              const sel =
                mode === "multiple"
                  ? selectedMulti.includes(o.value)
                  : selectedSingle === o.value;
              return (
                <li key={o.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel}
                    className={`${ui.option}${
                      sel ? ` ${ui.optionSelected}` : ""
                    }`}
                    onClick={() => {
                      if (mode === "single") selectSingle(o.value);
                      else toggleMulti(o.value);
                    }}
                  >
                    <span className={ui.optionMain}>
                      {mode === "multiple" ? (
                        <span className={ui.mark} aria-hidden>
                          {sel ? "✓" : ""}
                        </span>
                      ) : null}
                      <span className={ui.label}>{o.label}</span>
                    </span>
                    {o.count != null ? (
                      <span className={ui.count}>{o.count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  }

  const portalTarget =
    typeof document !== "undefined" ? document.body : null;

  return (
    <div
      ref={rootRef}
      className={`${ui.root} ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        className={`${ui.trigger} od-filter-select-like ${triggerClassName}`.trim()}
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-labelledby={labelId}
        aria-multiselectable={listboxMulti ? "true" : undefined}
        disabled={disabled}
        onClick={handleTriggerClick}
      >
        <span className={ui.value}>{summary}</span>
      </button>

      {open && panelPortal && portalPositionStyle && portalTarget
        ? createPortal(renderPanel(), portalTarget)
        : null}
      {open && !panelPortal ? renderPanel() : null}
      {hint != null ? (
        typeof hint === "string" ? (
          <p className="od-filter-hint">{hint}</p>
        ) : (
          <div className="od-filter-hint">{hint}</div>
        )
      ) : null}
    </div>
  );
}
