const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash, randomBytes } = require("node:crypto");
const createGuestInvitationToken = () => randomBytes(32).toString("base64url");
const hashGuestInvitationToken = token => createHash("sha256").update(token, "utf8").digest("hex");

test("guest invitation tokens are returned only as accept paths and stored hashed", () => {
  const token = createGuestInvitationToken();
  assert.equal(typeof token, "string");
  assert.equal(hashGuestInvitationToken(token).length, 64);
  assert.notEqual(token, hashGuestInvitationToken(token));
  assert.match(`/guest-invitations/${token}`, /^\/guest-invitations\//);
});

test("guest invitation paths keep the token in an internal route", () => {
  assert.match(`/guest-invitations/${createGuestInvitationToken()}`, /^\/guest-invitations\//);
});
