import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { overlayZIndexForStackDepth } from "../overlay/odModalStack.js";
import RichTextBlockMenu from "./RichTextBlockMenu.jsx";
import {
  getFilteredRichTextBlockMenuGroups,
  getSlashTriggerState,
  wrapBlockMenuGroupsForSlash,
} from "./richTextBlockActions.js";

const SLASH_MENU_WIDTH = 320;
const SLASH_MENU_MAX_HEIGHT = 420;
const SLASH_MENU_MIN_HEIGHT = 120;
const SLASH_VIEWPORT_PAD = 12;
const SLASH_CURSOR_GAP = 6;

function getAppHeaderOffset() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--od-app-header-h").trim();
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 52;
}

function computeSlashMenuLayout(editor) {
  const slash = getSlashTriggerState(editor);
  if (!slash) return null;

  const coords = editor.view.coordsAtPos(slash.to);
  const headerH = getAppHeaderOffset();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const pad = SLASH_VIEWPORT_PAD;

  const spaceBelow = vh - coords.bottom - pad - SLASH_CURSOR_GAP;
  const spaceAbove = coords.top - headerH - pad - SLASH_CURSOR_GAP;
  const openAbove = spaceBelow < 140 && spaceAbove > spaceBelow;

  let maxHeight = Math.max(
    SLASH_MENU_MIN_HEIGHT,
    Math.min(SLASH_MENU_MAX_HEIGHT, openAbove ? spaceAbove : spaceBelow)
  );

  let top = openAbove ? coords.top - SLASH_CURSOR_GAP - maxHeight : coords.bottom + SLASH_CURSOR_GAP;

  if (top + maxHeight > vh - pad) {
    top = Math.max(headerH + pad, vh - pad - maxHeight);
  }
  if (top < headerH + pad) {
    top = headerH + pad;
    maxHeight = Math.max(SLASH_MENU_MIN_HEIGHT, Math.min(maxHeight, vh - pad - top));
  }

  let left = coords.left;
  if (left + SLASH_MENU_WIDTH > vw - pad) left = vw - pad - SLASH_MENU_WIDTH;
  if (left < pad) left = pad;

  return { top, left, maxHeight };
}

/**
 * Comando "/" — menú de bloques anclado al cursor, siempre dentro del viewport.
 * @param {{
 *   editor: import("@tiptap/core").Editor | null,
 *   handlers?: { onPickImage?: () => void },
 *   menuClassName?: string,
 * }} props
 */
export default function RichTextSlashCommandMenu({ editor, handlers, menuClassName = "" }) {
  const panelRef = useRef(null);
  const [, setTick] = useState(0);
  const [layout, setLayout] = useState(null);

  const slash = editor ? getSlashTriggerState(editor) : null;

  const groups = useMemo(() => {
    if (!editor || !slash) return [];
    const filtered = getFilteredRichTextBlockMenuGroups(editor, handlers, slash.query);
    return wrapBlockMenuGroupsForSlash(editor, filtered);
  }, [editor, handlers, slash?.query, slash?.from, slash?.to]);

  useEffect(() => {
    if (!editor) return undefined;
    const refresh = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", refresh);
    editor.on("transaction", refresh);
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => {
      editor.off("selectionUpdate", refresh);
      editor.off("transaction", refresh);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor || !slash) {
      setLayout(null);
      return;
    }
    setLayout(computeSlashMenuLayout(editor));
  }, [editor, slash?.query, slash?.from, slash?.to, groups.length]);

  useLayoutEffect(() => {
    if (!editor || !slash || !panelRef.current || !layout) return;

    const panel = panelRef.current;
    const headerH = getAppHeaderOffset();
    const pad = SLASH_VIEWPORT_PAD;
    const vh = window.innerHeight;
    const rect = panel.getBoundingClientRect();

    if (rect.bottom <= vh - pad && rect.top >= headerH + pad) return;

    let top = layout.top;
    if (rect.bottom > vh - pad) {
      top = Math.max(headerH + pad, vh - pad - rect.height);
    }
    if (top < headerH + pad) {
      top = headerH + pad;
    }

    if (Math.abs(top - layout.top) > 0.5) {
      setLayout((prev) => (prev ? { ...prev, top } : prev));
    }
  }, [editor, slash, layout, groups]);

  if (!editor || !slash || !layout) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="od-rich-text-slash-menu od-rich-text-slash-menu--fixed od-rich-text-block-menu-scroll"
      style={{
        position: "fixed",
        top: `${layout.top}px`,
        left: `${layout.left}px`,
        width: `${SLASH_MENU_WIDTH}px`,
        maxHeight: `${layout.maxHeight}px`,
        zIndex: overlayZIndexForStackDepth(),
      }}
      role="listbox"
      aria-label="Insertar bloque"
    >
      {groups.length ? (
        <RichTextBlockMenu
          groups={groups}
          className={`od-rich-text-block-menu-panel${menuClassName ? ` ${menuClassName}` : ""}`}
          ariaLabel="Insertar bloque"
        />
      ) : (
        <div className="od-rich-text-slash-menu__empty">Sin coincidencias</div>
      )}
    </div>,
    document.body
  );
}
