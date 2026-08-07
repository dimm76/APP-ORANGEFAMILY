/* global require, module */
const fs = require("node:fs/promises");
const fsNative = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const pool = require("../db");
const { getOrangePhotoObjectStream, uploadOrangePhotoToWasabi } = require("./wasabiClient");

const execFileAsync = promisify(execFile);
const QUERY_TIMEOUT = 15000;
const THUMBNAIL_MAX_SIDE = 480;
const PREVIEW_MAX_SIDE = 1920;

async function query(text, values = [], client = pool) {
  return client.query({ text, values, query_timeout: QUERY_TIMEOUT });
}

async function loadPhoto(photoId) {
  const result = await query(`SELECT p.id,p.family_id,p.original_filename,p.mime_type,p.width,p.height,original.bucket,original.object_key,original.mime_type AS original_mime_type,thumbnail.object_key AS thumbnail_key,preview.object_key AS preview_key FROM public.orange_photos p JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original' LEFT JOIN public.orange_photo_files thumbnail ON thumbnail.photo_id=p.id AND thumbnail.variant='thumbnail' LEFT JOIN public.orange_photo_files preview ON preview.photo_id=p.id AND preview.variant='preview' WHERE p.id=$1::uuid AND p.media_type='image'`, [photoId]);
  const row = result.rows[0];
  if (!row) throw new Error("Imagen registrada no encontrada o sin original.");
  return row;
}

function derivativeFormatForMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "image/png") return { mimeType: "image/png", extension: "png" };
  if (mime === "image/webp") return { mimeType: "image/webp", extension: "webp" };
  return { mimeType: "image/jpeg", extension: "jpg" };
}

async function probeImageFile(filePath) {
  const { stdout } = await execFileAsync(ffprobePath, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,pix_fmt", "-of", "json", filePath], { timeout: 120000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  const stream = JSON.parse(stdout).streams?.[0];
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error("ffprobe no devolvió dimensiones válidas para la imagen.");
  return { width, height, pix_fmt: stream?.pix_fmt || null };
}

async function createImageDerivative(inputPath, outputPath, { maxSide, format, quality }) {
  const scale = `scale=w='if(gt(iw,ih),min(${maxSide},iw),-2)':h='if(gt(iw,ih),-2,min(${maxSide},ih))'`;
  const args = ["-y", "-i", inputPath, "-frames:v", "1", "-vf", scale, "-map_metadata", "-1"];
  if (format.mimeType === "image/png") args.push("-compression_level", "6");
  else if (format.mimeType === "image/webp") args.push("-c:v", "libwebp", "-q:v", quality === "thumbnail" ? "70" : "82");
  else args.push("-q:v", quality === "thumbnail" ? "5" : "3");
  args.push(outputPath);
  await execFileAsync(ffmpegPath, args, { timeout: 180000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const stat = await fs.stat(outputPath);
  if (!stat.size) throw new Error("ffmpeg generó un derivado de imagen vacío.");
  return { size: stat.size, metadata: await probeImageFile(outputPath) };
}

async function register(row, derivatives, possibleOrphans) {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    for (const derivative of derivatives) {
      const inserted = await query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL) ON CONFLICT(photo_id,variant) DO NOTHING RETURNING id`, [row.family_id,row.id,derivative.variant,derivative.upload.provider,derivative.upload.bucket,derivative.upload.object_key,derivative.mime_type,derivative.metadata.width,derivative.metadata.height,derivative.upload.size_bytes,derivative.upload.checksum_sha256], client);
      if (!inserted.rowCount) throw new Error(`La variante ${derivative.variant} ya existe; el objeto subido queda como posible huérfano.`);
    }
    await client.query("COMMIT");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    possibleOrphans.push(...derivatives.map(item => item.upload.object_key));
    throw error;
  } finally {
    client?.release();
  }
}

async function processStoredOrangePhotoImage(photoId, options = {}) {
  const row = await loadPhoto(photoId);
  const createThumbnail = options.createThumbnail !== false;
  const createPreview = options.createPreview !== false;
  const dryRun = options.dryRun === true;
  const needsThumbnail = createThumbnail && !row.thumbnail_key;
  const needsPreview = createPreview && !row.preview_key;
  const actions = { create_thumbnail: needsThumbnail, create_preview: needsPreview };
  if (!needsThumbnail && !needsPreview) return { photo: row, actions, created: [], possible_orphans: [] };
  if (dryRun && options.validateDerivatives !== true) return { photo: row, actions, created: [], possible_orphans: [] };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orange-photos-image-"));
  const possibleOrphans = [];
  try {
    const inputPath = path.join(tempDir, `original${path.extname(row.original_filename || row.object_key) || ".image"}`);
    const format = derivativeFormatForMime(row.original_mime_type || row.mime_type);
    const thumbnailPath = path.join(tempDir, `thumbnail.${format.extension}`);
    const previewPath = path.join(tempDir, `preview.${format.extension}`);
    const source = await getOrangePhotoObjectStream({ bucket: row.bucket, object_key: row.object_key });
    await pipeline(source.Body, fsNative.createWriteStream(inputPath));
    const generated = [];
    if (needsThumbnail) generated.push({ variant: "thumbnail", path: thumbnailPath, mime_type: format.mimeType, extension: format.extension, ...(await createImageDerivative(inputPath, thumbnailPath, { maxSide: THUMBNAIL_MAX_SIDE, format, quality: "thumbnail" })) });
    if (needsPreview) generated.push({ variant: "preview", path: previewPath, mime_type: format.mimeType, extension: format.extension, ...(await createImageDerivative(inputPath, previewPath, { maxSide: PREVIEW_MAX_SIDE, format, quality: "preview" })) });
    if (dryRun) return { photo: row, actions, created: generated.map(item => ({ variant: item.variant, size: item.size, width: item.metadata.width, height: item.metadata.height, mime_type: item.mime_type })), possible_orphans: [] };
    const derivatives = [];
    try {
      for (const item of generated) {
        const upload = await uploadOrangePhotoToWasabi(await fs.readFile(item.path), { familyId: row.family_id, photoId: row.id, mimeType: item.mime_type, extension: item.extension, originalFilename: `${row.original_filename || row.id}_${item.variant}.${item.extension}`, variant: item.variant });
        derivatives.push({ ...item, upload });
      }
      await register(row, derivatives, possibleOrphans);
    } catch (error) {
      error.possibleOrphans = [...new Set([...possibleOrphans, ...derivatives.map(item => item.upload.object_key)])];
      throw error;
    }
    return { photo: row, actions, created: derivatives.map(item => ({ variant: item.variant, provider: item.upload.provider, bucket: item.upload.bucket, object_key: item.upload.object_key, mime_type: item.mime_type, size_bytes: item.upload.size_bytes, checksum_sha256: item.upload.checksum_sha256, width: item.metadata.width, height: item.metadata.height })), possible_orphans: [] };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

module.exports = { derivativeFormatForMime, probeImageFile, createImageDerivative, processStoredOrangePhotoImage };
