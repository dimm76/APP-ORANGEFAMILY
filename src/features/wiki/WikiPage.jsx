/* eslint-disable react-hooks/set-state-in-effect, react-hooks/preserve-manual-memoization */
import { useCallback, useEffect, useMemo, useState } from "react";
import { IonButton, IonContent, IonIcon, IonItem, IonList, IonPopover } from "@ionic/react";
import WikiTiptapEditor from "../../shared/components/WikiTiptapEditor.jsx";
import ODFilterSelect from "../../shared/components/ODFilterSelect.jsx";
import { OD_ICONS } from "../../shared/ui/odIcons.js";
import {
  hydrateHtmlAttachmentSrc,
  hydrateJsonAttachmentSrc,
} from "../../shared/utils/attachmentRichContent.js";
import {
  copyWikiRootContentToChild,
  createWikiPage,
  deleteWikiPage,
  duplicateWikiPage,
  fetchWikiOutline,
  fetchWikiPageById,
  fetchWikiPages,
  fetchPublicWikiByToken,
  moveWikiPage,
  patchWikiPage,
  publishWikiPublicLink,
  revokeWikiPublicLink,
} from "../../shared/api/wikiApi.js";
import TaskPagination from "../../shared/components/TaskPagination.jsx";
import WikiFiltersBar from "./WikiFiltersBar.jsx";
import "./wiki.css";

const OD_NAV_EVENT = "od-spa-navigate";
const EM_DASH = "\u2014";
const DEFAULT_PER_PAGE = 20;
const DEFAULT_ORDER = "updated_desc";
const WIKI_MOBILE_MQ = "(max-width: 767px)";

function useWikiMobileLayout() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(WIKI_MOBILE_MQ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(WIKI_MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

const INITIAL_LIBRARY_FILTERS = Object.freeze({
  search: "",
  visibility: "",
  include_archived: false,
  roots_only: true,
});

function normalizePathname(p) {
  return String((p || "").split("?")[0] || "").replace(/\/$/, "") || "/";
}

function spaNavigate(href) {
  window.history.pushState({}, "", href);
  window.dispatchEvent(new Event(OD_NAV_EVENT));
}

function isWikiUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

function useWikiPageIdFromUrl() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sync = () => setTick((t) => t + 1);
    window.addEventListener("popstate", sync);
    window.addEventListener(OD_NAV_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(OD_NAV_EVENT, sync);
    };
  }, []);

  return useMemo(() => {
    void tick;
    const p = normalizePathname(window.location.pathname);
    if (p === "/app/wiki") return "";
    const prefix = "/app/wiki/";
    if (p.startsWith(prefix)) {
      return decodeURIComponent(p.slice(prefix.length)).trim();
    }
    return "";
  }, [tick]);
}

const WIKI_TYPE_OPTIONS = [
  { value: "document", label: "Documento" },
  { value: "note", label: "Nota" },
  { value: "procedure", label: "Procedimiento" },
  { value: "guide", label: "Guía" },
  { value: "report", label: "Informe" },
  { value: "memory", label: "Memoria" },
];

const WIKI_VISIBILITY_OPTIONS = [
  { value: "internal", label: "Interno" },
  { value: "public_link", label: "Público con enlace" },
];

function normalizeLegacyVisibility(value) {
  return String(value ?? "").trim();
}

function buildVisibilityOptions(currentValue) {
  const normalized = normalizeLegacyVisibility(currentValue);
  const hasCurrent =
    normalized &&
    !WIKI_VISIBILITY_OPTIONS.some((option) => option.value === normalized);
  if (!hasCurrent) return WIKI_VISIBILITY_OPTIONS;
  return [...WIKI_VISIBILITY_OPTIONS, { value: normalized, label: normalized }];
}

function buildWikiTypeOptions(currentValue) {
  const current = String(currentValue ?? "").trim();
  const hasCurrent =
    current &&
    current !== "page" &&
    !WIKI_TYPE_OPTIONS.some((option) => option.value === current);
  if (!hasCurrent) return WIKI_TYPE_OPTIONS;
  return [...WIKI_TYPE_OPTIONS, { value: current, label: current }];
}

function normalizeWikiType(value) {
  const v = String(value ?? "").trim();
  return v === "page" || v === "" ? "document" : v;
}

function wikiTypeBadgeClass(value) {
  const v = normalizeWikiType(value);
  if (v === "report") return "od-badge--style-2";
  if (v === "procedure") return "od-badge--style-4";
  if (v === "guide") return "od-badge--style-9";
  if (v === "memory") return "od-badge--style-8";
  return "od-badge--style-6";
}

function wikiTypeLabel(value) {
  const normalized = normalizeWikiType(value);
  const option = WIKI_TYPE_OPTIONS.find((item) => item.value === normalized);
  return option?.label || "Documento general";
}

function isFutureDate(value) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return time > Date.now();
}

function isPublicLinkActive(row) {
  return (
    normalizeLegacyVisibility(row?.visibility) === "public_link" &&
    row?.public_enabled === true &&
    String(row?.public_token ?? "").trim() !== "" &&
    !row?.public_revoked_at &&
    isFutureDate(row?.public_expires_at) &&
    row?.is_archived !== true
  );
}

function buildPublicWikiUrl(row) {
  const token = String(row?.public_token ?? "").trim();
  if (!token || typeof window === "undefined") return "";
  return `${window.location.origin}/public/wiki/${encodeURIComponent(token)}`;
}

function publicExpiryInputValue(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function publicLinkStatus(row) {
  if (isPublicLinkActive(row)) return "Enlace público activo";
  if (row?.public_revoked_at) return "Enlace revocado";
  if (row?.public_expires_at && !isFutureDate(row.public_expires_at)) return "Enlace expirado";
  return "Privado / interno";
}

function buildTreeNodes(flat) {
  const list = Array.isArray(flat) ? flat : [];
  const byId = new Map();
  for (const n of list) {
    const id = String(n?.id ?? "").trim();
    if (!id) continue;
    byId.set(id, {
      id,
      parent_id: n.parent_id,
      title: n.title,
      menu_order: Number(n.menu_order) || 0,
      status: n.status,
      is_archived: Boolean(n.is_archived),
      children: [],
    });
  }
  const roots = [];
  for (const node of byId.values()) {
    const pid = node.parent_id ? String(node.parent_id).trim() : "";
    if (pid && byId.has(pid)) {
      byId.get(pid).children.push(node);
    } else {
      roots.push(node);
    }
  }
  function sortRec(n) {
    n.children.sort(
      (a, b) =>
        a.menu_order - b.menu_order ||
        String(a.title ?? "").localeCompare(String(b.title ?? ""), "es", {
          sensitivity: "base",
        })
    );
    n.children.forEach(sortRec);
  }
  roots.sort(
    (a, b) =>
      a.menu_order - b.menu_order ||
      String(a.title ?? "").localeCompare(String(b.title ?? ""), "es", {
        sensitivity: "base",
      })
  );
  roots.forEach(sortRec);
  return roots;
}

function collectSubtreeIds(flat, rootId) {
  const root = String(rootId ?? "").trim();
  if (!root) return new Set();
  const childrenByParent = new Map();
  for (const n of flat) {
    const id = String(n?.id ?? "").trim();
    if (!id) continue;
    const pid = n.parent_id ? String(n.parent_id).trim() : "";
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid).push(id);
  }
  const ids = new Set();
  function walk(id) {
    ids.add(id);
    for (const childId of childrenByParent.get(id) || []) walk(childId);
  }
  walk(root);
  return ids;
}

function sortPagesByOrder(a, b) {
  return (
    (Number(a.menu_order) || 0) - (Number(b.menu_order) || 0) ||
    String(a.title ?? "").localeCompare(String(b.title ?? ""), "es", { sensitivity: "base" })
  );
}

function pickFirstChildPageId(flat, rootId) {
  const root = String(rootId ?? "").trim();
  if (!root) return "";
  const first = (Array.isArray(flat) ? flat : [])
    .filter((n) => n.parent_id && String(n.parent_id) === root)
    .sort(sortPagesByOrder)[0];
  return first?.id ? String(first.id) : "";
}

function wikiPageHasStoredContent(page) {
  const html = String(page?.content_html ?? "").trim();
  if (html) {
    const plain = html
      .replace(/<[^>]*>/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plain) return true;
  }
  const cj = page?.content_json;
  if (!cj || typeof cj !== "object") return false;
  const nodes = cj.content;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  if (nodes.length === 1 && nodes[0]?.type === "paragraph") {
    const inner = nodes[0]?.content;
    if (!Array.isArray(inner) || inner.length === 0) return false;
  }
  return true;
}

async function resolveDocumentRoot(page) {
  let cur = page;
  let guard = 0;
  while (cur?.parent_id && guard++ < 64) {
    cur = await fetchWikiPageById(cur.parent_id);
  }
  return cur;
}

function WikiSidebarMenu({ triggerId, ariaLabel, items }) {
  return (
    <>
      <IonButton
        id={triggerId}
        fill="clear"
        size="small"
        type="button"
        aria-label={ariaLabel}
        className="od-icon-button od-action-ion od-wiki-tree__menu-btn"
      >
        <IonIcon icon={OD_ICONS.menuMore} aria-hidden="true" />
      </IonButton>
      <IonPopover trigger={triggerId} dismissOnSelect>
        <IonContent className="od-action-popover-content od-wiki-sidebar-popover">
          <IonList lines="none">
            {(items || []).map((item) => (
              <IonItem
                key={item.key}
                button
                detail={false}
                disabled={Boolean(item.disabled)}
                onClick={item.disabled ? undefined : item.onClick}
              >
                <span className="od-popover-menu-label">
                  <IonIcon icon={item.icon} className="od-popover-menu-icon" aria-hidden="true" />
                  {item.label}
                </span>
              </IonItem>
            ))}
          </IonList>
        </IonContent>
      </IonPopover>
    </>
  );
}

function WikiSidebarExpandTab({ onClick, ariaLabel }) {
  return (
    <button
      type="button"
      className="od-wiki-workspace__sidebar-expand-tab"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
    >
      <IonIcon icon={OD_ICONS.richIndent} aria-hidden="true" />
    </button>
  );
}

function WikiDocumentSidebarContent({
  documentTitle,
  detail,
  detailError,
  loadingOutline,
  hasChildPages,
  treeRoots,
  pageId,
  onPickPage,
  onBackToLibrary,
  documentRoot,
  actionsMenuId,
  renderDocActionsMenu,
  onCreatePageUnderRoot,
  onCreateSubpageFor,
  onRenamePage,
  onArchivePage,
  onCollapseSidebar,
  dragEnabled = false,
  dragState,
  onDragStartPage,
  onDragOverPage,
  onDropPage,
  onDragEndPage,
  publicMode = false,
  readOnly = false,
}) {
  const treeMenusDisabled =
    publicMode || readOnly || Boolean(documentRoot?.is_archived || detail?.is_archived);
  const canDragTree =
    dragEnabled &&
    !publicMode &&
    !readOnly &&
    !(documentRoot?.is_archived || detail?.is_archived);

  return (
    <>
      <div className="od-wiki-workspace__sidebar-top">
        {!publicMode ? (
          <button type="button" className="od-wiki-workspace__back" onClick={onBackToLibrary}>
            ← Biblioteca
          </button>
        ) : null}
        {typeof onCollapseSidebar === "function" ? (
          <button
            type="button"
            className="od-wiki-workspace__sidebar-ctl"
            aria-label="Ocultar panel de páginas"
            title="Ocultar panel de páginas"
            onClick={onCollapseSidebar}
          >
            <IonIcon icon={OD_ICONS.richOutdent} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="od-wiki-workspace__sidebar-scroll">
        <div className="od-wiki-workspace__sidebar-doc">
          <div className="od-wiki-workspace__sidebar-doc-row">
            <p className="od-wiki-workspace__sidebar-doc-label" title={documentTitle}>
              {documentTitle}
            </p>
            {!publicMode && detail && !detailError ? renderDocActionsMenu(actionsMenuId) : null}
          </div>
        </div>

        <div className="od-wiki-workspace__sidebar-divider" aria-hidden="true" />

        {loadingOutline ? (
          <p className="od-wiki-workspace__sidebar-status">Cargando páginas…</p>
        ) : detail && !detailError ? (
          publicMode ? (
            treeRoots.length === 0 ? (
              <p className="od-wiki-workspace__sidebar-status">Sin páginas.</p>
            ) : (
              <>
                <p className="od-wiki-workspace__sidebar-section">Páginas</p>
                <WikiTree
                  nodes={treeRoots}
                  depth={0}
                  selectedId={pageId}
                  onPick={onPickPage}
                  menusDisabled={treeMenusDisabled}
                  dragEnabled={canDragTree}
                  dragState={dragState}
                  onDragStartPage={onDragStartPage}
                  onDragOverPage={onDragOverPage}
                  onDropPage={onDropPage}
                  onDragEndPage={onDragEndPage}
                />
              </>
            )
          ) : hasChildPages ? (
            <>
              <p className="od-wiki-workspace__sidebar-section">Páginas</p>
              {treeRoots.length === 0 ? (
                <p className="od-wiki-workspace__sidebar-status">Sin páginas.</p>
              ) : (
                <WikiTree
                  nodes={treeRoots}
                  depth={0}
                  selectedId={pageId}
                  onPick={onPickPage}
                  menusDisabled={treeMenusDisabled}
                  onCreateSubpageFor={onCreateSubpageFor}
                  onRenamePage={onRenamePage}
                  onArchivePage={onArchivePage}
                  dragEnabled={canDragTree}
                  dragState={dragState}
                  onDragStartPage={onDragStartPage}
                  onDragOverPage={onDragOverPage}
                  onDropPage={onDropPage}
                  onDragEndPage={onDragEndPage}
                />
              )}
            </>
          ) : !detail.is_archived ? (
            <div className="od-wiki-workspace__empty-pages">
              <p>Sin páginas internas todavía.</p>
              <button
                type="button"
                className="od-wiki-workspace__link-btn"
                onClick={() => void onCreatePageUnderRoot()}
              >
                Crear primera página
              </button>
            </div>
          ) : null
        ) : null}
      </div>
    </>
  );
}

function WikiTree({
  nodes,
  depth,
  selectedId,
  onPick,
  menusDisabled,
  onCreateSubpageFor,
  onRenamePage,
  onArchivePage,
  dragEnabled = false,
  dragState,
  onDragStartPage,
  onDragOverPage,
  onDropPage,
  onDragEndPage,
}) {
  return (
    <ul className={`od-wiki-tree ${depth === 0 ? "od-wiki-tree--root" : ""}`}>
      {(nodes || []).map((n) => {
        const muted = Boolean(n.is_archived);
        const active = selectedId === n.id;
        const depthClass = `od-wiki-tree__btn--depth-${Math.min(depth, 6)}`;
        const menuId = `od-wiki-page-menu-${n.id}`;
        const pageTitle = String(n.title ?? "").trim() || "Sin título";
        return (
          <li key={n.id} className="od-wiki-tree__item">
            <div
              className={`od-wiki-tree__row${active ? " is-active-row" : ""}${
                dragState?.targetId === n.id ? ` is-drop-${dragState.position}` : ""
              }${dragState?.sourceId === n.id ? " is-dragging" : ""}`}
              onDragOver={(event) => onDragOverPage?.(event, n.id)}
              onDrop={(event) => onDropPage?.(event, n.id)}
            >
              {dragEnabled && !muted ? (
                <button
                  type="button"
                  className="od-wiki-tree__drag-handle"
                  draggable
                  aria-label={`Arrastrar ${pageTitle}`}
                  title="Arrastrar para reordenar"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onDragStart={(event) => onDragStartPage?.(event, n.id)}
                  onDragEnd={onDragEndPage}
                >
                  <IonIcon icon={OD_ICONS.reorder} aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                className={`od-wiki-tree__btn ${depthClass}${active ? " is-active" : ""}${muted ? " is-muted" : ""}`}
                title={pageTitle}
                onClick={() => onPick(n.id)}
              >
                {pageTitle}
              </button>
              {!menusDisabled && !muted ? (
                <WikiSidebarMenu
                  triggerId={menuId}
                  ariaLabel={`Acciones de ${pageTitle}`}
                  items={[
                    {
                      key: "subpage",
                      icon: OD_ICONS.add,
                      label: "Crear subpágina",
                      onClick: () => void onCreateSubpageFor(n.id),
                    },
                    {
                      key: "rename",
                      icon: OD_ICONS.edit,
                      label: "Renombrar",
                      onClick: () => void onRenamePage(n.id, pageTitle),
                    },
                    {
                      key: "archive",
                      icon: OD_ICONS.delete,
                      label: "Archivar",
                      onClick: () => void onArchivePage(n.id),
                    },
                  ]}
                />
              ) : null}
            </div>
            {n.children?.length ? (
              <WikiTree
                nodes={n.children}
                depth={depth + 1}
                selectedId={selectedId}
                onPick={onPick}
                menusDisabled={menusDisabled}
                onCreateSubpageFor={onCreateSubpageFor}
                onRenamePage={onRenamePage}
                onArchivePage={onArchivePage}
                dragEnabled={dragEnabled}
                dragState={dragState}
                onDragStartPage={onDragStartPage}
                onDragOverPage={onDragOverPage}
                onDropPage={onDropPage}
                onDragEndPage={onDragEndPage}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function displayCell(value) {
  const s = String(value ?? "").trim();
  return s !== "" ? s : EM_DASH;
}

function WikiLibrary() {
  const [filters, setFilters] = useState(() => ({
    ...INITIAL_LIBRARY_FILTERS,
  }));
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [listPage, setListPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const [listItems, setListItems] = useState([]);
  const [listMeta, setListMeta] = useState({
    total: 0,
    page: 1,
    max_pages: 1,
    per_page: DEFAULT_PER_PAGE,
  });


  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [saveHint, setSaveHint] = useState("");
  const [rowMenu, setRowMenu] = useState({ id: "", event: null });
  const [titleDrafts, setTitleDrafts] = useState({});
  const [savingTitleId, setSavingTitleId] = useState("");
  const [typeMenu, setTypeMenu] = useState({ id: "", event: null });
  const [publicModalId, setPublicModalId] = useState("");
  const [publicExpiryDraft, setPublicExpiryDraft] = useState("");
  const [publicModalBusy, setPublicModalBusy] = useState(false);
  const [publicModalHint, setPublicModalHint] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(String(filters.search || "").trim()), 320);
    return () => clearTimeout(t);
  }, [filters.search]);


  const apiFilters = useMemo(
    () => ({
      visibility: filters.visibility || undefined,
      include_archived: filters.include_archived === true,
      roots_only: true,
      search: debouncedSearch || undefined,
    }),
    [
      filters.visibility,
      filters.include_archived,
      debouncedSearch,
    ]
  );

  const refreshList = useCallback(async () => {
    setListError("");
    setLoadingList(true);
    try {
      const pagesRes = await fetchWikiPages({
        ...apiFilters,
        page: listPage,
        per_page: perPage,
        order,
      });
      setListItems(Array.isArray(pagesRes.items) ? pagesRes.items : []);
      setListMeta({
        total: pagesRes.total ?? 0,
        page: pagesRes.page ?? listPage,
        max_pages: pagesRes.max_pages ?? 1,
        per_page: pagesRes.per_page ?? perPage,
      });
    } catch (err) {
      const msg =
        typeof err?.message === "string" && err.message.trim() !== ""
          ? err.message.trim()
          : "No se pudieron cargar los documentos.";
      setListError(msg);
      setListItems([]);
    } finally {
      setLoadingList(false);
    }
  }, [apiFilters, listPage, perPage, order]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  function onFiltersChange(patch) {
    setFilters((prev) => ({ ...prev, ...patch, roots_only: true }));
    setListPage(1);
  }

  function goPrevPage() {
    setListPage((p) => Math.max(1, (Number(p) || 1) - 1));
  }

  function goNextPage() {
    const maxP = Math.max(1, Number(listMeta.max_pages) || 1);
    setListPage((p) => Math.min(maxP, (Number(p) || 1) + 1));
  }

  async function handleCreateDocument() {
    setSaveHint("");
    try {
      const created = await createWikiPage({
        title: "Sin título",
        parent_id: null,
        status: "draft",
        document_type: "document",
        visibility: "internal",
      });
      const nid = String(created?.id ?? "").trim();
      if (nid) spaNavigate(`/app/wiki/${encodeURIComponent(nid)}`);
      void refreshList();
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo crear el documento.";
      setSaveHint(msg);
    }
  }

  function openDocument(docId) {
    const id = String(docId ?? "").trim();
    if (!id) return;
    spaNavigate(`/app/wiki/${encodeURIComponent(id)}`);
  }

  function getRowById(rowId) {
    const id = String(rowId ?? "").trim();
    return listItems.find((item) => String(item?.id ?? "") === id) || null;
  }

  function openRowMenu(event, rowId) {
    event.preventDefault();
    event.stopPropagation();
    setRowMenu({
      id: String(rowId ?? "").trim(),
      event: event.nativeEvent,
    });
  }

  function closeRowMenu() {
    setRowMenu({ id: "", event: null });
  }

  function openTypeMenu(event, rowId) {
    event.preventDefault();
    event.stopPropagation();
    setTypeMenu({
      id: String(rowId ?? "").trim(),
      event: event.nativeEvent,
    });
  }

  function closeTypeMenu() {
    setTypeMenu({ id: "", event: null });
  }

  async function handleTypeMenuChange(rowId, value) {
    await handleListFieldChange(rowId, "document_type", value);
    closeTypeMenu();
  }

  async function handleCopyPublicUrl(row) {
    if (!isPublicLinkActive(row)) return;
    const url = buildPublicWikiUrl(row);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setSaveHint("URL pública copiada.");
    } catch {
      setSaveHint("No se pudo copiar la URL pública.");
    } finally {
      closeRowMenu();
    }
  }

  function openPublicModal(row) {
    const id = String(row?.id ?? "").trim();
    if (!id) return;
    setPublicModalId(id);
    setPublicExpiryDraft(publicExpiryInputValue(row?.public_expires_at));
    setPublicModalHint("");
    closeRowMenu();
  }

  function closePublicModal() {
    if (publicModalBusy) return;
    setPublicModalId("");
    setPublicModalHint("");
  }

  function mergePublicRow(id, next) {
    setListItems((items) =>
      items.map((item) => (String(item?.id ?? "") === id ? { ...item, ...next } : item))
    );
  }

  async function handleModalPublish(regenerate = false) {
    const id = String(publicModalId).trim();
    if (!id) return;
    const expiresAt = publicExpiryDraft
      ? new Date(publicExpiryDraft).toISOString()
      : null;
    setPublicModalBusy(true);
    setPublicModalHint("");
    try {
      const result = await publishWikiPublicLink(id, {
        expires_at: expiresAt,
        regenerate,
      });
      const next = result?.item || result;
      mergePublicRow(id, next);
      setPublicExpiryDraft(publicExpiryInputValue(next?.public_expires_at));
      setPublicModalHint(regenerate ? "Enlace público regenerado." : "Condiciones guardadas.");
    } catch (err) {
      setPublicModalHint(err?.message || "No se pudieron guardar las condiciones.");
    } finally {
      setPublicModalBusy(false);
    }
  }

  async function handleModalRevoke() {
    const id = String(publicModalId).trim();
    if (!id) return;
    setPublicModalBusy(true);
    setPublicModalHint("");
    try {
      const result = await revokeWikiPublicLink(id);
      mergePublicRow(id, result?.item || result);
      setPublicModalHint("Enlace público revocado.");
    } catch (err) {
      setPublicModalHint(err?.message || "No se pudo revocar el enlace público.");
    } finally {
      setPublicModalBusy(false);
    }
  }

  async function handleDuplicateDocument(row) {
    const id = String(row?.id ?? "").trim();
    if (!id) return;
    closeRowMenu();
    try {
      const result = await duplicateWikiPage(id);
      const duplicated = result?.item || result;
      if (duplicated?.id) {
        setListItems((items) => [duplicated, ...items]);
        setListMeta((meta) => ({ ...meta, total: Number(meta.total || 0) + 1 }));
      } else {
        void refreshList();
      }
      setSaveHint("Documento duplicado.");
    } catch (err) {
      setSaveHint(err?.message || "No se pudo duplicar el documento.");
    }
  }

  async function handleDeleteDocument(row) {
    const id = String(row?.id ?? "").trim();
    if (!id) return;
    if (!window.confirm("¿Borrar este documento? Se archivará y dejará de estar visible.")) return;
    closeRowMenu();
    try {
      await deleteWikiPage(id);
      setListItems((items) => items.filter((item) => String(item?.id ?? "") !== id));
      setListMeta((meta) => ({ ...meta, total: Math.max(0, Number(meta.total || 0) - 1) }));
      setSaveHint("Documento borrado.");
    } catch (err) {
      setSaveHint(err?.message || "No se pudo borrar el documento.");
    }
  }

  async function commitRowTitle(rowId, originalTitle) {
    const id = String(rowId ?? "").trim();
    if (!id) return;

    const currentTitle = String(originalTitle ?? "").trim();
    const nextTitle = String(titleDrafts[id] ?? originalTitle ?? "").trim();

    if (!nextTitle) {
      setSaveHint("El título no puede estar vacío.");
      setTitleDrafts((prev) => ({ ...prev, [id]: currentTitle }));
      return;
    }

    if (nextTitle === currentTitle) {
      setTitleDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setSaveHint("");
    setSavingTitleId(id);

    try {
      await patchWikiPage(id, { title: nextTitle });
      setListItems((items) =>
        items.map((item) =>
          String(item?.id ?? "") === id ? { ...item, title: nextTitle } : item
        )
      );
      setTitleDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      const msg =
        typeof err?.message === "string" && err.message.trim() !== ""
          ? err.message.trim()
          : "No se pudo guardar el título.";
      setSaveHint(msg);
    } finally {
      setSavingTitleId("");
    }
  }

  async function handleListFieldChange(rowId, field, value) {
    const id = String(rowId ?? "").trim();
    const allowedFields = new Set(["document_type", "visibility"]);
    if (!id || !allowedFields.has(field)) return;

    let nextValue = String(value ?? "").trim() || null;
    if (field === "visibility") {
      nextValue = normalizeLegacyVisibility(nextValue);
    }
    if (field === "document_type" && nextValue === "page") {
      nextValue = "document";
    }

    if (field === "visibility") {
      const normalizedVisibility = normalizeLegacyVisibility(nextValue);
      const currentRow = getRowById(id);

      setSaveHint("");
      try {
        let nextRow = null;

        if (normalizedVisibility === "public_link") {
          const result = await publishWikiPublicLink(id, {
            expires_at: currentRow?.public_expires_at || null,
            regenerate: false,
          });
          nextRow = result?.item || result;
          setSaveHint("Enlace público activado.");
        } else if (normalizedVisibility === "internal") {
          if (currentRow?.public_enabled || currentRow?.public_token) {
            const result = await revokeWikiPublicLink(id);
            nextRow = result?.item || result;
          } else {
            await patchWikiPage(id, { visibility: "internal" });
            nextRow = { visibility: "internal" };
          }
          setSaveHint("Visibilidad actualizada.");
        }

        if (nextRow) {
          setListItems((items) =>
            items.map((item) =>
              String(item?.id ?? "") === id ? { ...item, ...nextRow } : item
            )
          );
        }
        return;
      } catch (err) {
        const msg =
          typeof err?.message === "string" && err.message.trim() !== ""
            ? err.message.trim()
            : "No se pudo actualizar la visibilidad.";
        setSaveHint(msg);
        return;
      }
    }

    setSaveHint("");
    try {
      await patchWikiPage(id, { [field]: nextValue });
      setListItems((items) =>
        items.map((item) =>
          String(item?.id ?? "") === id ? { ...item, [field]: nextValue } : item
        )
      );
    } catch (err) {
      const msg =
        typeof err?.message === "string" && err.message.trim() !== ""
          ? err.message.trim()
          : "No se pudo guardar el cambio.";
      setSaveHint(msg);
    }
  }

  return (
    <div className="od-page">
      <div className="od-page-inner od-page-inner--full od-page-inner--align-stretch">
        <header className="od-page-header">
          <h1 className="od-page-title">Wiki</h1>
          <div className="od-wiki-header-actions">
            <IonButton size="small" fill="solid" type="button" onClick={() => void handleCreateDocument()}>
              Nuevo documento
            </IonButton>
          </div>
        </header>

        <WikiFiltersBar
          filters={filters}
          onFiltersChange={onFiltersChange}
          order={order}
          onOrderChange={(v) => {
            setOrder(v);
            setListPage(1);
          }}
          perPage={perPage}
          onPerPageChange={(n) => {
            setPerPage(n);
            setListPage(1);
          }}
          showRootsOnlyToggle={false}
        />

        {listError ? (
          <p className="od-status-line od-status-line--error">{listError}</p>
        ) : null}
        {!listError && loadingList ? <p className="od-status-line">Cargando…</p> : null}
        {saveHint ? <p className="od-status-line">{saveHint}</p> : null}

        <div className="od-table-wrap od-wiki-library-table-wrap">
          <table className="od-table od-table--fill od-table--listing-wide od-wiki-library-table">
            <thead>
            <tr>
              <th className="od-wiki-table__actions-col" aria-label="Acciones" />
              <th className="od-table-col--title od-wiki-table__document-col">Documento</th>
              <th className="od-wiki-table__type-col">Tipo</th>
              <th className="od-wiki-table__visibility-col">Visibilidad</th>
            </tr>
            </thead>
            <tbody>
              {!loadingList && listItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <span
                      className="od-status-line"
                      style={{ margin: 0, border: "none", background: "transparent" }}
                    >
                      No hay documentos con estos filtros.
                    </span>
                  </td>
                </tr>
              ) : null}
              {listItems.map((row) => {
                const rid = row.id != null ? String(row.id) : "";
                return (
                  <tr
                    key={rid}
                    className="od-table-row--clickable"
                    onClick={() => openDocument(rid)}
                  >
                  <td
                    className="od-wiki-table__actions-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <span className="od-wiki-table__actions-inner">
                    <button
                      type="button"
                      className="od-wiki-row-action"
                      title="Abrir documento"
                      aria-label="Abrir documento"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        openDocument(rid);
                      }}
                    >
                      <IonIcon icon={OD_ICONS.tabDocuments} aria-hidden />
                    </button>

                    <button
                      type="button"
                      className="od-wiki-row-action"
                      title="Más acciones"
                      aria-label="Más acciones"
                      onClick={(event) => openRowMenu(event, rid)}
                    >
                      <IonIcon icon={OD_ICONS.menuMore} aria-hidden />
                    </button>
                    </span>
                  </td>

                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      type="text"
                      className="od-wiki-title-inline-input"
                      value={titleDrafts[rid] ?? String(row.title ?? "")}
                      disabled={savingTitleId === rid}
                      maxLength={220}
                      onChange={(event) =>
                        setTitleDrafts((prev) => ({
                          ...prev,
                          [rid]: event.target.value,
                        }))
                      }
                      onBlur={() => void commitRowTitle(rid, row.title)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setTitleDrafts((prev) => {
                            const next = { ...prev };
                            delete next[rid];
                            return next;
                          });
                          event.currentTarget.blur();
                        }
                      }}
                    />

                    {row.is_archived ? (
                      <span className="od-muted-inline" style={{ marginLeft: "0.35rem" }}>
                        arch.
                      </span>
                    ) : null}
                  </td>

                  <td
                    className="od-wiki-table__type-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className={`od-badge-clickable od-wiki-type-badge ${wikiTypeBadgeClass(row.document_type)}`}
                      disabled={false}
                      onClick={(event) => openTypeMenu(event, rid)}
                    >
                      <span className="od-badge-clickable__label">{wikiTypeLabel(row.document_type)}</span>
                      <IonIcon icon={OD_ICONS.chevronDown} aria-hidden />
                    </button>
                  </td>

                  <td
                    className="od-wiki-table__visibility-cell"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ODFilterSelect
                      mode="single"
                      options={buildVisibilityOptions(row.visibility)}
                      value={normalizeLegacyVisibility(row.visibility)}
                      onChange={(value) =>
                        void handleListFieldChange(rid, "visibility", value)
                      }
                      placeholder="Interno"
                      showClear={false}
                      disabled={false}
                      searchable={false}
                      panelPortal
                      className="od-wiki-visibility-select"
                      triggerClassName="od-wiki-fixed-select-trigger"
                    />
                  </td>


                  </tr>
                );
              })}
            </tbody>
          </table>
          <IonPopover
            isOpen={Boolean(rowMenu.id)}
            event={rowMenu.event}
            onDidDismiss={closeRowMenu}
            className="od-wiki-row-menu-popover"
          >
            <IonContent className="od-action-popover-content">
              <IonList lines="none" className="od-wiki-row-menu">
                <IonItem
                  button
                  detail={false}
                  disabled={!isPublicLinkActive(getRowById(rowMenu.id))}
                  onClick={() => void handleCopyPublicUrl(getRowById(rowMenu.id))}
                >
                  <span className="od-popover-menu-label">
                    <IonIcon
                      icon={OD_ICONS.copyUrl}
                      className="od-popover-menu-icon"
                      aria-hidden="true"
                    />
                    Copiar URL pública
                  </span>
                </IonItem>

                <IonItem
                  button
                  detail={false}
                  onClick={() => openPublicModal(getRowById(rowMenu.id))}
                >
                  <span className="od-popover-menu-label">
                    <IonIcon
                      icon={OD_ICONS.settings}
                      className="od-popover-menu-icon"
                      aria-hidden="true"
                    />
                    Condiciones de visibilidad
                  </span>
                </IonItem>

                <IonItem
                  button
                  detail={false}
                  onClick={() => void handleDuplicateDocument(getRowById(rowMenu.id))}
                >
                  <span className="od-popover-menu-label">
                    <IonIcon
                      icon={OD_ICONS.duplicate}
                      className="od-popover-menu-icon"
                      aria-hidden="true"
                    />
                    Duplicar documento
                  </span>
                </IonItem>

                <IonItem
                  button
                  detail={false}
                  onClick={() => void handleDeleteDocument(getRowById(rowMenu.id))}
                >
                  <span className="od-popover-menu-label od-popover-menu-label--danger">
                    <IonIcon
                      icon={OD_ICONS.delete}
                      className="od-popover-menu-icon"
                      aria-hidden="true"
                    />
                    Borrar documento
                  </span>
                </IonItem>
              </IonList>
            </IonContent>
          </IonPopover>

          {publicModalId ? (
            <div className="od-modal-backdrop" role="presentation">
            {(() => {
              const row = getRowById(publicModalId);
              const active = isPublicLinkActive(row);
              const publicUrl = buildPublicWikiUrl(row);
              return (
                <section className="od-modal od-wiki-visibility-modal" role="dialog" aria-modal="true">
                  <header className="od-modal-header">
                    <div>
                      <h2 className="od-modal-title">Condiciones de visibilidad</h2>
                      <p className="od-wiki-visibility-modal__status">{publicLinkStatus(row)}</p>
                    </div>
                    <button
                      type="button"
                      className="od-modal-close"
                      aria-label="Cerrar"
                      onClick={closePublicModal}
                      disabled={publicModalBusy}
                    >
                      ×
                    </button>
                  </header>

                  <div className="od-modal-body">

                  {row?.public_token ? (
                    <div className="od-wiki-visibility-modal__url">
                      <span className="od-wiki-visibility-modal__label">URL pública</span>
                      <code>{publicUrl}</code>
                      <button
                        type="button"
                        className="od-wiki-button-secondary"
                        disabled={!active || publicModalBusy}
                        onClick={() => void handleCopyPublicUrl(row)}
                      >
                        Copiar URL
                      </button>
                    </div>
                  ) : null}

                  <label className="od-wiki-visibility-modal__field">
                    <span className="od-wiki-visibility-modal__label">Caducidad opcional</span>
                    <input
                      type="datetime-local"
                      className="od-wiki-visibility-modal__input"
                      value={publicExpiryDraft}
                      disabled={publicModalBusy}
                      onChange={(event) => setPublicExpiryDraft(event.target.value)}
                    />
                  </label>

                  {publicModalHint ? (
                    <p className="od-inline-msg" role="status">{publicModalHint}</p>
                  ) : null}

                  <div className="od-modal-actions od-wiki-visibility-modal__actions">
                    <button
                      type="button"
                      className="od-modal-primary"
                      disabled={publicModalBusy}
                      onClick={() => void handleModalPublish(false)}
                    >
                      {active ? "Guardar condiciones" : "Activar enlace público"}
                    </button>
                    {row?.public_token ? (
                      <button
                        type="button"
                        className="od-wiki-button-secondary"
                        disabled={publicModalBusy}
                        onClick={() => void handleModalPublish(true)}
                      >
                        Regenerar enlace
                      </button>
                    ) : null}
                    {active ? (
                      <button
                        type="button"
                        className="od-wiki-button-danger"
                        disabled={publicModalBusy}
                        onClick={() => void handleModalRevoke()}
                      >
                        Revocar enlace público
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="od-wiki-button-secondary"
                      disabled={publicModalBusy}
                      onClick={closePublicModal}
                    >
                      Cerrar
                    </button>
                  </div>
                  </div>
                </section>
              );
            })()}
            </div>
          ) : null}

          <IonPopover
            isOpen={Boolean(typeMenu.id)}
            event={typeMenu.event}
            onDidDismiss={closeTypeMenu}
            className="od-wiki-type-menu-popover"
          >
            <IonContent className="od-action-popover-content od-wiki-sidebar-popover">
              <IonList lines="none" className="od-wiki-type-menu">
                {buildWikiTypeOptions(getRowById(typeMenu.id)?.document_type).map((option) => {
                  const row = getRowById(typeMenu.id);
                  const selected = normalizeWikiType(row?.document_type) === option.value;

                  return (
                    <IonItem
                      key={option.value}
                      button
                      detail={false}
                      className={selected ? "od-wiki-type-menu__item--selected" : ""}
                      onClick={() => void handleTypeMenuChange(typeMenu.id, option.value)}
                    >
                      <span
                        className={`od-badge-clickable od-wiki-type-badge od-wiki-type-badge--menu ${wikiTypeBadgeClass(
                          option.value
                        )}`}
                      >
                        <span className="od-badge-clickable__label">{option.label}</span>
                      </span>
                    </IonItem>
                  );
                })}
              </IonList>
            </IonContent>
          </IonPopover>
        </div>

        <TaskPagination
          page={listMeta.page || listPage}
          maxPages={listMeta.max_pages || 1}
          total={listMeta.total ?? 0}
          perPage={listMeta.per_page || perPage}
          disabled={loadingList}
          onPrev={goPrevPage}
          onNext={goNextPage}
        />
      </div>
    </div>
  );
}

function WikiDocumentWorkspace({ pageId }) {
  const [documentRoot, setDocumentRoot] = useState(null);
  const [outlineFlat, setOutlineFlat] = useState([]);
  const [detail, setDetail] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [dirtyTitle, setDirtyTitle] = useState(false);
  const [detailViewMode, setDetailViewMode] = useState("edit");
  const [treeDragState, setTreeDragState] = useState({
    sourceId: "",
    targetId: "",
    position: "",
  });

  const [loadingOutline, setLoadingOutline] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [detailError, setDetailError] = useState("");
  const [saveHint, setSaveHint] = useState("");
  const [copyRootBusy, setCopyRootBusy] = useState(false);
  const isMobile = useWikiMobileLayout();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const actionsMenuId = useMemo(
    () => `od-wiki-workspace-menu-${pageId || "none"}`,
    [pageId]
  );

  const loadWorkspace = useCallback(async (activePageId) => {
    setLoadingDetail(true);
    setLoadingOutline(true);
    setDetailError("");
    try {
      const page = await fetchWikiPageById(activePageId);
      const root = await resolveDocumentRoot(page);
      setDocumentRoot(root);

      const outlineRes = await fetchWikiOutline({
        roots_only: false,
        include_archived: Boolean(page.is_archived || root.is_archived),
      });
      const allItems = Array.isArray(outlineRes.items) ? outlineRes.items : [];
      const subtreeIds = collectSubtreeIds(allItems, root.id);
      const filtered = allItems.filter((n) => subtreeIds.has(String(n.id)));
      if (!filtered.some((n) => String(n.id) === String(root.id))) {
        filtered.unshift({
          id: root.id,
          parent_id: null,
          title: root.title,
          menu_order: root.menu_order ?? 0,
          status: root.status,
          visibility: root.visibility,
          is_archived: root.is_archived,
        });
      }
      setOutlineFlat(filtered);

      const firstChildId = pickFirstChildPageId(filtered, root.id);
      if (firstChildId && String(activePageId) === String(root.id)) {
        spaNavigate(`/app/wiki/${encodeURIComponent(firstChildId)}`);
        return;
      }

      setDetail(page);
      setTitleDraft(String(page?.title ?? ""));
      setDirtyTitle(false);
      setDetailViewMode(page?.is_archived ? "read" : "edit");
    } catch (err) {
      const msg =
        typeof err?.message === "string" && err.message.trim() !== ""
          ? err.message.trim()
          : "No se pudo cargar el documento.";
      setDetail(null);
      setDocumentRoot(null);
      setOutlineFlat([]);
      setDetailError(msg);
      setTitleDraft("");
    } finally {
      setLoadingDetail(false);
      setLoadingOutline(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace(pageId);
  }, [pageId, loadWorkspace]);

  useEffect(() => {
    if (!isMobile) setMobileDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !mobileDrawerOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setMobileDrawerOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, mobileDrawerOpen]);

  const hasChildPages = useMemo(
    () => outlineFlat.some((n) => n.parent_id && String(n.parent_id) === String(documentRoot?.id)),
    [outlineFlat, documentRoot?.id]
  );

  const sidebarTreeFlat = useMemo(() => {
    if (!documentRoot?.id) return [];
    if (!hasChildPages) return outlineFlat;
    return outlineFlat.filter((n) => String(n.id) !== String(documentRoot.id));
  }, [outlineFlat, documentRoot?.id, hasChildPages]);

  const treeRoots = useMemo(() => buildTreeNodes(sidebarTreeFlat), [sidebarTreeFlat]);

  const showRootContentNotice = useMemo(
    () =>
      Boolean(
        documentRoot?.id &&
          hasChildPages &&
          !documentRoot.is_archived &&
          wikiPageHasStoredContent(documentRoot)
      ),
    [documentRoot, hasChildPages]
  );

  async function saveTitleIfNeeded() {
    if (!detail || !dirtyTitle) return;
    const next = String(titleDraft ?? "").trim().slice(0, 500);
    if (!next) {
      setSaveHint("El título no puede estar vacío.");
      return;
    }
    if (next === String(detail.title ?? "").trim()) {
      setDirtyTitle(false);
      return;
    }
    try {
      await patchWikiPage(detail.id, { title: next });
      setDirtyTitle(false);
      setSaveHint("Título guardado.");
      setDetail((d) => (d ? { ...d, title: next } : d));
      void loadWorkspace(String(detail.id));
      setTimeout(() => setSaveHint(""), 2000);
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo guardar el título.";
      setSaveHint(msg);
    }
  }

  async function onEditorSave({ content_json, content_html }) {
    if (!detail?.id) return;
    try {
      await patchWikiPage(detail.id, { content_json, content_html });
      setSaveHint("Guardado.");
      setDetail((d) => (d ? { ...d, content_json, content_html } : d));
      setTimeout(() => setSaveHint(""), 2200);
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo guardar el contenido.";
      setSaveHint(msg);
    }
  }

  async function handleCreateSubpageFor(parentPageId) {
    const pid = String(parentPageId ?? "").trim();
    if (!pid) return;
    setSaveHint("");
    try {
      let parent =
        detail && String(detail.id) === pid
          ? detail
          : documentRoot && String(documentRoot.id) === pid
            ? documentRoot
            : await fetchWikiPageById(pid);
      const created = await createWikiPage({
        title: "Sin título",
        parent_id: pid,
        status: "draft",
        visibility: parent?.visibility || "internal",
      });
      const nid = String(created?.id ?? "").trim();
      if (nid) spaNavigate(`/app/wiki/${encodeURIComponent(nid)}`);
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo crear la subpágina.";
      setSaveHint(msg);
    }
  }

  async function handleCreateSubpage() {
    if (!detail?.id) return;
    await handleCreateSubpageFor(detail.id);
  }

  async function handleRenamePage(targetPageId, currentTitle) {
    const next = window.prompt("Título de la página", String(currentTitle ?? "").trim());
    if (next === null) return;
    const title = String(next).trim().slice(0, 500);
    if (!title) {
      setSaveHint("El título no puede estar vacío.");
      return;
    }
    setSaveHint("");
    try {
      await patchWikiPage(targetPageId, { title });
      if (String(targetPageId) === String(pageId)) {
        setTitleDraft(title);
        setDetail((d) => (d ? { ...d, title } : d));
      }
      void loadWorkspace(pageId);
      setSaveHint("Título actualizado.");
      setTimeout(() => setSaveHint(""), 2000);
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo renombrar.";
      setSaveHint(msg);
    }
  }

  async function handleArchivePage(targetPageId) {
    if (!window.confirm("¿Archivar esta página? Podrás verla con “Incluir archivadas” en la biblioteca.")) {
      return;
    }
    setSaveHint("");
    try {
      await patchWikiPage(targetPageId, { is_archived: true, status: "archived" });
      if (String(targetPageId) === String(pageId)) {
        spaNavigate("/app/wiki");
        return;
      }
      void loadWorkspace(pageId);
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo archivar.";
      setSaveHint(msg);
    }
  }

  async function handleArchive() {
    if (!detail?.id) return;
    await handleArchivePage(detail.id);
  }

  async function handleCreatePageUnderRoot() {
    if (!documentRoot?.id) return;
    setSaveHint("");
    try {
      const created = await createWikiPage({
        title: "Sin título",
        parent_id: documentRoot.id,
        status: "draft",
        visibility: documentRoot.visibility || "internal",
      });
      const nid = String(created?.id ?? "").trim();
      if (nid) spaNavigate(`/app/wiki/${encodeURIComponent(nid)}`);
    } catch (err) {
      const msg =
        typeof err?.message === "string" ? err.message.trim() : "No se pudo crear la página.";
      setSaveHint(msg);
    }
  }

  async function handleCopyRootContentToChild() {
    if (!documentRoot?.id || copyRootBusy) return;
    if (
      !window.confirm(
        "¿Crear una página interna con el contenido guardado en la raíz? La página raíz no se modificará."
      )
    ) {
      return;
    }
    setCopyRootBusy(true);
    setSaveHint("");
    try {
      const created = await copyWikiRootContentToChild(documentRoot.id);
      const nid = String(created?.id ?? "").trim();
      if (nid) {
        setSaveHint("Página interna creada con el contenido de la raíz.");
        spaNavigate(`/app/wiki/${encodeURIComponent(nid)}`);
      } else {
        setSaveHint("No se pudo obtener la nueva página.");
      }
    } catch (err) {
      const msg =
        typeof err?.message === "string"
          ? err.message.trim()
          : "No se pudo copiar el contenido a una página interna.";
      setSaveHint(msg);
    } finally {
      setCopyRootBusy(false);
    }
  }

  function isSameParent(a, b) {
    return String(a ?? "") === String(b ?? "");
  }

  function isTargetInsideDraggedSubtree(sourceId, targetId) {
    const ids = collectSubtreeIds(outlineFlat, sourceId);
    return ids.has(String(targetId));
  }

  function handleTreeDragStart(event, sourceId) {
    const id = String(sourceId ?? "").trim();
    if (!id) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
    setTreeDragState({ sourceId: id, targetId: "", position: "" });
  }

  function handleTreeDragOver(event, targetId) {
    const sourceId = String(
      treeDragState.sourceId || event.dataTransfer.getData("text/plain") || ""
    ).trim();
    const target = String(targetId ?? "").trim();
    if (!sourceId || !target || sourceId === target) return;
    if (isTargetInsideDraggedSubtree(sourceId, target)) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height);
    let position = "inside";
    if (ratio < 0.25) position = "before";
    else if (ratio > 0.75) position = "after";

    setTreeDragState({ sourceId, targetId: target, position });
  }

  function handleTreeDragEnd() {
    setTreeDragState({ sourceId: "", targetId: "", position: "" });
  }

  async function handleTreeDrop(event, targetId) {
    event.preventDefault();
    event.stopPropagation();

    const sourceId = String(
      treeDragState.sourceId || event.dataTransfer.getData("text/plain") || ""
    ).trim();
    const target = String(targetId ?? "").trim();
    const position = String(treeDragState.position || "").trim();

    setTreeDragState({ sourceId: "", targetId: "", position: "" });

    if (!sourceId || !target || sourceId === target || !position) return;
    if (isTargetInsideDraggedSubtree(sourceId, target)) {
      setSaveHint("No se puede mover una página dentro de su propia rama.");
      return;
    }

    const targetPage = outlineFlat.find((p) => String(p.id) === target);
    if (!targetPage) return;

    let targetParentId = null;
    let targetIndex;

    if (position === "inside") {
      targetParentId = target;
      const children = outlineFlat
        .filter(
          (p) =>
            String(p.parent_id ?? "") === target &&
            String(p.id) !== sourceId &&
            !p.is_archived
        )
        .sort(sortPagesByOrder);
      targetIndex = children.length;
    } else {
      targetParentId = targetPage.parent_id || null;
      const sourcePage = outlineFlat.find((p) => String(p.id) === sourceId);
      const siblings = outlineFlat
        .filter(
          (p) =>
            isSameParent(p.parent_id, targetParentId) &&
            String(p.id) !== sourceId &&
            !p.is_archived
        )
        .sort(sortPagesByOrder);
      const targetSiblingIndex = siblings.findIndex((p) => String(p.id) === target);
      targetIndex =
        position === "before"
          ? Math.max(0, targetSiblingIndex)
          : Math.max(0, targetSiblingIndex + 1);
      if (
        sourcePage &&
        isSameParent(sourcePage.parent_id, targetParentId) &&
        targetSiblingIndex < 0
      ) {
        return;
      }
    }

    try {
      setSaveHint("");
      await moveWikiPage(sourceId, {
        target_parent_id: targetParentId,
        target_index: targetIndex,
      });
      await loadWorkspace(pageId);
      setSaveHint("Página movida.");
      setTimeout(() => setSaveHint(""), 1800);
    } catch (err) {
      const msg =
        typeof err?.message === "string" && err.message.trim() !== ""
          ? err.message.trim()
          : "No se pudo mover la página.";
      setSaveHint(msg);
    }
  }

  function pickPage(pid) {
    const id = String(pid ?? "").trim();
    if (!id) return;
    if (isMobile) setMobileDrawerOpen(false);
    if (id === pageId) return;
    spaNavigate(`/app/wiki/${encodeURIComponent(id)}`);
  }

  const documentTitle = String(documentRoot?.title ?? "").trim() || "Documento";
  const canEdit = Boolean(detail?.id && !detail.is_archived);

  function renderDocActionsMenu(triggerId) {
    return (
      <WikiSidebarMenu
        triggerId={triggerId}
        ariaLabel="Acciones del documento"
        items={[
          {
            key: "page",
            icon: OD_ICONS.add,
            label: "Crear página",
            disabled: !documentRoot?.id || documentRoot.is_archived,
            onClick: () => void handleCreatePageUnderRoot(),
          },
          ...(hasChildPages
            ? [
                {
                  key: "subpage",
                  icon: OD_ICONS.add,
                  label: "Crear subpágina",
                  disabled: !detail?.id || detail.is_archived,
                  onClick: () => void handleCreateSubpage(),
                },
              ]
            : []),
          ...(canEdit
            ? [
                {
                  key: "mode",
                  icon: detailViewMode === "read" ? OD_ICONS.edit : OD_ICONS.eye,
                  label: detailViewMode === "read" ? "Modo edición" : "Modo lectura",
                  onClick: () => setDetailViewMode((m) => (m === "read" ? "edit" : "read")),
                },
              ]
            : []),
          {
            key: "archive",
            icon: OD_ICONS.delete,
            label: "Archivar",
            disabled: !detail?.id,
            onClick: () => void handleArchive(),
          },
        ]}
      />
    );
  }

  const showSidebarExpandRail = isMobile ? !mobileDrawerOpen : !desktopSidebarOpen;

  const sidebarContentProps = {
    documentTitle,
    detail,
    detailError,
    loadingOutline,
    hasChildPages,
    treeRoots,
    pageId,
    onPickPage: pickPage,
    onBackToLibrary: () => spaNavigate("/app/wiki"),
    documentRoot,
    actionsMenuId,
    renderDocActionsMenu,
    onCreatePageUnderRoot: handleCreatePageUnderRoot,
    onCreateSubpageFor: handleCreateSubpageFor,
    onRenamePage: handleRenamePage,
    onArchivePage: handleArchivePage,
    dragEnabled: true,
    dragState: treeDragState,
    onDragStartPage: handleTreeDragStart,
    onDragOverPage: handleTreeDragOver,
    onDropPage: handleTreeDrop,
    onDragEndPage: handleTreeDragEnd,
  };

  return (
    <div
      className={`od-wiki-workspace${isMobile ? " is-mobile-layout" : ""}${
        !isMobile && !desktopSidebarOpen ? " is-desktop-sidebar-hidden" : ""
      }`}
    >
      {showSidebarExpandRail ? (
        <WikiSidebarExpandTab
          ariaLabel={isMobile ? "Abrir páginas del documento" : "Mostrar panel de páginas"}
          onClick={() => {
            if (isMobile) setMobileDrawerOpen(true);
            else setDesktopSidebarOpen(true);
          }}
        />
      ) : null}

      <div className="od-wiki-workspace__body">
        {!isMobile && desktopSidebarOpen ? (
          <aside className="od-wiki-workspace__sidebar" aria-label="Navegación del documento">
            <WikiDocumentSidebarContent
              {...sidebarContentProps}
              onCollapseSidebar={() => setDesktopSidebarOpen(false)}
            />
          </aside>
        ) : null}

        {isMobile && mobileDrawerOpen ? (
          <button
            type="button"
            className="od-wiki-workspace__mobile-drawer-backdrop"
            aria-label="Cerrar panel de páginas"
            onClick={() => setMobileDrawerOpen(false)}
          />
        ) : null}

        {isMobile ? (
          <aside
            className={`od-wiki-workspace__mobile-drawer${mobileDrawerOpen ? " is-open" : ""}`}
            aria-label="Navegación del documento"
            aria-hidden={mobileDrawerOpen ? "false" : "true"}
          >
            <div className="od-wiki-workspace__mobile-drawer-header">
              <span className="od-wiki-workspace__mobile-drawer-title">Páginas</span>
              <button
                type="button"
                className="od-wiki-workspace__mobile-drawer-close"
                aria-label="Cerrar panel de páginas"
                onClick={() => setMobileDrawerOpen(false)}
              >
                ×
              </button>
            </div>
            <WikiDocumentSidebarContent {...sidebarContentProps} />
          </aside>
        ) : null}

        <article className="od-wiki-workspace__canvas">
          {loadingDetail && loadingOutline ? (
            <p className="od-wiki-workspace__canvas-status">Cargando documento…</p>
          ) : detailError ? (
            <div className="od-wiki-workspace__error">
              <p className="od-status-line od-status-line--error">{detailError}</p>
              <button
                type="button"
                className="od-wiki-workspace__link-btn"
                onClick={() => spaNavigate("/app/wiki")}
              >
                Volver a la biblioteca
              </button>
            </div>
          ) : detail ? (
            <div className="od-wiki-workspace__canvas-inner">
              {showRootContentNotice ? (
                <div className="od-wiki-root-content-notice" role="status">
                  <p className="od-wiki-root-content-notice__text">
                    Este documento tiene contenido guardado en la página raíz. Puedes copiarlo a una
                    página interna para conservarlo dentro del nuevo modelo documental.
                  </p>
                  <div className="od-wiki-root-content-notice__actions">
                    <button
                      type="button"
                      className="od-wiki-workspace__link-btn"
                      disabled={copyRootBusy}
                      onClick={() => void handleCopyRootContentToChild()}
                    >
                      {copyRootBusy ? "Creando página…" : "Crear página interna con este contenido"}
                    </button>
                  </div>
                </div>
              ) : null}

              <input
                className="od-wiki-workspace__page-title"
                aria-label="Título de la página"
                maxLength={500}
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value);
                  setDirtyTitle(true);
                }}
                onBlur={() => void saveTitleIfNeeded()}
                disabled={Boolean(detail.is_archived) || detailViewMode === "read"}
              />

              <div className="od-wiki-workspace__editor">
                <WikiTiptapEditor
                  key={detail.id}
                  pageKey={detail.id}
                  contentJson={detail.content_json}
                  contentHtml={detail.content_html}
                  disabled={Boolean(detail.is_archived) || detailViewMode === "read"}
                  onSave={(payload) => void onEditorSave(payload)}
                />
              </div>

              {detail.is_archived ? (
                <p className="od-wiki-editor-hint">Página archivada.</p>
              ) : null}
            </div>
          ) : null}
        </article>

        <div id="od-wiki-block-panel-host" className="od-wiki-block-panel-host" aria-hidden="true" />
      </div>

      {saveHint ? (
        <div
          className={`od-wiki-save-toast${
            /\b(no se pudo|error|vacío|vacío)\b/i.test(saveHint) ? " is-error" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          {saveHint}
        </div>
      ) : null}
    </div>
  );
}

export function WikiPublicPage({ token }) {
  const [documentData, setDocumentData] = useState(null);
  const [outline, setOutline] = useState([]);
  const [activePageId, setActivePageId] = useState("");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isMobile = useWikiMobileLayout();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchPublicWikiByToken(token)
      .then((result) => {
        if (cancelled) return;
        const item = result?.item || result || null;
        setDocumentData(item ? { ...item, _attachment_urls: result?.attachment_urls || {} } : null);
        setOutline(Array.isArray(result?.outline) ? result.outline : []);
        setActivePageId(String(item?.id ?? ""));
      })
      .catch((err) => {
        if (!cancelled) {
          setDocumentData(null);
          setError(err?.message || "Documento público no encontrado.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (isMobile) setDesktopSidebarOpen(false);
  }, [isMobile]);

  const publicPages = useMemo(() => {
    const pages = Array.isArray(outline) ? outline : [];
    if (!documentData?.id || pages.some((page) => String(page?.id) === String(documentData.id))) {
      return pages;
    }
    return [documentData, ...pages];
  }, [outline, documentData]);
  const treeRoots = useMemo(() => buildTreeNodes(publicPages), [publicPages]);
  const activePage =
    publicPages.find((page) => String(page?.id ?? "") === String(activePageId)) ||
    documentData;
  const rootTitle = String(treeRoots[0]?.title ?? documentData?.title ?? "Documento").trim();
  const showSidebarExpandRail = isMobile ? !mobileDrawerOpen : !desktopSidebarOpen;
  const activePageIdResolved = String(activePageId || activePage?.id || "");

  const handlePickPublicPage = useCallback((pageId) => {
    setActivePageId(String(pageId));
  }, []);

  const sidebarContentProps = {
    publicMode: true,
    readOnly: true,
    documentTitle: rootTitle,
    detail: activePage || documentData,
    detailError: "",
    loadingOutline: loading,
    hasChildPages: treeRoots.length > 0,
    treeRoots,
    pageId: activePageIdResolved,
    onPickPage: handlePickPublicPage,
  };

  return (
    <div className="od-wiki-public-shell">
      <header className="od-wiki-public-topbar">
        <div className="od-wiki-public-brand">
          <img
            src="/favicon.svg"
            alt=""
            aria-hidden="true"
          />
          <span>OrangeFamily</span>
        </div>
      </header>
      <div
        className={`od-wiki-workspace od-wiki-workspace--public${
          isMobile ? " is-mobile-layout" : ""
        }${!isMobile && !desktopSidebarOpen ? " is-desktop-sidebar-hidden" : ""}`}
      >
        {showSidebarExpandRail ? (
          <WikiSidebarExpandTab
            ariaLabel={isMobile ? "Abrir páginas del documento" : "Mostrar panel de páginas"}
            onClick={() => {
              if (isMobile) setMobileDrawerOpen(true);
              else setDesktopSidebarOpen(true);
            }}
          />
        ) : null}

        <div className="od-wiki-workspace__body">
          {!isMobile && desktopSidebarOpen ? (
            <aside
              className="od-wiki-workspace__sidebar od-wiki-workspace__sidebar--public"
              aria-label="Navegación del documento"
            >
              <WikiDocumentSidebarContent
                {...sidebarContentProps}
                onCollapseSidebar={() => setDesktopSidebarOpen(false)}
              />
            </aside>
          ) : null}

          {isMobile && mobileDrawerOpen ? (
            <button
              type="button"
              className="od-wiki-workspace__mobile-drawer-backdrop"
              aria-label="Cerrar panel de páginas"
              onClick={() => setMobileDrawerOpen(false)}
            />
          ) : null}

          {isMobile ? (
            <aside
              className={`od-wiki-workspace__mobile-drawer${mobileDrawerOpen ? " is-open" : ""}`}
              aria-label="Navegación del documento"
              aria-hidden={mobileDrawerOpen ? "false" : "true"}
            >
              <div className="od-wiki-workspace__mobile-drawer-header">
                <span className="od-wiki-workspace__mobile-drawer-title">Páginas</span>
                <button
                  type="button"
                  className="od-wiki-workspace__mobile-drawer-close"
                  aria-label="Cerrar panel de páginas"
                  onClick={() => setMobileDrawerOpen(false)}
                >
                  ×
                </button>
              </div>
              <WikiDocumentSidebarContent
                {...sidebarContentProps}
                onPickPage={(pageId) => {
                  handlePickPublicPage(pageId);
                  setMobileDrawerOpen(false);
                }}
              />
            </aside>
          ) : null}

          <article className="od-wiki-workspace__canvas od-wiki-workspace__canvas--public">
            {loading ? (
              <p className="od-wiki-workspace__canvas-status">Cargando documento…</p>
            ) : error ? (
              <div className="od-wiki-workspace__error">
                <p className="od-status-line od-status-line--error">{error}</p>
              </div>
            ) : activePage ? (
              <div className="od-wiki-workspace__canvas-inner">
                <h1 className="od-wiki-workspace__page-title od-wiki-public-title">
                  {displayCell(activePage.title)}
                </h1>
                <div className="od-wiki-workspace__editor">
                  <WikiTiptapEditor
                    key={activePage.id}
                    pageKey={String(activePage.id)}
                    contentJson={hydrateJsonAttachmentSrc(
                      activePage.content_json,
                      documentData?._attachment_urls || {}
                    )}
                    contentHtml={hydrateHtmlAttachmentSrc(
                      activePage.content_html,
                      documentData?._attachment_urls || {}
                    )}
                    disabled
                    onSave={() => {}}
                  />
                </div>
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </div>
  );
}

export default function WikiPage() {
  const pageIdRaw = useWikiPageIdFromUrl();
  const pageId = isWikiUuid(pageIdRaw) ? pageIdRaw : "";

  if (!pageIdRaw) {
    return <WikiLibrary />;
  }

  if (!pageId) {
    return (
      <div className="od-page">
        <div className="od-page-inner od-page-inner--full">
          <p className="od-status-line od-status-line--error">
            La URL no contiene un identificador de documento válido.
          </p>
          <IonButton size="small" fill="outline" type="button" onClick={() => spaNavigate("/app/wiki")}>
            Volver a la biblioteca
          </IonButton>
        </div>
      </div>
    );
  }

  return <WikiDocumentWorkspace pageId={pageId} />;
}
