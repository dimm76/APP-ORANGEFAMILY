/* global require, process, console, __dirname */
require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../db");
const { enqueueHistoricalVideoJob, drainVideoJobQueue } = require("../src/orangePhotosVideoJobQueue");

const REPORT_PATH = path.resolve(__dirname, "../tmp/orange-photos-video-reconciliation-report.json");
const dryRun = String(process.env.ORANGE_PHOTOS_VIDEO_DRY_RUN || "true") !== "false";
function positive(value, name, fallback = null) { if (value == null || String(value).trim() === "") return fallback; const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} debe ser un entero positivo.`); return parsed; }
const limit = positive(process.env.ORANGE_PHOTOS_VIDEO_LIMIT, "ORANGE_PHOTOS_VIDEO_LIMIT");
positive(process.env.ORANGE_PHOTOS_VIDEO_CONCURRENCY, "ORANGE_PHOTOS_VIDEO_CONCURRENCY", 1);
async function query(text, values = []) { return pool.query({ text, values, query_timeout:15000 }); }
async function candidates() {
  const total = Number((await query("SELECT count(*)::int total FROM public.orange_photos WHERE media_type='video'")).rows[0].total);
  const rows = (await query(`SELECT p.id,p.original_filename,p.duration_seconds,p.width,p.height,owner_li.captured_at AS captured_at,owner_li.captured_at_source AS captured_at_source,poster.object_key poster_key,thumbnail.object_key thumbnail_key,preview.object_key preview_key,playback.object_key playback_key,original.object_key original_key FROM public.orange_photos p LEFT JOIN public.orange_photo_library_items owner_li ON owner_li.photo_id=p.id AND owner_li.user_id=p.owner_user_id JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original' LEFT JOIN public.orange_photo_files poster ON poster.photo_id=p.id AND poster.variant='poster' LEFT JOIN public.orange_photo_files thumbnail ON thumbnail.photo_id=p.id AND thumbnail.variant='thumbnail' LEFT JOIN public.orange_photo_files preview ON preview.photo_id=p.id AND preview.variant='preview' LEFT JOIN public.orange_photo_files playback ON playback.photo_id=p.id AND playback.variant='playback' WHERE p.media_type='video' AND (p.duration_seconds IS NULL OR p.duration_seconds<=0 OR p.width IS NULL OR p.height IS NULL OR owner_li.captured_at_source IN ('upload_date','file_mtime','unknown') OR (poster.id IS NULL AND thumbnail.id IS NULL) OR thumbnail.id IS NULL OR preview.id IS NULL OR playback.id IS NULL) ORDER BY p.updated_at DESC NULLS LAST,p.id`)).rows;
  return { total, eligible:rows.length, items:limit ? rows.slice(0, limit) : rows };
}
async function main() {
  const selected = await candidates();
  const report = { generated_at:new Date().toISOString(), dry_run:dryRun, total_videos:selected.total, eligible_videos:selected.eligible, candidates:selected.items.length, historical_candidates:selected.items.length, historical_jobs_queued:0, failures:[], items:[] };
  for (const [index, row] of selected.items.entries()) {
    const missing = { duration:!(Number(row.duration_seconds)>0), dimensions:!row.width||!row.height, poster:!row.poster_key&&!row.thumbnail_key, preview:!row.preview_key, playback:!row.playback_key };
    const item = { photo_id:row.id, filename:row.original_filename, original_key:row.original_key, poster_key_before:row.poster_key, thumbnail_key_before:row.thumbnail_key, preview_key_before:row.preview_key, playback_key_before:row.playback_key, missing, result:dryRun ? "would_enqueue" : "queued" };
    if (!dryRun) { try { item.job = await enqueueHistoricalVideoJob(row.id, { createPoster:true, createThumbnail:true, createPreview:true, createPlayback:true, updateMetadata:true }); report.historical_jobs_queued += 1; } catch (error) { item.error = error.message; report.failures.push({ photo_id:row.id, filename:row.original_filename, message:error.message }); } }
    report.items.push(item); console.log(`Analizado ${index + 1}/${selected.items.length}: ${row.original_filename}`);
  }
  if (!dryRun) report.queue = await drainVideoJobQueue();
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive:true }); await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Candidatos históricos: ${report.historical_candidates}. Jobs encolados: ${report.historical_jobs_queued}. Fallos: ${report.failures.length}.`);
}
main().catch(error => { console.error(`Reconciliación de vídeos: ${error.message}`); process.exitCode = 1; }).finally(() => pool.end().catch(() => {}));
