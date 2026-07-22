export const COLUMN_LAYOUTS_2 = Object.freeze([
  "50-50",
  "60-40",
  "40-60",
  "20-80",
  "80-20",
  "75-25",
  "25-75",
]);

export const COLUMN_LAYOUTS_3 = Object.freeze([
  "33-33-33",
  "20-60-20",
  "60-20-20",
  "20-20-60",
]);

/** @type {Record<string, string>} */
export const COLUMN_LAYOUT_LABELS = Object.freeze({
  "50-50": "50 / 50",
  "60-40": "60 / 40",
  "40-60": "40 / 60",
  "20-80": "20 / 80",
  "80-20": "80 / 20",
  "75-25": "75 / 25",
  "25-75": "25 / 75",
  "33-33-33": "33.33 / 33.33 / 33.33",
  "20-60-20": "20 / 60 / 20",
  "60-20-20": "60 / 20 / 20",
  "20-20-60": "20 / 20 / 60",
});

/**
 * @param {number} columns
 */
export function defaultColumnLayout(columns) {
  return Number(columns) === 3 ? "33-33-33" : "50-50";
}

/**
 * @param {number} columns
 * @param {unknown} layout
 */
export function resolveColumnLayout(columns, layout) {
  const count = Number(columns) === 3 ? 3 : 2;
  const allowed = count === 3 ? COLUMN_LAYOUTS_3 : COLUMN_LAYOUTS_2;
  const raw = String(layout ?? "").trim();
  if (allowed.includes(raw)) return raw;
  return defaultColumnLayout(count);
}

/**
 * @param {number} columns
 * @param {unknown} layout
 */
export function buildOdRichColumnsClassName(columns, layout) {
  const count = Number(columns) === 3 ? 3 : 2;
  const columnLayout = resolveColumnLayout(count, layout);
  return `od-rich-columns od-rich-columns--${count} od-rich-columns--${columnLayout}`;
}

/**
 * @param {Element} element
 */
export function readColumnLayoutFromElement(element) {
  const dataLayout = element.getAttribute?.("data-column-layout");
  if (dataLayout) return dataLayout;
  const cls = String(element.className || "");
  for (const layout of [...COLUMN_LAYOUTS_2, ...COLUMN_LAYOUTS_3]) {
    if (cls.includes(`od-rich-columns--${layout}`)) return layout;
  }
  return null;
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 */
export function getOdRichColumnsContext(editor) {
  if (!editor) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "odRichColumns") {
      return {
        attrs: node.attrs,
        pos: $from.before(depth),
      };
    }
  }
  return null;
}

/**
 * @param {import("@tiptap/core").Editor | null} editor
 */
export function isOdRichColumnsActive(editor) {
  return Boolean(getOdRichColumnsContext(editor));
}

/**
 * @param {number} columns
 * @param {unknown} layout
 */
export function columnLayoutOptions(columns) {
  const count = Number(columns) === 3 ? 3 : 2;
  const layouts = count === 3 ? COLUMN_LAYOUTS_3 : COLUMN_LAYOUTS_2;
  return layouts.map((id) => ({
    id,
    label: COLUMN_LAYOUT_LABELS[id] ?? id,
    title: `Distribución ${COLUMN_LAYOUT_LABELS[id] ?? id}`,
  }));
}
