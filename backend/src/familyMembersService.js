const pool = require("../db");
const { createPasswordResetForUser, createSecureToken, hashToken } = require("./auth");
const { sendActivationEmail, sendPasswordResetEmail } = require("./mailService");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ok = (payload = {}) => ({ ok: true, payload });
const bad = (status, reason) => ({ ok: false, status, reason });
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function resolveOwner(req) {
  if (!req.user?.id) return bad(401, "No autenticado.");
  const family = Array.isArray(req.user.families) ? req.user.families.find((item) => item?.role === "owner") : null;
  if (!family?.id || !UUID_RE.test(String(family.id))) return bad(403, "Solo el administrador puede realizar esta acción.");
  return { ok: true, userId: String(req.user.id), personId: req.user.person?.id ? String(req.user.person.id) : null, familyId: String(family.id) };
}

function normalizeInput(body, partial = false) {
  const value = body && typeof body === "object" ? body : {};
  const allowed = new Set(["first_name", "last_name", "email", "membership_status", "has_access"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return bad(400, "El formulario contiene campos no permitidos.");
  const result = {};
  if (!partial || Object.hasOwn(value, "first_name")) {
    result.first_name = String(value.first_name || "").trim();
    if (!result.first_name || result.first_name.length > 120) return bad(400, "El nombre es obligatorio y no puede superar 120 caracteres.");
  }
  if (!partial || Object.hasOwn(value, "last_name")) {
    result.last_name = String(value.last_name || "").trim() || null;
    if (result.last_name && result.last_name.length > 160) return bad(400, "Los apellidos no pueden superar 160 caracteres.");
  }
  if (!partial || Object.hasOwn(value, "has_access")) {
    if (typeof value.has_access !== "boolean") return bad(400, "El acceso debe ser verdadero o falso.");
    result.has_access = value.has_access;
  }
  if (!partial || Object.hasOwn(value, "email")) {
    result.email = String(value.email || "").trim().toLowerCase() || null;
    if (result.email && (!emailRe.test(result.email) || result.email.length > 320)) return bad(400, "El email no es válido.");
  }
  if (Object.hasOwn(value, "membership_status")) {
    if (!["active", "inactive"].includes(value.membership_status)) return bad(400, "El estado del familiar no es válido.");
    result.membership_status = value.membership_status;
  }
  if (result.has_access === true && !result.email && !partial) return bad(400, "El email es obligatorio para permitir acceso.");
  return { ok: true, value: result };
}

const selectMembers = `SELECT p.id AS person_id,fm.id AS membership_id,u.id AS auth_user_id,p.first_name,p.last_name,u.email,
  fm.role,fm.status AS membership_status,u.status AS auth_status,COALESCE(u.email_verified,false) AS email_verified,u.last_login_at,
  (u.id IS NOT NULL AND u.status <> 'disabled') AS has_access,(u.password_hash IS NOT NULL) AS has_password
 FROM public.family_memberships fm JOIN public.persons p ON p.id=fm.person_id LEFT JOIN public.auth_users u ON u.person_id=p.id`;
function publicMember(row) { const { has_password: _hasPassword, ...item } = row; return item; }

async function list(req) {
  const owner = resolveOwner(req); if (!owner.ok) return owner;
  const result = await pool.query(`${selectMembers} WHERE fm.family_id=$1::uuid ORDER BY (fm.role='owner') DESC,p.first_name,p.last_name`, [owner.familyId]);
  return ok({ items: result.rows.map(publicMember) });
}

async function audit(queryable, owner, action, entityId, beforeData = null, afterData = null) {
  await queryable.query(`INSERT INTO public.audit_logs(user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,$2,'family_member',$3,$4::jsonb,$5::jsonb)`, [owner.userId, action, entityId, beforeData ? JSON.stringify(beforeData) : null, afterData ? JSON.stringify(afterData) : null]);
}

async function activationToken(queryable, userId) {
  const token = createSecureToken();
  await queryable.query(`UPDATE public.auth_activation_tokens SET used_at=now() WHERE user_id=$1::uuid AND used_at IS NULL`, [userId]);
  await queryable.query(`INSERT INTO public.auth_activation_tokens(user_id,token_hash,expires_at) VALUES($1::uuid,$2,now()+interval '48 hours')`, [userId, hashToken(token)]);
  return token;
}

function dbError(error) {
  if (error?.code === "23505") return bad(409, "Ya existe una cuenta con ese email.");
  return bad(503, "No se pudo completar la operación.");
}

async function create(req, body) {
  const owner = resolveOwner(req); if (!owner.ok) return owner;
  const input = normalizeInput(body); if (!input.ok) return input;
  const client = await pool.connect(); let token = null; let row;
  try {
    await client.query("BEGIN");
    const person = await client.query(`INSERT INTO public.persons(first_name,last_name) VALUES($1,$2) RETURNING id`, [input.value.first_name, input.value.last_name]);
    await client.query(`INSERT INTO public.family_memberships(family_id,person_id,role,status) VALUES($1,$2,'member','active')`, [owner.familyId, person.rows[0].id]);
    if (input.value.has_access) {
      const user = await client.query(`INSERT INTO public.auth_users(person_id,email,status,password_hash,email_verified) VALUES($1,$2,'pending',NULL,false) RETURNING id`, [person.rows[0].id, input.value.email]);
      token = await activationToken(client, user.rows[0].id);
    }
    await audit(client, owner, "family_member_created", person.rows[0].id, null, { first_name: input.value.first_name, last_name: input.value.last_name, email: input.value.email, has_access: input.value.has_access });
    row = (await client.query(`${selectMembers} WHERE fm.family_id=$1 AND p.id=$2`, [owner.familyId, person.rows[0].id])).rows[0];
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); return dbError(error); } finally { client.release(); }
  let invitation_sent = null;
  if (token) {
    try { const sent = await sendActivationEmail({ to: row.email, displayName: [row.first_name, row.last_name].filter(Boolean).join(" "), token }); invitation_sent = sent.sent; await audit(pool, owner, "activation_sent", row.person_id, null, { sent: sent.sent }); }
    catch (error) { invitation_sent = false; console.error("Activation email failed:", error.message); }
  }
  return { ok: true, status: 201, payload: { item: publicMember(row), invitation_sent } };
}

async function getMember(queryable, owner, personId, lock = false) {
  if (!UUID_RE.test(String(personId || ""))) return null;
  return (await queryable.query(`${selectMembers} WHERE fm.family_id=$1 AND p.id=$2 ${lock ? "FOR UPDATE OF fm,p" : ""}`, [owner.familyId, personId])).rows[0] || null;
}

async function update(req, personId, body) {
  const owner = resolveOwner(req); if (!owner.ok) return owner;
  const input = normalizeInput(body, true); if (!input.ok) return input;
  if (!Object.keys(input.value).length) return bad(400, "No hay cambios válidos.");
  const client = await pool.connect(); let token = null; let after;
  try {
    await client.query("BEGIN");
    const before = await getMember(client, owner, personId, true);
    if (!before) { await client.query("ROLLBACK"); return bad(404, "Familiar no encontrado."); }
    if (before.role === "owner" || before.person_id === owner.personId) { await client.query("ROLLBACK"); return bad(403, "No se puede modificar al administrador."); }
    const nextEmail = Object.hasOwn(input.value, "email") ? input.value.email : before.email;
    const nextAccess = Object.hasOwn(input.value, "has_access") ? input.value.has_access : before.has_access;
    if (nextAccess && !nextEmail) { await client.query("ROLLBACK"); return bad(400, "El email es obligatorio para permitir acceso."); }
    await client.query(`UPDATE public.persons SET first_name=COALESCE($2,first_name),last_name=CASE WHEN $3 THEN $4 ELSE last_name END WHERE id=$1`, [personId, input.value.first_name || null, Object.hasOwn(input.value, "last_name"), input.value.last_name || null]);
    if (input.value.membership_status) await client.query(`UPDATE public.family_memberships SET status=$3 WHERE family_id=$1 AND person_id=$2`, [owner.familyId, personId, input.value.membership_status]);
    if (!before.auth_user_id && nextAccess) {
      const user = await client.query(`INSERT INTO public.auth_users(person_id,email,status,password_hash,email_verified) VALUES($1,$2,'pending',NULL,false) RETURNING id`, [personId, nextEmail]);
      token = await activationToken(client, user.rows[0].id);
    } else if (before.auth_user_id) {
      const emailChanged = Object.hasOwn(input.value, "email") && nextEmail !== before.email;
      if (nextAccess === false) {
        await client.query(`UPDATE public.auth_users SET email=COALESCE($2,email),email_verified=CASE WHEN $3 THEN false ELSE email_verified END,status='disabled' WHERE id=$1`, [before.auth_user_id, nextEmail, emailChanged]);
        await client.query(`UPDATE public.auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`, [before.auth_user_id]);
        await client.query(`UPDATE public.auth_password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [before.auth_user_id]);
        await client.query(`UPDATE public.auth_activation_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [before.auth_user_id]);
        if (before.has_access) await audit(client, owner, "family_member_access_disabled", personId);
      } else {
        await client.query(`UPDATE public.auth_users SET email=$2,email_verified=CASE WHEN $3 THEN false ELSE email_verified END,status=CASE WHEN $4 THEN CASE WHEN password_hash IS NULL THEN 'pending' ELSE 'active' END ELSE status END WHERE id=$1`, [before.auth_user_id, nextEmail, emailChanged, !before.has_access]);
        if (emailChanged) await client.query(`UPDATE public.auth_password_reset_tokens SET used_at=now() WHERE user_id=$1 AND used_at IS NULL`, [before.auth_user_id]);
        if (!before.has_access) await audit(client, owner, "family_member_access_enabled", personId);
        if ((!before.has_access && !before.has_password) || (emailChanged && before.auth_status === "pending")) token = await activationToken(client, before.auth_user_id);
      }
    }
    after = await getMember(client, owner, personId);
    await audit(client, owner, "family_member_updated", personId, { first_name: before.first_name, last_name: before.last_name, email: before.email, membership_status: before.membership_status, has_access: before.has_access }, { first_name: after.first_name, last_name: after.last_name, email: after.email, membership_status: after.membership_status, has_access: after.has_access });
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); return dbError(error); } finally { client.release(); }
  let invitation_sent = null;
  if (token) { try { const sent = await sendActivationEmail({ to: after.email, displayName: [after.first_name, after.last_name].filter(Boolean).join(" "), token }); invitation_sent = sent.sent; await audit(pool, owner, "activation_sent", personId, null, { sent: sent.sent }); } catch (error) { invitation_sent = false; console.error("Activation email failed:", error.message); } }
  return ok({ item: publicMember(after), invitation_sent });
}

async function resendInvitation(req, personId) {
  const owner = resolveOwner(req); if (!owner.ok) return owner;
  const member = await getMember(pool, owner, personId);
  if (!member || member.role === "owner") return bad(404, "Familiar no encontrado.");
  if (!member.auth_user_id || member.auth_status !== "pending" || !member.email) return bad(400, "La cuenta no está pendiente de activación.");
  const token = await activationToken(pool, member.auth_user_id);
  try { const sent = await sendActivationEmail({ to: member.email, displayName: [member.first_name, member.last_name].filter(Boolean).join(" "), token }); await audit(pool, owner, "activation_sent", personId, null, { sent: sent.sent }); return ok({ invitation_sent: sent.sent }); }
  catch (error) { console.error("Activation email failed:", error.message); return bad(502, "La invitación no pudo enviarse."); }
}

async function sendPasswordReset(req, personId) {
  const owner = resolveOwner(req); if (!owner.ok) return owner;
  const member = await getMember(pool, owner, personId);
  if (!member || member.role === "owner") return bad(404, "Familiar no encontrado.");
  if (!member.auth_user_id || member.auth_status !== "active" || !member.email) return bad(400, "La cuenta no está activa.");
  const token = await createPasswordResetForUser(pool, member.auth_user_id);
  try { await sendPasswordResetEmail({ to: member.email, displayName: [member.first_name, member.last_name].filter(Boolean).join(" "), token }); } catch (error) { console.error("Password reset email failed:", error.message); }
  await audit(pool, owner, "password_reset_requested", personId);
  return ok({ message: "Si la cuenta puede recuperar su contraseña, recibirá un correo." });
}

module.exports = { resolveOwner, list, create, update, resendInvitation, sendPasswordReset };
