const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailerPath = require.resolve("nodemailer");
const original = require.cache[nodemailerPath];
let message;
require.cache[nodemailerPath] = { id: nodemailerPath, filename: nodemailerPath, loaded: true, exports: { createTransport: () => ({ sendMail: async value => { message = value; } }) } };
const mail = require("../src/mailService.js");
if (original) require.cache[nodemailerPath] = original; else delete require.cache[nodemailerPath];

test("album invitation email includes absolute URL and escapes HTML", async () => {
  Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_PORT: "25", SMTP_USER: "user", SMTP_PASSWORD: "pass", MAIL_FROM: "from@test", APP_PUBLIC_URL: "https://family.test" });
  await mail.sendAlbumGuestInvitationEmail({ to: "guest@test", displayName: "Ana <x>", ownerDisplayName: "Owner & Co", albumTitle: "Álbum <privado>", invitationPath: "/guest-invitations/token" });
  assert.match(message.text, /https:\/\/family.test\/guest-invitations\/token/);
  assert.match(message.html, /Owner &amp; Co/);
  assert.match(message.html, /Álbum &lt;privado&gt;/);
  assert.match(message.html, /Ver invitación/);
});

test("activation email preserves safe returnTo", async () => {
  await mail.sendActivationEmail({ to: "guest@test", displayName: "Ana", token: "activation", returnTo: "/guest-invitations/guest-token" });
  assert.match(message.text, /returnTo|guest-invitations/);
  assert.match(message.html, /activate|token=activation/);
});
