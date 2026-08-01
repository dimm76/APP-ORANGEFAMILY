async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: options.body
      ? {
          "Content-Type": "application/json",
          ...options.headers,
        }
      : options.headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        "No se pudo completar la operación con la aplicación."
    );
  }

  return data;
}

export function getLatestAndroidRelease() {
  return request("/api/app-releases/android/latest");
}

export function updateLatestAndroidRelease(body) {
  return request("/api/settings/app-releases/android/latest", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
