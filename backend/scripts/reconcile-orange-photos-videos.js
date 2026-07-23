/* global require, process, console, __dirname */
require("dotenv").config();

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const pool = require("../db");
const { getOrangePhotoObjectBuffer, uploadOrangePhotoToWasabi } = require("../src/wasabiClient");

const execFileAsync = promisify(execFile);
const REPORT_PATH = path.resolve(__dirname, "../tmp/orange-photos-video-reconciliation-report.json");
const POSTGRES_TIMEOUT_MS = 15000;
const dryRun = String(process.env.ORANGE_PHOTOS_VIDEO_DRY_RUN || "true") !== "false";

function positiveInteger(value, name, fallback = null) {
  if (value == null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} debe ser un entero positivo.`);
  return parsed;
}

const limit = positiveInteger(process.env.ORANGE_PHOTOS_VIDEO_LIMIT, "ORANGE_PHOTOS_VIDEO_LIMIT");
const concurrency = positiveInteger(process.env.ORANGE_PHOTOS_VIDEO_CONCURRENCY, "ORANGE_PHOTOS_VIDEO_CONCURRENCY", 1);
if (concurrency > 4) throw new Error("ORANGE_PHOTOS_VIDEO_CONCURRENCY no puede superar 4.");
if (!ffmpegPath || !ffprobePath) throw new Error("ffmpeg-static y ffprobe-static deben estar disponibles.");

async function pgQuery(text, values = [], client = pool) {
  return client.query({ text, values, query_timeout: POSTGRES_TIMEOUT_MS });
}

async function probe(filePath) {
  const { stdout } = await execFileAsync(ffprobePath, ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath], { timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const parsed = JSON.parse(stdout), stream = (parsed.streams || []).find(item => item.codec_type === "video");
  if (!stream) throw new Error("ffprobe no encontró una pista de vídeo.");
  const duration = Number(stream.duration || parsed.format?.duration), width = Number(stream.width), height = Number(stream.height);
  const sideRotation = (stream.side_data_list || []).find(item => Number.isFinite(Number(item.rotation)))?.rotation;
  const rotation = Number(sideRotation ?? stream.tags?.rotate ?? 0);
  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : null,
    width: Number.isInteger(width) && width > 0 ? width : null,
    height: Number.isInteger(height) && height > 0 ? height : null,
    rotation: Number.isFinite(rotation) ? rotation : 0,
    codec_name: stream.codec_name || null,
    format_name: parsed.format?.format_name || null,
    creation_time: stream.tags?.creation_time || parsed.format?.tags?.creation_time || null,
  };
}

async function createPreview(inputPath, outputPath) {
  const scale = "scale=w='if(gt(iw,ih),trunc(min(720,iw)/2)*2,-2)':h='if(gt(iw,ih),-2,trunc(min(720,ih)/2)*2)'";
  await execFileAsync(ffmpegPath, ["-y", "-i", inputPath, "-t", "3", "-an", "-vf", scale, "-r", "25", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath], { timeout: 180000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const stat = await fs.stat(outputPath);
  if (!stat.size) throw new Error("ffmpeg generó un preview vacío.");
  return { size: stat.size, metadata: await probe(outputPath) };
}

async function candidates() {
  const allVideos = await pgQuery("SELECT count(*)::int AS total FROM public.orange_photos WHERE media_type='video'");
  const result = await pgQuery(`
    SELECT p.id AS photo_id,p.family_id,p.original_filename,p.mime_type,p.duration_seconds,p.width,p.height,p.orientation,
           original.bucket,original.object_key,original.mime_type AS original_mime_type,
           preview.id AS preview_id,preview.object_key AS preview_object_key
    FROM public.orange_photos p
    JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original'
    LEFT JOIN public.orange_photo_files preview ON preview.photo_id=p.id AND preview.variant='preview'
    WHERE p.media_type='video'
      AND (p.duration_seconds IS NULL OR p.duration_seconds<=0 OR preview.id IS NULL)
    ORDER BY original.object_key,p.id
  `);
  return { total: allVideos.rows[0].total, eligible: result.rows.length, items: limit ? result.rows.slice(0, limit) : result.rows };
}

async function persist(row, metadata, previewPath, previewMetadata, report) {
  let uploaded = null;
  if (!row.preview_id) {
    const buffer = await fs.readFile(previewPath);
    uploaded = await uploadOrangePhotoToWasabi(buffer, { familyId: row.family_id, mimeType: "video/mp4", extension: "mp4", originalFilename: `${row.original_filename || row.photo_id}-preview.mp4`, variant: "preview" });
  }
  let client = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    if (uploaded) {
      const inserted = await pgQuery(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,'preview',$3,$4,$5,$6,$7,$8,$9,$10,NULL) ON CONFLICT(photo_id,variant) DO NOTHING RETURNING id`, [row.family_id,row.photo_id,uploaded.provider,uploaded.bucket,uploaded.object_key,"video/mp4",previewMetadata.width,previewMetadata.height,uploaded.size_bytes,uploaded.checksum_sha256], client);
      if (!inserted.rowCount) throw new Error("Ya existe un preview registrado para el vídeo.");
    }
    await pgQuery("UPDATE public.orange_photos SET duration_seconds=$1,width=$2,height=$3,orientation=$4 WHERE id=$5 AND family_id=$6", [metadata.duration,metadata.width,metadata.height,metadata.rotation,row.photo_id,row.family_id], client);
    await client.query("COMMIT");
    return uploaded;
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    if (uploaded) report.possible_orphans.push(uploaded.object_key);
    throw error;
  } finally {
    client?.release();
  }
}

async function processVideo(row, index, report) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orange-photos-video-"));
  const extension = path.extname(row.original_filename || row.object_key) || ".video", inputPath = path.join(tempDir, `original${extension}`), outputPath = path.join(tempDir, "preview.mp4");
  try {
    console.log(`Analizando ${index + 1}: ${row.object_key}`);
    await fs.writeFile(inputPath, await getOrangePhotoObjectBuffer(row.object_key));
    const metadata = await probe(inputPath);
    if (!metadata.duration || !metadata.width || !metadata.height) throw new Error("ffprobe no devolvió duración y dimensiones válidas.");
    report.formats[metadata.format_name || "unknown"] = (report.formats[metadata.format_name || "unknown"] || 0) + 1;
    report.codecs[metadata.codec_name || "unknown"] = (report.codecs[metadata.codec_name || "unknown"] || 0) + 1;
    if (metadata.creation_time) report.creation_time_found += 1;
    if (!(Number(row.duration_seconds) > 0)) report.duration_recovered += 1;
    const shouldCreate = !row.preview_id;
    if (shouldCreate) report.previews_would_create += 1;
    let generated = null;
    if (!dryRun && shouldCreate || dryRun && limit === 1) generated = await createPreview(inputPath, outputPath);
    let uploaded = null;
    if (!dryRun) {
      uploaded = await persist(row, metadata, outputPath, generated?.metadata, report);
      if (uploaded) report.previews_created += 1;
    }
    report.items.push({ photo_id:row.photo_id,filename:row.original_filename,mime_type:row.original_mime_type||row.mime_type,object_key:row.object_key,format_name:metadata.format_name,codec_name:metadata.codec_name,duration:metadata.duration,width:metadata.width,height:metadata.height,rotation:metadata.rotation,creation_time:metadata.creation_time,had_preview:Boolean(row.preview_id),preview_generated:Boolean(generated),preview_size:generated?.size||null,preview_width:generated?.metadata.width||null,preview_height:generated?.metadata.height||null,preview_duration:generated?.metadata.duration||null,preview_codec_name:generated?.metadata.codec_name||null,result:dryRun?"would_update":"updated" });
    report.analyzed += 1;
  } catch (error) {
    report.failures.push({ photo_id:row.photo_id,object_key:row.object_key,message:error.message });
    console.error(`Fallo ${row.object_key}: ${error.message}`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function limitedMap(items, worker) {
  let cursor = 0;
  async function consume() { while (cursor < items.length) { const index = cursor++; await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, consume));
}

async function main() {
  console.log(dryRun ? "MODO DRY-RUN: no se modificará PostgreSQL ni Wasabi." : "MODO ESCRITURA: se crearán previews y se actualizarán metadatos.");
  const selected = await candidates();
  const report = { generated_at:new Date().toISOString(),dry_run:dryRun,total_videos:selected.total,eligible_videos:selected.eligible,candidates:selected.items.length,analyzed:0,duration_recovered:0,previews_would_create:0,previews_created:0,already_complete:Math.max(0,selected.total-selected.eligible),formats:{},codecs:{},creation_time_found:0,failures:[],possible_orphans:[],items:[] };
  await limitedMap(selected.items, (row, index) => processVideo(row, index, report));
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Analizados: ${report.analyzed}/${report.candidates}. Previews que se crearían: ${report.previews_would_create}. Fallos: ${report.failures.length}.`);
  console.log("Informe: backend/tmp/orange-photos-video-reconciliation-report.json");
}

main().catch(error => { console.error(`Reconciliación de vídeos: ${error.message}`); process.exitCode = 1; }).finally(() => pool.end().catch(() => {}));
