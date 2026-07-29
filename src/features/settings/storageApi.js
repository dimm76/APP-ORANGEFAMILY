async function request(path) {
  const response = await fetch(path, {
    credentials: "include",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message || "No se pudo obtener el uso de almacenamiento."
    );
  }

  return data;
}

export function getStorageUsage() {
  return request("/api/settings/storage-usage");
}
