const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function buildUrl(pathname) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${API_BASE_URL}${path}`;
}

/**
 * @param {File|Blob} file
 * @returns {Promise<{ id: string, mime_type: string, width: number|null, height: number|null, size_bytes: number, signed_url: string }>}
 */
export async function uploadAttachmentImage(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(buildUrl("/api/attachments/upload"), {
    method: "POST",
    body: fd,
    credentials: "include",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data && typeof data.message === "string" && data.message.trim()
        ? data.message.trim()
        : "No se pudo subir la imagen.";
    throw new Error(message);
  }
  return data;
}

export const uploadAttachment = uploadAttachmentImage;

/**
 * @param {string} attachmentId
 */
export async function fetchAttachmentSignedUrl(attachmentId) {
  const id = encodeURIComponent(String(attachmentId ?? "").trim());
  const res = await fetch(buildUrl(`/api/attachments/${id}/signed-url`), {
    credentials: "include",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.signed_url) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "No se pudo obtener la URL de la imagen."
    );
  }
  return String(data.signed_url);
}

/**
 * @param {string[]} ids
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchSignedUrlsForAttachmentIds(ids) {
  const unique = [...new Set(ids.map((x) => String(x ?? "").trim()).filter(Boolean))];
  const out = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        out[id] = await fetchAttachmentSignedUrl(id);
      } catch {
        /* omitir ids sin URL */
      }
    })
  );
  return out;
}

/**
 * @param {URLSearchParams | Record<string, string>} params
 */
export async function fetchAttachmentsList(params = {}) {
  const qp =
    params instanceof URLSearchParams
      ? params
      : new URLSearchParams(params);
  const res = await fetch(buildUrl(`/api/attachments?${qp.toString()}`), {
    credentials: "include",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "No se pudo cargar la biblioteca."
    );
  }
  return data;
}

export const fetchAttachments = fetchAttachmentsList;

function normalizeImageAttachment(raw) {
  return {
    id: raw?.id,
    url: raw?.url || raw?.signed_url || "",
    filename: raw?.filename || raw?.original_filename || "imagen",
    mimeType: raw?.mimeType || raw?.mime_type || "",
    sizeBytes: raw?.sizeBytes ?? raw?.size_bytes ?? null,
    width: raw?.width ?? null,
    height: raw?.height ?? null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    alt: raw?.alt ?? raw?.filename ?? raw?.original_filename ?? "",
  };
}

export async function listImageAttachments({
  q = "",
  page = 1,
  limit = 24,
  from = "",
  to = "",
} = {}) {
  const qp = new URLSearchParams();
  const query = String(q ?? "").trim();
  const fromValue = String(from ?? "").trim();
  const toValue = String(to ?? "").trim();

  if (query) qp.set("q", query);
  if (fromValue) qp.set("from", fromValue);
  if (toValue) qp.set("to", toValue);

  qp.set("page", String(page));
  qp.set("limit", String(limit));

  const res = await fetch(buildUrl(`/api/attachments/images?${qp.toString()}`), {
    credentials: "include",
  });

  let data = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "No se pudo cargar la biblioteca de imagenes."
    );
  }

  return {
    items: Array.isArray(data?.items) ? data.items.map(normalizeImageAttachment) : [],
    page: data?.page ?? page,
    limit: data?.limit ?? limit,
    total: data?.total ?? 0,
  };
}

export async function linkAttachmentToEntity({ attachmentId, entityType, entityId, fieldKey }) {
  const id = encodeURIComponent(String(attachmentId ?? "").trim());
  if (!id) throw new Error("attachmentId obligatorio.");
  if (!entityType) throw new Error("entityType obligatorio.");
  if (!entityId) throw new Error("entityId obligatorio.");

  const res = await fetch(buildUrl(`/api/attachments/${id}/link`), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entityType, entityId, fieldKey }),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "No se pudo vincular la imagen."
    );
  }
  return normalizeImageAttachment(data?.attachment || data);
}

/**
 * @param {string} attachmentId
 */
export async function deleteAttachment(attachmentId) {
  const id = encodeURIComponent(String(attachmentId ?? "").trim());
  const res = await fetch(buildUrl(`/api/attachments/${id}`), {
    method: "DELETE",
    credentials: "include",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" && data.message) ||
        "No se pudo eliminar el archivo."
    );
  }
  return data;
}
