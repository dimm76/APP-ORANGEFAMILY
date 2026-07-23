/* global require, process, console, __dirname */
require("dotenv").config();

const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("../db");
const { getAttachmentsConfig } = require("../src/attachmentsConfig");
const { listOrangePhotosObjects } = require("../src/wasabiClient");

const REPORT_PATH = path.resolve(__dirname, "../tmp/orange-photos-preview-reconciliation-report.json");
const dryRun = String(process.env.ORANGE_PHOTOS_PREVIEW_RECONCILE_DRY_RUN || "true") !== "false";

function parseVariant(key) {
  const slash = key.lastIndexOf("/"), directory = key.slice(0, slash), filename = key.slice(slash + 1), dot = filename.lastIndexOf(".");
  if (dot < 1) return null;
  const extension = filename.slice(dot + 1).toLowerCase(), stem = filename.slice(0, dot), match = /-(\d{2,5})x(\d{2,5})$/i.exec(stem);
  if (!match) return null;
  return { key, directory, extension, original_key: `${directory}/${stem.slice(0, match.index)}.${extension}`, width: Number(match[1]), height: Number(match[2]) };
}

function selectPreview(original, variants) {
  if (!original.width || !original.height) return null;
  const ratio = original.width / original.height;
  return variants.filter(variant => variant.width >= 900 && variant.width <= 1600 && Math.abs(variant.width / variant.height - ratio) / ratio <= 0.1 && !(variant.width === variant.height && Math.abs(ratio - 1) > 0.1)).sort((a, b) => Math.abs(a.width - 1024) - Math.abs(b.width - 1024) || b.width * b.height - a.width * a.height)[0] || null;
}

async function listAll(prefix) {
  const objects = []; let token = null;
  do { const page = await listOrangePhotosObjects({ prefix, continuationToken: token, maxKeys: 1000 }); objects.push(...page.objects); token = page.is_truncated ? page.next_token : null; if (page.is_truncated && !token) throw new Error("Wasabi no devolvió continuation token."); } while (token);
  return objects;
}

async function main() {
  const config = getAttachmentsConfig();
  if (!config.configured || config.bucket !== "orangedesk") throw new Error("Wasabi debe estar configurado para el bucket orangedesk.");
  console.log(dryRun ? "MODO DRY-RUN: no se modificará PostgreSQL ni Wasabi." : "MODO ESCRITURA: solo se insertarán previews en PostgreSQL.");
  const originals = (await pool.query({ text: `SELECT p.id AS photo_id,p.family_id,p.width,p.height,f.object_key FROM public.orange_photos p JOIN public.orange_photo_files f ON f.photo_id=p.id AND f.variant='original' WHERE p.media_type='image' AND p.legacy_source='wasabi_family_photos' AND NOT EXISTS(SELECT 1 FROM public.orange_photo_files pv WHERE pv.photo_id=p.id AND pv.variant='preview') ORDER BY f.object_key`, query_timeout: 15000 })).rows;
  const registered = new Set((await pool.query({ text: `SELECT object_key FROM public.orange_photo_files WHERE provider='wasabi' AND bucket=$1`, values: [config.bucket], query_timeout: 15000 })).rows.map(row => row.object_key));
  const objects = await listAll("family_photos/"), objectByKey = new Map(objects.map(object => [object.key, object])), variantsByOriginal = new Map();
  for (const object of objects) { const variant = parseVariant(object.key); if (!variant) continue; if (!variantsByOriginal.has(variant.original_key)) variantsByOriginal.set(variant.original_key, []); variantsByOriginal.get(variant.original_key).push({ ...variant, ...object }); }
  const items = [];
  for (const original of originals) { const preview = selectPreview(original, variantsByOriginal.get(original.object_key) || []); if (!preview || registered.has(preview.key)) { items.push({ photo_id: original.photo_id, original: original.object_key, preview: null, result: preview ? "object_already_registered" : "no_suitable_preview" }); continue; } if (!dryRun) await pool.query({ text: `INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,'preview','wasabi',$3,$4,$5,$6,$7,$8,NULL,$9) ON CONFLICT DO NOTHING`, values: [original.family_id, original.photo_id, config.bucket, preview.key, preview.extension === "png" ? "image/png" : preview.extension === "webp" ? "image/webp" : "image/jpeg", preview.width, preview.height, preview.size, preview.etag], query_timeout: 15000 }); items.push({ photo_id: original.photo_id, original: original.object_key, preview: preview.key, result: dryRun ? "would_insert" : "inserted" }); }
  const report = { generated_at: new Date().toISOString(), dry_run: dryRun, bucket: config.bucket, originals_without_preview: originals.length, would_insert: items.filter(item => item.result === "would_insert").length, inserted: items.filter(item => item.result === "inserted").length, items };
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true }); await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Originals without preview: ${report.originals_without_preview}\n${dryRun ? "Would insert" : "Inserted"}: ${dryRun ? report.would_insert : report.inserted}\nReport: backend/tmp/orange-photos-preview-reconciliation-report.json`);
}

main().catch(error => { console.error("Preview reconciliation:", error.message); process.exitCode = 1; }).finally(() => pool.end().catch(() => {}));
