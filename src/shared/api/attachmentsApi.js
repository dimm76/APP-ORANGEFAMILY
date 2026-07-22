const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, credentials: "include" });
  let data = null;
  try { data = await response.json(); } catch { /* respuesta inválida */ }
  if (!response.ok) throw new Error(data?.message || "No se pudo completar la petición.");
  return data;
}

export function fetchAttachments(params = {}) {
  const query = new URLSearchParams(params).toString();
  return api(`/api/attachments${query ? `?${query}` : ""}`);
}

export async function fetchAttachmentSignedUrl(id) {
  const data = await api(`/api/attachments/${encodeURIComponent(String(id))}/signed-url`);
  return data.signed_url;
}

export function deleteAttachment(id) {
  return api(`/api/attachments/${encodeURIComponent(String(id))}`, { method: "DELETE" });
}

export function uploadAttachment(file) {
  const body = new FormData();
  body.append("file", file);
  return api("/api/attachments/upload", { method: "POST", body });
}
