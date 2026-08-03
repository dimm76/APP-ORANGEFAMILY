const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const dbPath = path.resolve(__dirname, "../db.js");
const wasabiPath = path.resolve(__dirname, "../src/wasabiClient.js");
const originalDb = require.cache[dbPath];
const originalWasabi = require.cache[wasabiPath];
const calls = [];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async (...args) => { calls.push(args); return { rows: [] }; }, connect: async () => ({ query: async (...args) => { calls.push(args); return { rows: [] }; }, release() {} }) } };
require.cache[wasabiPath] = { id: wasabiPath, filename: wasabiPath, loaded: true, exports: { getSignedOrangePhotoUrl: async record => `https://signed.test/${record.object_key || "file"}` } };
const guests = require("../src/orangePhotosGuestService.js");
if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
if (originalWasabi) require.cache[wasabiPath] = originalWasabi; else delete require.cache[wasabiPath];

test("createGuestInvitationToken produces a non-empty token", () => { assert.ok(guests.createGuestInvitationToken()); });
test("hashGuestInvitationToken produces a SHA-256 hex digest", () => { assert.match(guests.hashGuestInvitationToken("guest-token"), /^[a-f0-9]{64}$/); });
test("invalid guest album access is rejected before PostgreSQL", async () => { calls.length = 0; const result = await guests.resolveGuestAlbumAccess({ user: { id: "user" } }, "invalid"); assert.equal(result.status, 404); assert.equal(calls.length, 0); });
test("unauthenticated guest access returns 401", async () => { assert.equal((await guests.resolveGuestAlbumAccess({}, "invalid")).status, 401); });
