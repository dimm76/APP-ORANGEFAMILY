const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("R6C migration reconciles family album ACL without touching external grants", () => {
  const migration = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../docs/30-database/migration/20260904140000_orange_photo_album_access_read_cutover.sql"
    ),
    "utf8"
  );
  const sql = migration.replace(/\s+/g, " ").trim().toLowerCase();

  assert.match(sql, /^begin;/);
  assert.match(sql, /commit;$/);
  assert.match(sql, /expected_family/);
  assert.match(sql, /orange_photo_album_shares/);
  assert.match(sql, /orange_photo_album_access/);
  assert.match(sql, /visibility='selected'/);
  assert.match(sql, /visibility='family'/);
  assert.match(sql, /membership\.status='active'/);
  assert.match(sql, /membership\.role in \('member','guest'\)/);
  assert.match(sql, /module_access ->> 'orange_photos'/);
  assert.match(sql, /status in \('active','pending'\)/);
  assert.match(sql, /subject_type='external'/);
  assert.match(sql, /subject_type='family'/);
  assert.match(sql, /final guard/);
  assert.match(sql, /status='revoked'/);
  assert.doesNotMatch(sql, /orange_photo_album_guest_grants/);
  assert.doesNotMatch(sql, /drop table orange_photo_album_shares/);
});
