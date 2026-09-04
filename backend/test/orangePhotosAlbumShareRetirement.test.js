const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.resolve(root, relativePath), "utf8");

test("R6D retira el runtime legacy de shares de álbum", () => {
  const accessService = read("src/orangePhotoAlbumAccessService.js");
  const photosService = read("src/orangePhotosService.js");
  const photosHttp = read("src/orangePhotosHttp.js");
  const photosApi = read("../src/shared/api/orangePhotosApi.js");
  const accessHttp = read("src/orangePhotoAlbumAccessHttp.js");

  assert.doesNotMatch(accessService, /orange_photo_album_shares/);
  assert.doesNotMatch(photosService, /async function shareAlbum/);
  assert.doesNotMatch(photosService, /shareAlbum/);
  assert.doesNotMatch(photosHttp, /\/api\/orange-photo-albums\/:id\/share/);
  assert.doesNotMatch(photosHttp, /service\.shareAlbum/);
  assert.doesNotMatch(photosApi, /shareOrangeAlbum/);
  assert.match(accessHttp, /\/recipients/);
});

test("la migración R6D protege el backfill y elimina solo la tabla legacy", () => {
  const migration = read("../docs/30-database/migration/20260904200000_drop_orange_photo_album_shares.sql");

  assert.match(migration, /BEGIN;/);
  assert.match(migration, /COMMIT;/);
  assert.match(migration, /to_regclass\('public\.orange_photo_album_shares'\)/);
  assert.match(migration, /subject_type = 'family'/);
  assert.match(migration, /status = 'active'/);
  assert.match(migration, /revoked_at IS NULL/);
  assert.match(migration, /DROP TABLE IF EXISTS public\.orange_photo_album_shares;/);
  assert.doesNotMatch(migration, /CASCADE/);
  assert.doesNotMatch(migration, /DROP TABLE IF EXISTS public\.orange_photo_album_access/);
  assert.doesNotMatch(migration, /DROP TABLE IF EXISTS public\.orange_photo_album_guest_grants/);
  assert.doesNotMatch(migration, /DROP TABLE IF EXISTS public\.orange_photo_album_guest_invitations/);
  assert.doesNotMatch(migration, /DROP TABLE IF EXISTS public\.orange_photo_shares/);
});
