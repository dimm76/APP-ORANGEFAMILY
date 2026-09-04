const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.resolve(
  __dirname,
  '../../docs/30-database/migration/20260904060000_orange_photos_drop_legacy_mutable_columns.sql',
);

const sql = fs.readFileSync(migrationPath, 'utf8');
const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

test('R5F drops exactly the legacy mutable orange_photos columns safely', () => {
  assert.match(normalizedSql, /^begin;/);
  assert.match(normalizedSql, /commit;$/);
  assert.doesNotMatch(normalizedSql, /cascade/);

  const columns = [
    'title',
    'description',
    'captured_at',
    'captured_at_source',
    'timezone',
    'latitude',
    'longitude',
    'altitude_meters',
    'location_name',
    'location_country',
    'location_region',
    'location_locality',
    'location_source',
    'visibility',
    'is_favorite',
    'is_trashed',
    'trashed_at',
    'public_enabled',
    'public_token',
    'public_created_at',
    'public_revoked_at',
  ];
  const dropColumn = normalizedSql.match(/drop column[\s\S]*?;(?=\s*commit;)/)?.[0] ?? '';
  const droppedColumns = [...dropColumn.matchAll(/drop column\s+([a-z_]+)/g)].map((match) => match[1]);
  assert.deepEqual(droppedColumns, columns);

  for (const index of [
    'idx_orange_photos_active',
    'idx_orange_photos_family_captured',
    'idx_orange_photos_family_trashed',
    'idx_orange_photos_family_visibility',
    'uq_orange_photos_public_token',
  ]) {
    assert.match(normalizedSql, new RegExp(`drop index public\\.${index};`));
  }

  for (const constraint of [
    'orange_photos_captured_source_check',
    'orange_photos_latitude_check',
    'orange_photos_location_source_check',
    'orange_photos_longitude_check',
    'orange_photos_public_link_check',
    'orange_photos_trash_check',
    'orange_photos_visibility_check',
  ]) {
    assert.match(normalizedSql, new RegExp(`drop constraint ${constraint}`));
  }

  assert.match(normalizedSql, /found physical assets without any logical library copy/);
  assert.match(normalizedSql, /found album items without their source logical copy/);
  assert.match(normalizedSql, /found legacy favorite=true without canonical user setting/);
});
