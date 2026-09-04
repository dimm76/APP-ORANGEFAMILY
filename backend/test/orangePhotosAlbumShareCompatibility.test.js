const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "22222222-2222-4222-8222-222222222222";
const ALBUM_ID = "33333333-3333-4333-8333-333333333333";
const MEMBER_IDS = [
  "44444444-4444-4444-8444-444444444444",
  "55555555-5555-4555-8555-555555555555",
];

const calls = [];
const dbPath = path.resolve(__dirname, "../db.js");
const authPath = path.resolve(__dirname, "../src/attachmentsService.js");
const accessPath = path.resolve(__dirname, "../src/orangePhotoAlbumAccessService.js");
const wasabiPath = path.resolve(__dirname, "../src/wasabiClient.js");
const pool = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (String(sql).includes("FROM public.orange_photo_albums WHERE id=$1 AND family_id=$2")) {
      return { rows: [{ id: ALBUM_ID, family_id: FAMILY_ID, owner_user_id: OWNER_ID, allow_comments: true }] };
    }
    if (String(sql).includes("FROM public.auth_users au JOIN public.family_memberships")) {
      return { rows: (params?.[1] || []).map(id => ({ id })) };
    }
    return { rows: [] };
  },
  connect: async () => {
    throw new Error("shareAlbum no debe abrir una transacción propia");
  },
};
const accessCalls = [];
let listAlbumRecipientsImpl = async () => ({ ok: true, payload: { family: [] } });
let syncAlbumRecipientsImpl = async (...args) => {
  accessCalls.push(args);
  return { ok: true, payload: {} };
};

const originalDb = require.cache[dbPath];
const originalAuth = require.cache[authPath];
const originalAccess = require.cache[accessPath];
const originalWasabi = require.cache[wasabiPath];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    resolveAuthenticatedFamily: () => ({ ok: true, userId: OWNER_ID, familyId: FAMILY_ID }),
  },
};
require.cache[accessPath] = {
  id: accessPath,
  filename: accessPath,
  loaded: true,
  exports: {
    resolveAlbumAccess: async () => ({ ok: true }),
    listAlbumRecipients: (...args) => listAlbumRecipientsImpl(...args),
    syncAlbumRecipients: (...args) => syncAlbumRecipientsImpl(...args),
  },
};
require.cache[wasabiPath] = {
  id: wasabiPath,
  filename: wasabiPath,
  loaded: true,
  exports: {
    getSignedOrangePhotoUrl: async () => "https://signed.test/file",
  },
};
const orangePhotosService = require("../src/orangePhotosService.js");
if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
if (originalAuth) require.cache[authPath] = originalAuth; else delete require.cache[authPath];
if (originalAccess) require.cache[accessPath] = originalAccess; else delete require.cache[accessPath];
if (originalWasabi) require.cache[wasabiPath] = originalWasabi; else delete require.cache[wasabiPath];

function request() {
  return { auth: { ok: true, userId: OWNER_ID, familyId: FAMILY_ID }, body: {} };
}

function reset() {
  calls.length = 0;
  accessCalls.length = 0;
  listAlbumRecipientsImpl = async () => ({ ok: true, payload: { family: [] } });
  syncAlbumRecipientsImpl = async (...args) => {
    accessCalls.push(args);
    return { ok: true, payload: {} };
  };
}

test("selected adapts recipients and preserves the legacy response", async () => {
  reset();
  const result = await orangePhotosService.shareAlbum(request(), ALBUM_ID, {
    visibility: "selected",
    user_ids: MEMBER_IDS,
    can_contribute: true,
  });
  assert.equal(result.ok, true);
  assert.deepEqual(accessCalls[0], [request(), ALBUM_ID, {
    recipients: MEMBER_IDS.map(user_id => ({ user_id, subject_type: "family", status: "active", invitation_id: null })),
    allow_contributions: true,
    allow_comments: true,
  }]);
  assert.deepEqual(result.payload, {
    visibility: "selected",
    user_ids: MEMBER_IDS,
    can_contribute: true,
    allow_contributions: true,
    private_photo_count: 0,
    warning: null,
  });
  assert.equal(calls.some(({ sql }) => /BEGIN|orange_photo_album_shares/.test(sql)), false);
});

test("family resolves all canonical eligible recipients instead of body.user_ids", async () => {
  reset();
  const familyIds = [MEMBER_IDS[0], "66666666-6666-4666-8666-666666666666"];
  listAlbumRecipientsImpl = async () => ({ ok: true, payload: { family: familyIds.map(user_id => ({ user_id })) } });
  await orangePhotosService.shareAlbum(request(), ALBUM_ID, {
    visibility: "family",
    user_ids: [MEMBER_IDS[0]],
    can_contribute: false,
  });
  assert.deepEqual(accessCalls[0][2].recipients.map(({ user_id }) => user_id), familyIds);
});

test("private sends no recipients and disables contributions while preserving comments", async () => {
  reset();
  const result = await orangePhotosService.shareAlbum(request(), ALBUM_ID, {
    visibility: "private",
    can_contribute: true,
  });
  assert.deepEqual(accessCalls[0][2], { recipients: [], allow_contributions: false, allow_comments: true });
  assert.equal(result.payload.visibility, "private");
  assert.deepEqual(result.payload.user_ids, []);
});

test("canonical sync errors are propagated", async () => {
  reset();
  const failure = { ok: false, status: 422, code: "INVALID_ALBUM_RECIPIENTS", reason: "No válido" };
  syncAlbumRecipientsImpl = async () => failure;
  const result = await orangePhotosService.shareAlbum(request(), ALBUM_ID, {
    visibility: "selected",
    user_ids: [MEMBER_IDS[0]],
  });
  assert.deepEqual(result, failure);
});
