const nodemailer = require("nodemailer");

function smtpConfig() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USER || "").trim();
  const password = String(process.env.SMTP_PASSWORD || "");
  const from = String(process.env.MAIL_FROM || "").trim();
  const publicUrl = String(process.env.APP_PUBLIC_URL || "").trim().replace(/\/$/, "");
  if (!host || !port || !user || !password || !from || !publicUrl) return null;
  return { host, port, secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true", auth: { user, pass: password }, from, publicUrl };
}

function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); }
function absolutePublicUrl(pathname) { const config = smtpConfig(); if (!config) return null; const path = String(pathname || "").startsWith("/") ? String(pathname) : `/${String(pathname || "")}`; return `${config.publicUrl}${path}`; }

async function sendMail({ to, displayName, url, subject, action, intro = "" }) {
  const config = smtpConfig();
  if (!config) { if (process.env.NODE_ENV === "production") throw new Error("SMTP no configurado"); console.info(`Correo ${action} omitido: SMTP no configurado.`); return { sent: false, omitted: true }; }
  const greeting = displayName ? `Hola ${displayName},` : "Hola,";
  const safeUrl = escapeHtml(url);
  const safeGreeting = escapeHtml(greeting);
  const safeIntro = intro ? `<p>${escapeHtml(intro)}</p>` : "";
  await nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: config.auth }).sendMail({ from: config.from, to, subject, text: `${greeting}\n\n${intro ? `${intro}\n\n` : ""}${action}: ${url}\n\nSi no esperabas este mensaje, puedes ignorarlo.`, html: `<p>${safeGreeting}</p>${safeIntro}<p><a href="${safeUrl}">${escapeHtml(action)}</a></p><p>Si no esperabas este mensaje, puedes ignorarlo.</p>` });
  return { sent: true, omitted: false };
}

function sendActivationEmail({ to, displayName, token, returnTo = "" }) { const query = new URLSearchParams({ token }); if (returnTo) query.set("returnTo", returnTo); return sendMail({ to, displayName, url: absolutePublicUrl(`/activate?${query.toString()}`), subject: "Activa tu cuenta de OrangeFamily", action: "Activar mi cuenta", intro: returnTo ? "Después podrás acceder al álbum que han compartido contigo." : "" }); }
function sendPasswordResetEmail({ to, displayName, token }) { return sendMail({ to, displayName, url: absolutePublicUrl(`/reset-password?token=${encodeURIComponent(token)}`), subject: "Restablece tu contraseña de OrangeFamily", action: "Restablecer mi contraseña" }); }
function sendAlbumGuestInvitationEmail({ to, displayName, ownerDisplayName, albumTitle, invitationPath }) { const url = absolutePublicUrl(invitationPath); return sendMail({ to, displayName, url, subject: "Te han invitado a un álbum en OrangeFamily", action: "Ver invitación", intro: `${ownerDisplayName} te ha invitado a ver el álbum “${albumTitle}” en OrangeFamily.\n\nLa invitación caduca en 7 días.` }); }

module.exports = { sendActivationEmail, sendPasswordResetEmail, sendAlbumGuestInvitationEmail };
