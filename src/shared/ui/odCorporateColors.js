/** Paleta corporativa OrangeDesk (alineada con --od-color-* en index.css). */
export const OD_CORPORATE_COLORS = Object.freeze([
  { key: "primary", label: "Naranja marca", value: "#fc4200" },
  { key: "primary-hover", label: "Naranja hover", value: "#e03a00" },
  { key: "primary-soft", label: "Naranja suave", value: "rgba(252, 66, 0, 0.12)" },
  { key: "text", label: "Texto", value: "#37374b" },
  { key: "text-muted", label: "Texto secundario", value: "#64748b" },
  { key: "text-strong", label: "Texto fuerte", value: "#111229" },
  { key: "border", label: "Borde", value: "#e4e4e8" },
  { key: "border-soft", label: "Borde suave", value: "#dce3f5" },
  { key: "bg", label: "Fondo app", value: "#f4f5f7" },
  { key: "surface", label: "Superficie", value: "#ffffff" },
  { key: "danger", label: "Peligro", value: "#c62828" },
  { key: "success", label: "Éxito", value: "#15803d" },
]);

const COLOR_BY_KEY = new Map(OD_CORPORATE_COLORS.map((item) => [item.key, item]));

/**
 * @param {string|null|undefined} key
 * @returns {(typeof OD_CORPORATE_COLORS)[number]|null}
 */
export function getCorporateColorByKey(key) {
  const normalized = String(key ?? "").trim();
  if (!normalized) return null;
  return COLOR_BY_KEY.get(normalized) ?? null;
}

/**
 * @param {string|null|undefined} key
 * @param {string} [fallbackKey]
 * @returns {string|null}
 */
export function resolveCorporateColorKey(key, fallbackKey = "border-soft") {
  const normalized = String(key ?? "").trim();
  if (normalized && COLOR_BY_KEY.has(normalized)) return normalized;
  const fallback = String(fallbackKey ?? "").trim();
  if (fallback && COLOR_BY_KEY.has(fallback)) return fallback;
  return null;
}
