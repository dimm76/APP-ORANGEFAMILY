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

async function sendMail({ to, displayName, token, path, subject, action }) {
  const config = smtpConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP no configurado.");
    console.info(`Correo ${action} omitido: SMTP no configurado.`);
    return { sent: false, omitted: true };
  }
  const url = `${config.publicUrl}${path}?token=${encodeURIComponent(token)}`;
  const greeting = displayName ? `Hola ${displayName},` : "Hola,";
  const safeGreeting = greeting.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  await nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: config.auth }).sendMail({
    from: config.from,
    to,
    subject,
    text: `${greeting}\n\n${action}: ${url}\n\nSi no esperabas este mensaje, puedes ignorarlo.`,
    html: `<p>${safeGreeting}</p><p><a href="${url}">${action}</a></p><p>Si no esperabas este mensaje, puedes ignorarlo.</p>`,
  });
  return { sent: true, omitted: false };
}

function sendActivationEmail({ to, displayName, token }) {
  return sendMail({ to, displayName, token, path: "/activate", subject: "Activa tu cuenta de OrangeFamily", action: "Activar mi cuenta" });
}

function sendPasswordResetEmail({ to, displayName, token }) {
  return sendMail({ to, displayName, token, path: "/reset-password", subject: "Restablece tu contraseña de OrangeFamily", action: "Restablecer mi contraseña" });
}

module.exports = { sendActivationEmail, sendPasswordResetEmail };
