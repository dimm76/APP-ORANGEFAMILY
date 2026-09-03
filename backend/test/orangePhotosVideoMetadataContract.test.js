/* global require */
const fs = require("node:fs");
const test = require("node:test");
const assert = require("node:assert/strict");

for (const key of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) process.env[key] ||= "test";
process.env.DB_PORT = "5432";

const pool = require("../db");
const processor = require("../src/orangePhotosVideoProcessor");
const processorSource = fs.readFileSync(require.resolve("../src/orangePhotosVideoProcessor"), "utf8");
const reconcileSource = fs.readFileSync(require.resolve("../scripts/reconcile-orange-photos-videos"), "utf8");

test("el pipeline de vídeo usa metadata canónica y conserva metadata física", () => {
  assert.match(processorSource, /LEFT JOIN public\.orange_photo_library_items owner_li/);
  assert.match(processorSource, /owner_li\.photo_id=p\.id AND owner_li\.user_id=p\.owner_user_id/);
  assert.match(processorSource, /owner_li\.captured_at_source AS owner_captured_at_source/);
  assert.doesNotMatch(processorSource, /p\.captured_at/);
  assert.doesNotMatch(processorSource, /p\.captured_at_source/);
  assert.match(processorSource, /includes\(row\.owner_captured_at_source\)/);
  assert.match(processorSource, /duration_seconds=.*width=.*height=.*orientation=/);
  assert.doesNotMatch(processorSource, /UPDATE public\.orange_photos[^`]*captured_at/);
  assert.match(processorSource, /UPDATE public\.orange_photo_library_items li SET captured_at=.*captured_at_source='exif'/);
  assert.match(processorSource, /li\.user_id=p\.owner_user_id/);
  assert.match(processorSource, /li\.captured_at_source IN \('upload_date','file_mtime','unknown'\)/);
  assert.match(reconcileSource, /LEFT JOIN public\.orange_photo_library_items owner_li/);
  assert.match(reconcileSource, /owner_li\.captured_at AS captured_at,owner_li\.captured_at_source AS captured_at_source/);
  assert.doesNotMatch(reconcileSource, /p\.captured_at/);
  assert.doesNotMatch(reconcileSource, /p\.captured_at_source/);
  assert.match(reconcileSource, /owner_li\.captured_at_source IN \('upload_date','file_mtime','unknown'\)/);
});

test("processStoredOrangePhotoVideo decide metadata con la copia lógica del owner", async () => {
  const originalQuery = pool.query;
  const baseRow = {
    id: "33333333-3333-4333-8333-333333333333",
    family_id: "22222222-2222-4222-8222-222222222222",
    original_filename: "video.mp4",
    mime_type: "video/mp4",
    duration_seconds: 12,
    width: 1920,
    height: 1080,
    orientation: 1,
    bucket: "orangefamily",
    object_key: "original/video.mp4",
    original_mime_type: "video/mp4",
    poster_key: "poster/video.jpg",
    poster_bucket: "orangefamily",
    thumbnail_key: "thumbnail/video.jpg",
    preview_key: "preview/video.mp4",
    playback_key: "playback/video.mp4",
  };

  pool.query = async () => ({ rows: [{ ...baseRow, owner_captured_at_source: "manual" }] });
  try {
    const manual = await processor.processStoredOrangePhotoVideo(baseRow.id, { dryRun: true });
    assert.equal(manual.actions.update_metadata, false);

    pool.query = async () => ({ rows: [{ ...baseRow, owner_captured_at_source: "file_mtime" }] });
    const fileMtime = await processor.processStoredOrangePhotoVideo(baseRow.id, { dryRun: true });
    assert.equal(fileMtime.actions.update_metadata, true);

    pool.query = async () => ({ rows: [{ ...baseRow, owner_captured_at_source: null }] });
    const missingOwnerCopy = await processor.processStoredOrangePhotoVideo(baseRow.id, { dryRun: true });
    assert.equal(missingOwnerCopy.actions.update_metadata, false);

    pool.query = async () => ({ rows: [{ ...baseRow, duration_seconds: null, owner_captured_at_source: null }] });
    const missingPhysicalMetadata = await processor.processStoredOrangePhotoVideo(baseRow.id, { dryRun: true });
    assert.equal(missingPhysicalMetadata.actions.update_metadata, true);
  } finally {
    pool.query = originalQuery;
  }
});
