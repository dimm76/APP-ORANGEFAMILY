async function request(path, options = {}, authenticated = true) {
  const response = await fetch(path, { ...options, credentials: authenticated ? "include" : "same-origin", headers: options.body ? { "Content-Type": "application/json", ...(options.headers || {}) } : options.headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Error HTTP ${response.status}`);
  return data;
}
function qs(filters) { const p = new URLSearchParams(); Object.entries(filters || {}).forEach(([k, v]) => { if (v !== "" && v != null) p.set(k, String(v)); }); return p.toString(); }
export const fetchWikiPages = (filters = {}) => request(`/api/wiki${qs(filters) ? `?${qs(filters)}` : ""}`);
export const fetchWikiOutline = (filters = {}) => request(`/api/wiki/outline${qs(filters) ? `?${qs(filters)}` : ""}`);
export const fetchWikiPageById = (id) => request(`/api/wiki/${encodeURIComponent(id)}`);
export const createWikiPage = (body) => request("/api/wiki", { method: "POST", body: JSON.stringify(body) });
export const patchWikiPage = (id, body) => request(`/api/wiki/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteWikiPage = (id) => request(`/api/wiki/${encodeURIComponent(id)}`, { method: "DELETE" });
export const duplicateWikiPage = (id) => request(`/api/wiki/${encodeURIComponent(id)}/duplicate`, { method: "POST", body: "{}" });
export const moveWikiPage = (id, body) => request(`/api/wiki/${encodeURIComponent(id)}/move`, { method: "PATCH", body: JSON.stringify(body) });
export const copyWikiRootContentToChild = (id) => request(`/api/wiki/${encodeURIComponent(id)}/copy-root-content`, { method: "POST", body: "{}" });
export const publishWikiPublicLink = (id, body = {}) => request(`/api/wiki/${encodeURIComponent(id)}/public-link`, { method: "POST", body: JSON.stringify(body) });
export const revokeWikiPublicLink = (id) => request(`/api/wiki/${encodeURIComponent(id)}/public-link`, { method: "DELETE" });
export const fetchPublicWikiByToken = (token) => request(`/api/public/wiki/${encodeURIComponent(token)}`, {}, false);
