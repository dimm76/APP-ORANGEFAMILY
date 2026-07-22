const UUID_RE =
  /data-(?:attachment-id|background-image-id)=["']([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})["']/gi;

/**
 * @param {string} html
 * @returns {string[]}
 */
export function extractAttachmentIdsFromHtml(html) {
  const out = new Set();
  const s = String(html ?? "");
  if (!s) return [];
  let m;
  while ((m = UUID_RE.exec(s)) !== null) {
    out.add(m[1].toLowerCase());
  }
  UUID_RE.lastIndex = 0;
  return [...out];
}

/**
 * @param {unknown} doc
 * @param {Set<string>} out
 */
function walkDocJson(doc, out) {
  if (doc == null || typeof doc !== "object") return;
  if (Array.isArray(doc)) {
    for (const item of doc) walkDocJson(item, out);
    return;
  }
  const attrs = doc.attrs;
  if (attrs?.attachmentId) {
    out.add(String(attrs.attachmentId).trim().toLowerCase());
  }
  if (attrs?.backgroundImageId) {
    out.add(String(attrs.backgroundImageId).trim().toLowerCase());
  }
  if (Array.isArray(doc.content)) {
    for (const child of doc.content) walkDocJson(child, out);
  }
}

/**
 * @param {unknown} contentJson
 * @returns {string[]}
 */
export function extractAttachmentIdsFromJson(contentJson) {
  const out = new Set();
  walkDocJson(contentJson, out);
  return [...out];
}

/**
 * @param {string} html
 * @param {Record<string, string>} urlById
 */
export function hydrateHtmlAttachmentSrc(html, urlById) {
  const raw = String(html ?? "");
  if (!raw || !urlById || typeof urlById !== "object") return raw;
  if (typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return raw;
  }
  try {
    const parser = new window.DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    const root = doc.body;
    if (!root) return raw;
    root.querySelectorAll("img[data-attachment-id]").forEach((img) => {
      const id = String(img.getAttribute("data-attachment-id") ?? "").trim().toLowerCase();
      const url = urlById[id];
      if (url) img.setAttribute("src", url);
    });
    root.querySelectorAll('div[data-type="od-container"][data-background-image-id]').forEach((el) => {
      const id = String(el.getAttribute("data-background-image-id") ?? "").trim().toLowerCase();
      const url = urlById[id];
      if (url) el.setAttribute("data-background-image-url", url);
    });
    return root.innerHTML;
  } catch {
    return raw;
  }
}

/**
 * @param {unknown} contentJson
 * @param {Record<string, string>} urlById
 */
export function hydrateJsonAttachmentSrc(contentJson, urlById) {
  if (contentJson == null || typeof contentJson !== "object") return contentJson;
  const clone = JSON.parse(JSON.stringify(contentJson));
  function walk(node) {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node.type === "image" && node.attrs?.attachmentId) {
      const id = String(node.attrs.attachmentId).trim().toLowerCase();
      const url = urlById[id];
      if (url) node.attrs.src = url;
    }
    if (node.type === "odContainer" && node.attrs?.backgroundImageId) {
      const id = String(node.attrs.backgroundImageId).trim().toLowerCase();
      const url = urlById[id];
      if (url) node.attrs.backgroundImageUrl = url;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  }
  walk(clone);
  return clone;
}

/**
 * Quita src temporal de imágenes con attachmentId antes de persistir HTML.
 * @param {string} html
 */
export function stripAttachmentSrcFromHtml(html) {
  const raw = String(html ?? "");
  if (!raw || typeof window === "undefined" || typeof window.DOMParser === "undefined") {
    return raw;
  }
  try {
    const doc = new window.DOMParser().parseFromString(raw, "text/html");
    const root = doc.body;
    if (!root) return raw;
    root.querySelectorAll("img[data-attachment-id]").forEach((img) => {
      img.removeAttribute("src");
      if (img.getAttribute("srcset")) img.removeAttribute("srcset");
    });
    root.querySelectorAll('div[data-type="od-container"]').forEach((el) => {
      el.removeAttribute("data-background-image-url");
    });
    return root.innerHTML;
  } catch {
    return raw;
  }
}

/**
 * @param {unknown} contentJson
 */
export function stripAttachmentSrcFromJson(contentJson) {
  if (contentJson == null || typeof contentJson !== "object") return contentJson;
  const clone = JSON.parse(JSON.stringify(contentJson));
  function walk(node) {
    if (node == null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node.type === "image" && node.attrs?.attachmentId) {
      delete node.attrs.src;
    }
    if (node.type === "odContainer" && node.attrs?.backgroundImageId) {
      delete node.attrs.backgroundImageUrl;
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  }
  walk(clone);
  return clone;
}
