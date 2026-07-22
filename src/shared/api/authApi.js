async function authRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: options.body
      ? { "Content-Type": "application/json", ...options.headers }
      : options.headers,
  });

  const data = await response.json().catch(() => null);

  return { ok: response.ok, status: response.status, data };
}

/**
 * Sesión actual vía cookie httpOnly (no lanza en 401).
 * @returns {Promise<{ user: object | null }>}
 */
export async function fetchAuthMe() {
  try {
    const { ok, status, data } = await authRequest("/api/auth/me", { method: "GET" });
    if (ok && data && data.ok === true && data.user && typeof data.user === "object") {
      return { user: data.user };
    }
    if (status === 401) return { user: null };
  } catch {
    return { user: null };
  }
  return { user: null };
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ ok?: boolean, user?: object }>}
 */
export async function postAuthLogin(email, password) {
  const normalized = String(email ?? "").trim().toLowerCase();
  const { ok, data } = await authRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: normalized, password }),
  });

  if (!ok) {
    throw new Error(
      data && typeof data.message === "string"
        ? data.message
        : "No se pudo iniciar sesión."
    );
  }

  return data;
}

export async function postAuthLogout() {
  const { data } = await authRequest("/api/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data;
}
