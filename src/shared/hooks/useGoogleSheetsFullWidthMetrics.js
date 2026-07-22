import { useLayoutEffect } from "react";

const DEFAULT_BREAKOUT_SELECTOR = ".od-gsheets-embed__breakout";

const WIDE_TARGET_SELECTORS = [
  ".od-wiki-workspace__canvas",
  ".od-task-modal-block",
  ".od-rich-text-editor__content-wrap",
];

const METRIC_EPSILON = 0.5;

/**
 * @param {{ width: number, marginLeft: number, marginRight: number } | null} a
 * @param {{ width: number, marginLeft: number, marginRight: number } | null} b
 */
function metricsEqual(a, b) {
  if (!a || !b) return false;

  return (
    Math.abs(a.width - b.width) < METRIC_EPSILON &&
    Math.abs(a.marginLeft - b.marginLeft) < METRIC_EPSILON &&
    Math.abs(a.marginRight - b.marginRight) < METRIC_EPSILON
  );
}

/**
 * @param {HTMLElement} target
 */
function getTargetContentRect(target) {
  const rect = target.getBoundingClientRect();
  const styles = getComputedStyle(target);
  const padLeft = parseFloat(styles.paddingLeft) || 0;
  const padRight = parseFloat(styles.paddingRight) || 0;
  const contentLeft = rect.left + padLeft;
  const contentRight = rect.right - padRight;

  return {
    left: contentLeft,
    right: contentRight,
    width: contentRight - contentLeft,
  };
}

/**
 * @param {HTMLElement} breakout
 * @param {{ width: number, marginLeft: number, marginRight: number } | null} metrics
 * @param {string} cssVarPrefix
 */
function applyMetrics(breakout, metrics, cssVarPrefix) {
  const widthVar = `${cssVarPrefix}-full-width`;
  const marginLeftVar = `${cssVarPrefix}-full-margin-left`;
  const marginRightVar = `${cssVarPrefix}-full-margin-right`;

  if (!metrics) {
    breakout.style.removeProperty(widthVar);
    breakout.style.removeProperty(marginLeftVar);
    breakout.style.removeProperty(marginRightVar);
    return;
  }

  breakout.style.setProperty(widthVar, `${metrics.width}px`);
  breakout.style.setProperty(marginLeftVar, `${metrics.marginLeft}px`);
  breakout.style.setProperty(marginRightVar, `${metrics.marginRight}px`);
}

/**
 * Calcula ancho y margenes para breakout controlado de embeds Tiptap.
 *
 * @param {import("react").RefObject<HTMLElement|null>} rootRef
 * @param {boolean} enabled
 * @param {{ breakoutSelector?: string, cssVarPrefix?: string }} [options]
 */
export function useRichTextEmbedFullWidthMetrics(rootRef, enabled, options = {}) {
  const breakoutSelector = options.breakoutSelector || DEFAULT_BREAKOUT_SELECTOR;
  const cssVarPrefix = options.cssVarPrefix || "--od-gsheets";

  useLayoutEffect(() => {
    const root = rootRef.current;

    if (!enabled) {
      const breakout = root?.querySelector(breakoutSelector);
      if (breakout) applyMetrics(breakout, null, cssVarPrefix);
      return undefined;
    }

    let target = null;
    let lastMetrics = null;
    let rafId = 0;
    const observedNodes = new Set();

    function findTarget(currentRoot) {
      for (const selector of WIDE_TARGET_SELECTORS) {
        const found = currentRoot.closest(selector);
        if (found) return found;
      }
      return null;
    }

    function getBreakout() {
      return rootRef.current?.querySelector(breakoutSelector) ?? null;
    }

    function computeMetrics(currentRoot) {
      if (!currentRoot.isConnected) return lastMetrics;

      if (!target?.isConnected) {
        target = findTarget(currentRoot);
      }

      if (!target) return lastMetrics;

      const rootRect = currentRoot.getBoundingClientRect();
      const content = getTargetContentRect(target);

      return {
        width: content.width,
        marginLeft: content.left - rootRect.left,
        marginRight: rootRect.right - content.right,
      };
    }

    function commit() {
      rafId = 0;

      const currentRoot = rootRef.current;
      const breakout = getBreakout();

      if (!currentRoot || !breakout) return;

      const next = computeMetrics(currentRoot);
      if (!next) return;

      if (metricsEqual(next, lastMetrics)) return;

      lastMetrics = next;
      applyMetrics(breakout, next, cssVarPrefix);
    }

    function schedule() {
      if (rafId) return;
      rafId = requestAnimationFrame(commit);
    }

    function observeNode(resizeObserver, node) {
      if (!node || observedNodes.has(node)) return;
      observedNodes.add(node);
      resizeObserver.observe(node);
    }

    if (!root) return undefined;

    target = findTarget(root);
    commit();

    const resizeObserver = new ResizeObserver(schedule);
    if (target) observeNode(resizeObserver, target);

    window.addEventListener("resize", schedule);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", schedule);
      observedNodes.clear();

      const breakout = getBreakout();
      if (breakout?.isConnected) applyMetrics(breakout, null, cssVarPrefix);
    };
  }, [enabled, rootRef, breakoutSelector, cssVarPrefix]);
}

/**
 * Compatibilidad con el nodo existente de Google Sheets.
 *
 * @param {import("react").RefObject<HTMLElement|null>} rootRef
 * @param {boolean} enabled
 */
export function useGoogleSheetsFullWidthMetrics(rootRef, enabled) {
  useRichTextEmbedFullWidthMetrics(rootRef, enabled, {
    breakoutSelector: ".od-gsheets-embed__breakout",
    cssVarPrefix: "--od-gsheets",
  });
}
