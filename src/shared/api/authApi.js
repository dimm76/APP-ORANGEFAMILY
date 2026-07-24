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

async function publicAuthPost(path, body) {
  const { ok, data } = await authRequest(path, { method: "POST", body: JSON.stringify(body) });
  if (!ok) throw new Error(data?.message || "No se pudo completar la operación.");
  return data;
}

export const postForgotPassword = (email) => publicAuthPost("/api/auth/forgot-password", { email: String(email || "").trim().toLowerCase() });
export const postActivate = (token, password) => publicAuthPost("/api/auth/activate", { token, password });
export const postResetPassword = (token, password) => publicAuthPost("/api/auth/reset-password", { token, password });
