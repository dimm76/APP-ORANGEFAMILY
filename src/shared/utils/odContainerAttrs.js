import { getCorporateColorByKey, resolveCorporateColorKey } from "../ui/odCorporateColors.js";

export const OD_CONTAINER_WIDTH_MODES = Object.freeze(["normal", "wide", "full"]);
export const OD_CONTAINER_BACKGROUND_TYPES = Object.freeze(["none", "color", "image"]);

export const DEFAULT_OD_CONTAINER_ATTRS = Object.freeze({
  widthMode: "normal",
  backgroundType: "none",
  backgroundColorKey: null,
  backgroundImageUrl: null,
  backgroundImageId: null,
  borderEnabled: false,
  borderColorKey: "border-soft",
  borderWidth: 1,
  borderRadius: 8,
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @param {number} [fallback]
 */
export function clampOdContainerPadding(value, fallback = 0) {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(200, Math.max(0, n));
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 */
export function clampOdContainerBorderWidth(value, fallback = 1) {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(0, n));
}

/**
 * @param {unknown} value
 * @param {number} [fallback]
 */
export function clampOdContainerBorderRadius(value, fallback = 0) {
  const n = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

/**
 * @param {unknown} value
 * @returns {"normal"|"wide"|"full"}
 */
export function resolveOdContainerWidthMode(value) {
  const raw = String(value ?? "").trim();
  return OD_CONTAINER_WIDTH_MODES.includes(raw) ? raw : "normal";
}

/**
 * @param {unknown} value
 * @returns {"none"|"color"|"image"}
 */
export function resolveOdContainerBackgroundType(value) {
  const raw = String(value ?? "").trim();
  return OD_CONTAINER_BACKGROUND_TYPES.includes(raw) ? raw : "none";
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeOdContainerImageId(value) {
  const id = String(value ?? "").trim().toLowerCase();
  if (!id || !UUID_RE.test(id)) return null;
  return id;
}

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeOdContainerImageUrl(value) {
  const url = String(value ?? "").trim();
  if (!url || url.length > 2000) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>|null|undefined} attrs
 */
export function resolveOdContainerAttrs(attrs) {
  const source = attrs ?? {};
  const widthMode = resolveOdContainerWidthMode(source.widthMode);
  const backgroundType = resolveOdContainerBackgroundType(source.backgroundType);
  const backgroundColorKey =
    backgroundType === "color"
      ? resolveCorporateColorKey(source.backgroundColorKey, "bg")
      : null;
  const backgroundImageId =
    backgroundType === "image" ? normalizeOdContainerImageId(source.backgroundImageId) : null;
  const backgroundImageUrl =
    backgroundType === "image" && backgroundImageId
      ? normalizeOdContainerImageUrl(source.backgroundImageUrl)
      : null;
  const borderEnabled = source.borderEnabled === true || source.borderEnabled === "true";
  const borderColorKey = borderEnabled
    ? resolveCorporateColorKey(source.borderColorKey, "border-soft")
    : null;

  return {
    widthMode,
    backgroundType,
    backgroundColorKey,
    backgroundImageUrl,
    backgroundImageId,
    borderEnabled,
    borderColorKey,
    borderWidth: clampOdContainerBorderWidth(source.borderWidth, DEFAULT_OD_CONTAINER_ATTRS.borderWidth),
    borderRadius: clampOdContainerBorderRadius(
      source.borderRadius,
      DEFAULT_OD_CONTAINER_ATTRS.borderRadius
    ),
    paddingTop: clampOdContainerPadding(source.paddingTop, DEFAULT_OD_CONTAINER_ATTRS.paddingTop),
    paddingRight: clampOdContainerPadding(
      source.paddingRight,
      DEFAULT_OD_CONTAINER_ATTRS.paddingRight
    ),
    paddingBottom: clampOdContainerPadding(
      source.paddingBottom,
      DEFAULT_OD_CONTAINER_ATTRS.paddingBottom
    ),
    paddingLeft: clampOdContainerPadding(source.paddingLeft, DEFAULT_OD_CONTAINER_ATTRS.paddingLeft),
  };
}

/**
 * @param {"normal"|"wide"|"full"} widthMode
 */
export function buildOdContainerClassName(widthMode) {
  const mode = resolveOdContainerWidthMode(widthMode);
  return `od-tiptap-container od-tiptap-container--${mode}`;
}

/**
 * @param {ReturnType<typeof resolveOdContainerAttrs>} resolved
 * @returns {Record<string, string>}
 */
export function buildOdContainerInnerStyle(resolved) {
  /** @type {Record<string, string>} */
  const style = {
    padding: `${resolved.paddingTop}px ${resolved.paddingRight}px ${resolved.paddingBottom}px ${resolved.paddingLeft}px`,
    borderRadius: `${resolved.borderRadius}px`,
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "100%",
  };

  if (resolved.borderEnabled && resolved.borderWidth > 0) {
    const borderColor = getCorporateColorByKey(resolved.borderColorKey)?.value ?? "#dce3f5";
    style.border = `${resolved.borderWidth}px solid ${borderColor}`;
  } else {
    style.border = "none";
  }

  if (resolved.backgroundType === "color") {
    const bg =
      getCorporateColorByKey(resolved.backgroundColorKey)?.value ??
      getCorporateColorByKey("bg")?.value;

    if (bg) {
      style.backgroundColor = bg;
      style.backgroundImage = "none";
    }
  } else if (resolved.backgroundType === "image" && resolved.backgroundImageUrl) {
    const safeUrl = resolved.backgroundImageUrl.replace(/"/g, "%22");
    style.backgroundImage = `url("${safeUrl}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  }

  return style;
}

/**
 * @param {ReturnType<typeof resolveOdContainerAttrs>} resolved
 */
export function renderOdContainerDataAttributes(resolved) {
  /** @type {Record<string, string>} */
  const attrs = {
    "data-type": "od-container",
    "data-width-mode": resolved.widthMode,
    "data-background-type": resolved.backgroundType,
    "data-border-enabled": resolved.borderEnabled ? "true" : "false",
    "data-border-width": String(resolved.borderWidth),
    "data-border-radius": String(resolved.borderRadius),
    "data-padding-top": String(resolved.paddingTop),
    "data-padding-right": String(resolved.paddingRight),
    "data-padding-bottom": String(resolved.paddingBottom),
    "data-padding-left": String(resolved.paddingLeft),
  };

  if (resolved.backgroundColorKey) {
    attrs["data-background-color-key"] = resolved.backgroundColorKey;
  }
  if (resolved.backgroundImageId) {
    attrs["data-background-image-id"] = resolved.backgroundImageId;
  }
  if (resolved.borderColorKey) {
    attrs["data-border-color-key"] = resolved.borderColorKey;
  }

  return attrs;
}

/**
 * @param {Element} element
 */
export function readOdContainerAttrsFromElement(element) {
  return resolveOdContainerAttrs({
    widthMode: element.getAttribute("data-width-mode"),
    backgroundType: element.getAttribute("data-background-type"),
    backgroundColorKey: element.getAttribute("data-background-color-key"),
    backgroundImageId: element.getAttribute("data-background-image-id"),
    backgroundImageUrl: element.getAttribute("data-background-image-url"),
    borderEnabled: element.getAttribute("data-border-enabled"),
    borderColorKey: element.getAttribute("data-border-color-key"),
    borderWidth: element.getAttribute("data-border-width"),
    borderRadius: element.getAttribute("data-border-radius"),
    paddingTop: element.getAttribute("data-padding-top"),
    paddingRight: element.getAttribute("data-padding-right"),
    paddingBottom: element.getAttribute("data-padding-bottom"),
    paddingLeft: element.getAttribute("data-padding-left"),
  });
}
