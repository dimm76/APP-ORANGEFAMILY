/* global require, process, console, __dirname */
require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../db");
const { processStoredOrangePhotoImage } = require("../src/orangePhotosImageProcessor");

const REPORT_PATH = path.resolve(__dirname, "../tmp/orange-photos-image-reconciliation-report.json");
const dryRun = String(process.env.ORANGE_PHOTOS_IMAGE_DRY_RUN || "true") !== "false";

function positiveInteger(value, name, fallback = null) {
  if (value == null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} debe ser un entero positivo.`);
  return parsed;
}

const limit = positiveInteger(process.env.ORANGE_PHOTOS_IMAGE_LIMIT, "ORANGE_PHOTOS_IMAGE_LIMIT");
const concurrency = positiveInteger(process.env.ORANGE_PHOTOS_IMAGE_CONCURRENCY, "ORANGE_PHOTOS_IMAGE_CONCURRENCY", 1);
if (concurrency > 4) throw new Error("ORANGE_PHOTOS_IMAGE_CONCURRENCY no puede superar 4.");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestedPhotoId = String(process.env.ORANGE_PHOTOS_IMAGE_PHOTO_ID || "").trim();
const requestedFamilyId = String(process.env.ORANGE_PHOTOS_IMAGE_FAMILY_ID || "").trim();
const validateDerivatives = String(process.env.ORANGE_PHOTOS_IMAGE_VALIDATE || "false") === "true";

if (requestedPhotoId && !UUID_RE.test(requestedPhotoId)) throw new Error("ORANGE_PHOTOS_IMAGE_PHOTO_ID no es un UUID válido.");
if (requestedFamilyId && !UUID_RE.test(requestedFamilyId)) throw new Error("ORANGE_PHOTOS_IMAGE_FAMILY_ID no es un UUID válido.");
if (!dryRun && !requestedFamilyId) throw new Error("ORANGE_PHOTOS_IMAGE_FAMILY_ID es obligatorio cuando ORANGE_PHOTOS_IMAGE_DRY_RUN=false.");
if (validateDerivatives && !dryRun) throw new Error("ORANGE_PHOTOS_IMAGE_VALIDATE solo puede utilizarse en dry-run.");
if (validateDerivatives && !requestedPhotoId && (!limit || limit > 10)) throw new Error("ORANGE_PHOTOS_IMAGE_VALIDATE requiere PHOTO_ID o LIMIT entre 1 y 10.");

async function query(text, values = []) {
  return pool.query({ text, values, query_timeout: 15000 });
}

async function candidates() {
  const totalValues = [];
  let totalFamilyFilter = "";
  if (requestedFamilyId) {
    totalValues.push(requestedFamilyId);
    totalFamilyFilter = `AND p.family_id = $${totalValues.length}::uuid`;
  }
  const totalResult = await query(`SELECT count(*)::int AS total FROM public.orange_photos p JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original' WHERE p.media_type='image' ${totalFamilyFilter}`, totalValues);
  const values = [];
  const filters = [];
  if (requestedFamilyId) {
    values.push(requestedFamilyId);
    filters.push(`p.family_id = $${values.length}::uuid`);
  }
  if (requestedPhotoId) {
    values.push(requestedPhotoId);
    filters.push(`p.id = $${values.length}::uuid`);
  }
  const extraFilter = filters.length ? `AND ${filters.join(" AND ")}` : "";
  const result = await query(`SELECT p.id,p.family_id,p.original_filename,p.mime_type,p.width,p.height,original.object_key AS original_key,thumbnail.object_key AS thumbnail_key,preview.object_key AS preview_key FROM public.orange_photos p JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original' LEFT JOIN public.orange_photo_files thumbnail ON thumbnail.photo_id=p.id AND thumbnail.variant='thumbnail' LEFT JOIN public.orange_photo_files preview ON preview.photo_id=p.id AND preview.variant='preview' WHERE p.media_type='image' AND (thumbnail.id IS NULL OR preview.id IS NULL) ${extraFilter} ORDER BY p.created_at ASC,p.id ASC`, values);
  return { total: totalResult.rows[0].total, eligible: result.rows.length, items: limit ? result.rows.slice(0, limit) : result.rows };
}

async function limitedMap(items, worker) {
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, consume));
}

async function main() {
  if (!dryRun) console.log(`MODO ESCRITURA: familia ${requestedFamilyId}.`);
  else if (validateDerivatives) console.log("MODO DRY-RUN VALIDADO: se descargarán originales y se ejecutará FFmpeg, sin escribir en PostgreSQL ni Wasabi.");
  else console.log("MODO DRY-RUN: solo se inspeccionarán candidatos; no se descargarán originales ni se ejecutará FFmpeg.");
  const selected = await candidates();
  const report = {
    generated_at: new Date().toISOString(), dry_run: dryRun, family_id: requestedFamilyId || null, validate_derivatives: validateDerivatives,
    requested_photo_id: requestedPhotoId || null, total_images: selected.total, eligible_images: selected.eligible, candidates: selected.items.length,
    analyzed: 0, processed: 0, validated: 0, thumbnails_would_create: 0, previews_would_create: 0, thumbnails_created: 0, previews_created: 0,
    failures: [], possible_orphans: [], items: [],
  };
  await limitedMap(selected.items, async (row, index) => {
    const missing = { thumbnail: !row.thumbnail_key, preview: !row.preview_key };
    if (missing.thumbnail) report.thumbnails_would_create += 1;
    if (missing.preview) report.previews_would_create += 1;
    console.log(`Procesando ${index + 1}/${selected.items.length}: ${row.original_filename}`);
    try {
      const result = await processStoredOrangePhotoImage(row.id, { createThumbnail: true, createPreview: true, dryRun, validateDerivatives: dryRun && validateDerivatives });
      const created = result.created || [];
      report.analyzed += 1;
      if (dryRun && validateDerivatives) report.validated += 1;
      if (!dryRun) {
        report.processed += 1;
        report.thumbnails_created += created.filter(item => item.variant === "thumbnail").length;
        report.previews_created += created.filter(item => item.variant === "preview").length;
      }
      report.items.push({ photo_id: row.id, filename: row.original_filename, original_key: row.original_key, thumbnail_key_before: row.thumbnail_key, preview_key_before: row.preview_key, missing, actions: result.actions, created, result: dryRun ? (validateDerivatives ? "validated" : "would_process") : "processed" });
    } catch (error) {
      report.failures.push({ photo_id: row.id, filename: row.original_filename, message: error.message });
      if (error.possibleOrphans) report.possible_orphans.push(...error.possibleOrphans);
    }
  });
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Analizadas: ${report.analyzed}/${report.candidates}. Validadas físicamente: ${report.validated}. Thumbnails creados: ${report.thumbnails_created}. Previews creados: ${report.previews_created}. Fallos: ${report.failures.length}.`);
  console.log("Informe: backend/tmp/orange-photos-image-reconciliation-report.json");
}

main().catch(error => { console.error(`Reconciliación de imágenes: ${error.message}`); process.exitCode = 1; }).finally(() => pool.end().catch(() => {}));
