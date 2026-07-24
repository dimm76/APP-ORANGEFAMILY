const { createHash, randomBytes } = require("node:crypto");
const { isIP } = require("node:net");
const pool = require("../db");
const { hashPassword, verifyPassword } = require("./passwordCrypto");
const { sendPasswordResetEmail } = require("./mailService");

const SESSION_COOKIE_NAME = "of_session";
const MAX_FAILED_LOGINS = 8;
const LOCK_MINUTES = 15;
const SESSION_DEFAULT_MS = 14 * 24 * 60 * 60 * 1000;

function sessionMaxAgeMs() {
  const raw = String(process.env.SESSION_MAX_AGE_MS || "").trim();
  if (!raw) return SESSION_DEFAULT_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 60_000) return SESSION_DEFAULT_MS;
  return Math.min(value, 365 * 24 * 60 * 60 * 1000);
}

function cookieSecure() {
  const configured = String(process.env.SESSION_COOKIE_SECURE || "").trim().toLowerCase();
  return configured === "true" || (!configured && process.env.NODE_ENV === "production");
}

function hashSessionToken(token) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function createSecureToken() {
  return randomBytes(32).toString("base64url");
}

function parseCookieHeader(req) {
  const raw = req.headers.cookie;
  if (typeof raw !== "string" || !raw.trim()) return {};

  const cookies = {};
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (!name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function buildSessionCookie(token, expiresAt) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}`,
  ];
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

function buildClearSessionCookie() {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    `Expires=${new Date(0).toUTCString()}`,
  ];
  if (cookieSecure()) parts.push("Secure");
  return parts.join("; ");
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const address = forwarded.split(",")[0].trim();
    return isIP(address) ? address : null;
  }
  const address = req.socket && req.socket.remoteAddress
    ? String(req.socket.remoteAddress)
    : "";
  return isIP(address) ? address : null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function insertAuditLog(queryable, userId, action, req) {
  const userAgent = typeof req.headers["user-agent"] === "string"
    ? req.headers["user-agent"]
    : null;
  const ipAddress = clientIp(req);

  try {
    await queryable.query(
      `INSERT INTO public.audit_logs (user_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3::inet, $4)`,
      [userId, action, ipAddress, userAgent]
    );
  } catch {
    // La auditoría no debe revelar ni sustituir el resultado de autenticación.
  }
}

function mapUser(row, memberships = []) {
  const displayName = row.preferred_name
    || [row.first_name, row.last_name].filter(Boolean).join(" ")
    || null;

  return {
    id: String(row.user_id),
    email: String(row.email),
    status: String(row.auth_status),
    person: row.person_id ? {
      id: String(row.person_id),
      first_name: String(row.first_name),
      last_name: row.last_name == null ? null : String(row.last_name),
      preferred_name: row.preferred_name == null ? null : String(row.preferred_name),
      display_name: displayName,
    } : null,
    families: memberships.map((membership) => ({
      id: String(membership.family_id),
      name: String(membership.family_name),
      role: String(membership.role),
    })),
  };
}

async function loadUserMemberships(queryable, personId) {
  if (!personId) return [];
  const result = await queryable.query(
    `SELECT f.id AS family_id, f.name AS family_name, fm.role
     FROM public.family_memberships fm
     INNER JOIN public.families f ON f.id = fm.family_id
     WHERE fm.person_id = $1::uuid
       AND fm.status = 'active'
       AND f.status = 'active'
     ORDER BY f.created_at, f.id`,
    [personId]
  );
  return result.rows;
}

async function attachAuthToRequest(req, _res, next) {
  req.user = null;
  const token = parseCookieHeader(req)[SESSION_COOKIE_NAME];
  if (!token || typeof token !== "string" || !token.trim()) return next();

  try {
    const result = await pool.query(
      `SELECT u.id AS user_id, u.email, u.status AS auth_status, u.locked_until,
              u.person_id, s.id AS session_id, s.expires_at, s.revoked_at,
              p.first_name, p.last_name, p.preferred_name
       FROM public.auth_sessions s
       INNER JOIN public.auth_users u ON u.id = s.user_id
       LEFT JOIN public.persons p ON p.id = u.person_id
       WHERE s.token_hash = $1
       LIMIT 1`,
      [hashSessionToken(token.trim())]
    );
    const row = result.rows[0];
    const expiresAt = row && row.expires_at ? new Date(row.expires_at).getTime() : 0;
    const lockedUntil = row && row.locked_until ? new Date(row.locked_until).getTime() : 0;
    if (!row || row.revoked_at || expiresAt <= Date.now()
      || row.auth_status !== "active" || lockedUntil > Date.now()) {
      return next();
    }

    const memberships = await loadUserMemberships(pool, row.person_id);
    req.user = { ...mapUser(row, memberships), _sessionId: String(row.session_id) };
  } catch {
    req.user = null;
  }
  return next();
}

function toPublicUser(user) {
  const { _sessionId, ...publicUser } = user;
  return publicUser;
}

function requireAuthUser(req) {
  if (!req.user || !req.user.id) {
    return { ok: false, status: 401, body: { ok: false, message: "No autenticado." } };
  }
  return { ok: true };
}

async function handleAuthLogin(req) {
  const email = normalizeEmail(req.body && req.body.email);
  const password = req.body && typeof req.body.password === "string" ? req.body.password : "";
  if (!email || !email.includes("@") || !password) {
    return { status: 400, body: { ok: false, message: "Email y contraseña son obligatorios." } };
  }

  const genericFailure = { status: 401, body: { ok: false, message: "Credenciales incorrectas." } };
  let row;
  try {
    const result = await pool.query(
      `SELECT id, person_id, email, password_hash, status, locked_until, failed_login_count
       FROM public.auth_users
       WHERE lower(btrim(email)) = $1
       LIMIT 1`,
      [email]
    );
    row = result.rows[0];
  } catch {
    return { status: 503, body: { ok: false, message: "Servicio no disponible." } };
  }

  if (!row) {
    await insertAuditLog(pool, null, "login_failed", req);
    return genericFailure;
  }

  const userId = String(row.id);
  const lockedUntil = row.locked_until ? new Date(row.locked_until).getTime() : 0;
  if (lockedUntil > Date.now() || !["active", "locked"].includes(String(row.status))) {
    await insertAuditLog(pool, userId, "login_failed", req);
    return genericFailure;
  }

  if (!row.password_hash || !verifyPassword(password, String(row.password_hash))) {
    try {
      const result = await pool.query(
        `UPDATE public.auth_users
         SET failed_login_count = failed_login_count + 1,
             locked_until = CASE
               WHEN failed_login_count + 1 >= $2 THEN now() + ($3::int * interval '1 minute')
               ELSE locked_until
             END,
             status = CASE WHEN failed_login_count + 1 >= $2 THEN 'locked' ELSE status END
         WHERE id = $1::uuid`,
        [userId, MAX_FAILED_LOGINS, LOCK_MINUTES]
      );
    } catch {
      // Se mantiene una respuesta genérica para no exponer errores internos.
    }
    await insertAuditLog(pool, userId, "login_failed", req);
    return genericFailure;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeMs());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE public.auth_users
       SET failed_login_count = 0, locked_until = NULL, status = 'active', last_login_at = now()
       WHERE id = $1::uuid`,
      [userId]
    );
    await client.query(
      `INSERT INTO public.auth_sessions
        (user_id, token_hash, ip_address, user_agent, expires_at)
       VALUES ($1::uuid, $2, $3::inet, $4, $5)`,
      [userId, hashSessionToken(token), clientIp(req), req.headers["user-agent"] || null, expiresAt]
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { status: 503, body: { ok: false, message: "No se pudo crear la sesión." } };
  } finally {
    client.release();
  }

  await insertAuditLog(pool, userId, "login_success", req);
  try {
    const identity = await pool.query(
      `SELECT u.id AS user_id, u.email, u.status AS auth_status, u.person_id,
              p.first_name, p.last_name, p.preferred_name
       FROM public.auth_users u
       LEFT JOIN public.persons p ON p.id = u.person_id
       WHERE u.id = $1::uuid`,
      [userId]
    );
    const userRow = identity.rows[0];
    const memberships = await loadUserMemberships(pool, userRow.person_id);
    return {
      status: 200,
      body: { ok: true, user: mapUser(userRow, memberships) },
      setCookie: buildSessionCookie(token, expiresAt),
    };
  } catch {
    return { status: 503, body: { ok: false, message: "Servicio no disponible." } };
  }
}

async function handleAuthLogout(req) {
  const token = parseCookieHeader(req)[SESSION_COOKIE_NAME];
  if (token && typeof token === "string" && token.trim()) {
    try {
      const result = await pool.query(
        `UPDATE public.auth_sessions
         SET revoked_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL
         RETURNING user_id`,
        [hashSessionToken(token.trim())]
      );
      if (result.rows[0]) {
        await insertAuditLog(pool, String(result.rows[0].user_id), "logout", req);
      }
    } catch {
      // La cookie se elimina incluso si la sesión ya no está disponible.
    }
  }
  return { status: 200, body: { ok: true }, setCookie: buildClearSessionCookie() };
}

async function handleAuthMe(req) {
  const check = requireAuthUser(req);
  if (!check.ok) return { status: check.status, body: check.body };
  return { status: 200, body: { ok: true, user: toPublicUser(req.user) } };
}

function validNewPassword(value) {
  return typeof value === "string" && value.length >= 10;
}

async function handleAuthActivate(req) {
  const token = req.body && typeof req.body.token === "string" ? req.body.token.trim() : "";
  const password = req.body && req.body.password;
  if (!token || !validNewPassword(password)) return { status: 400, body: { ok: false, message: "Token y contraseña de al menos 10 caracteres son obligatorios." } };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT t.id, t.user_id FROM public.auth_activation_tokens t
       INNER JOIN public.auth_users u ON u.id=t.user_id
       WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() AND u.status='pending'
       FOR UPDATE`,
      [hashSessionToken(token)]
    );
    const row = found.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { status: 400, body: { ok: false, message: "El enlace de activación no es válido o ha caducado." } }; }
    await client.query(`UPDATE public.auth_users SET password_hash=$2,status='active',email_verified=true,failed_login_count=0,locked_until=NULL WHERE id=$1`, [row.user_id, hashPassword(password)]);
    await client.query(`UPDATE public.auth_activation_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [row.user_id]);
    await client.query("COMMIT");
    return { status: 200, body: { ok: true } };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { status: 503, body: { ok: false, message: "No se pudo activar la cuenta." } };
  } finally { client.release(); }
}

async function createPasswordResetForUser(queryable, userId) {
  const token = createSecureToken();
  await queryable.query(`UPDATE public.auth_password_reset_tokens SET used_at=now() WHERE user_id=$1::uuid AND used_at IS NULL`, [userId]);
  await queryable.query(`INSERT INTO public.auth_password_reset_tokens(user_id,token_hash,expires_at) VALUES($1::uuid,$2,now()+interval '60 minutes')`, [userId, hashSessionToken(token)]);
  return token;
}

async function handleAuthForgotPassword(req) {
  const generic = { status: 200, body: { ok: true, message: "Si existe una cuenta asociada, recibirás un correo." } };
  const email = normalizeEmail(req.body && req.body.email);
  if (!email) return generic;
  try {
    const found = await pool.query(`SELECT u.id,u.email,p.first_name,p.last_name FROM public.auth_users u LEFT JOIN public.persons p ON p.id=u.person_id WHERE lower(btrim(u.email))=$1 AND u.status='active' AND u.password_hash IS NOT NULL LIMIT 1`, [email]);
    const user = found.rows[0];
    if (!user) return generic;
    const token = await createPasswordResetForUser(pool, user.id);
    await insertAuditLog(pool, user.id, "password_reset_requested", req);
    await sendPasswordResetEmail({ to: user.email, displayName: [user.first_name, user.last_name].filter(Boolean).join(" "), token });
  } catch (error) {
    console.error("Password reset email failed:", error.message);
  }
  return generic;
}

async function handleAuthResetPassword(req) {
  const token = req.body && typeof req.body.token === "string" ? req.body.token.trim() : "";
  const password = req.body && req.body.password;
  if (!token || !validNewPassword(password)) return { status: 400, body: { ok: false, message: "Token y contraseña de al menos 10 caracteres son obligatorios." } };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(`SELECT t.id,t.user_id FROM public.auth_password_reset_tokens t INNER JOIN public.auth_users u ON u.id=t.user_id WHERE t.token_hash=$1 AND t.used_at IS NULL AND t.expires_at>now() AND u.status='active' FOR UPDATE OF t,u`, [hashSessionToken(token)]);
    const row = found.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { status: 400, body: { ok: false, message: "El enlace de recuperación no es válido o ha caducado." } }; }
    await client.query(`UPDATE public.auth_users SET password_hash=$2,status='active',failed_login_count=0,locked_until=NULL WHERE id=$1`, [row.user_id, hashPassword(password)]);
    await client.query(`UPDATE public.auth_password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [row.user_id]);
    await client.query(`UPDATE public.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [row.user_id]);
    await client.query(`INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id) VALUES($1,'password_reset_completed','auth_user',$1)`, [row.user_id]);
    await client.query("COMMIT");
    return { status: 200, body: { ok: true } };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { status: 503, body: { ok: false, message: "No se pudo actualizar la contraseña." } };
  } finally { client.release(); }
}

module.exports = {
  SESSION_COOKIE_NAME,
  attachAuthToRequest,
  handleAuthLogin,
  handleAuthLogout,
  handleAuthMe,
  handleAuthActivate,
  handleAuthForgotPassword,
  handleAuthResetPassword,
  createPasswordResetForUser,
  createSecureToken,
  hashToken: hashSessionToken,
};
