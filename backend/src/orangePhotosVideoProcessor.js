/* global require, module */
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const pool = require("../db");
const { getOrangePhotoObjectBuffer, uploadOrangePhotoToWasabi } = require("./wasabiClient");

const execFileAsync = promisify(execFile);
const QUERY_TIMEOUT = 15000;
const validDateIso = value => { if (value == null || value === "") return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); };

async function query(text, values = [], client = pool) {
  return client.query({ text, values, query_timeout: QUERY_TIMEOUT });
}

async function probeVideoFile(filePath) {
  const { stdout } = await execFileAsync(ffprobePath, ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath], { timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const parsed = JSON.parse(stdout), stream = (parsed.streams || []).find(item => item.codec_type === "video");
  if (!stream) throw new Error("ffprobe no encontró una pista de vídeo.");
  const duration = Number(stream.duration || parsed.format?.duration), width = Number(stream.width), height = Number(stream.height);
  const sideRotation = (stream.side_data_list || []).find(item => Number.isFinite(Number(item.rotation)))?.rotation;
  const rotation = Number(sideRotation ?? stream.tags?.rotate ?? 0);
  return { duration:Number.isFinite(duration)&&duration>0?duration:null,width:Number.isInteger(width)&&width>0?width:null,height:Number.isInteger(height)&&height>0?height:null,rotation:Number.isFinite(rotation)?rotation:0,codec_name:stream.codec_name||null,format_name:parsed.format?.format_name||null,creation_time:validDateIso(stream.tags?.creation_time||parsed.format?.tags?.creation_time) };
}

async function runFfmpeg(args) {
  return execFileAsync(ffmpegPath, args, { timeout: 180000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
}

async function createVideoPoster(inputPath, outputPath) {
  const scale = "scale=w='if(gt(iw,ih),trunc(min(1280,iw)/2)*2,-2)':h='if(gt(iw,ih),-2,trunc(min(1280,ih)/2)*2)'";
  try { await runFfmpeg(["-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", "-vf", scale, "-q:v", "3", outputPath]); }
  catch { await runFfmpeg(["-y", "-i", inputPath, "-frames:v", "1", "-vf", scale, "-q:v", "3", outputPath]); }
  const stat = await fs.stat(outputPath); if (!stat.size) throw new Error("ffmpeg generó un poster vacío.");
  return { size:stat.size, metadata:await probeVideoFile(outputPath) };
}

async function createVideoPreview(inputPath, outputPath) {
  const scale = "scale=w='if(gt(iw,ih),trunc(min(720,iw)/2)*2,-2)':h='if(gt(iw,ih),-2,trunc(min(720,ih)/2)*2)'";
  await runFfmpeg(["-y", "-i", inputPath, "-t", "3", "-an", "-vf", scale, "-r", "25", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath]);
  const stat = await fs.stat(outputPath); if (!stat.size) throw new Error("ffmpeg generó un preview vacío.");
  return { size:stat.size, metadata:await probeVideoFile(outputPath) };
}

async function loadPhoto(photoId) {
  const row = (await query(`SELECT p.id,p.family_id,p.original_filename,p.mime_type,p.duration_seconds,p.width,p.height,p.orientation,p.captured_at,p.captured_at_source,original.bucket,original.object_key,original.mime_type AS original_mime_type,poster.object_key AS poster_key,thumbnail.object_key AS thumbnail_key,preview.object_key AS preview_key FROM public.orange_photos p JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original' LEFT JOIN public.orange_photo_files poster ON poster.photo_id=p.id AND poster.variant='poster' LEFT JOIN public.orange_photo_files thumbnail ON thumbnail.photo_id=p.id AND thumbnail.variant='thumbnail' LEFT JOIN public.orange_photo_files preview ON preview.photo_id=p.id AND preview.variant='preview' WHERE p.id=$1::uuid AND p.media_type='video'`, [photoId])).rows[0];
  if (!row) throw new Error("Vídeo registrado no encontrado o sin original.");
  return row;
}

async function register(row, metadata, derivatives, updateMetadata, possibleOrphans) {
  let client = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    for (const derivative of derivatives) {
      const inserted = await query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL) ON CONFLICT(photo_id,variant) DO NOTHING RETURNING id`, [row.family_id,row.id,derivative.variant,derivative.upload.provider,derivative.upload.bucket,derivative.upload.object_key,derivative.mime_type,derivative.metadata.width,derivative.metadata.height,derivative.upload.size_bytes,derivative.upload.checksum_sha256], client);
      if (!inserted.rowCount) throw new Error(`La variante ${derivative.variant} ya existe; el objeto subido queda como posible huérfano.`);
    }
    if (updateMetadata) await query(`UPDATE public.orange_photos SET duration_seconds=CASE WHEN duration_seconds IS NULL OR duration_seconds<=0 THEN $1 ELSE duration_seconds END,width=COALESCE(width,$2),height=COALESCE(height,$3),orientation=COALESCE(orientation,$4),captured_at=CASE WHEN $5::timestamptz IS NOT NULL AND captured_at_source IN ('upload_date','file_mtime','unknown') THEN $5::timestamptz ELSE captured_at END,captured_at_source=CASE WHEN $5::timestamptz IS NOT NULL AND captured_at_source IN ('upload_date','file_mtime','unknown') THEN 'exif' ELSE captured_at_source END WHERE id=$6::uuid AND family_id=$7::uuid`, [metadata.duration,metadata.width,metadata.height,metadata.rotation,metadata.creation_time,row.id,row.family_id], client);
    await client.query("COMMIT");
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    possibleOrphans.push(...derivatives.map(item => item.upload.object_key));
    throw error;
  } finally { client?.release(); }
}

async function processStoredOrangePhotoVideo(photoId, options = {}) {
  const createPoster = options.createPoster !== false, createPreview = options.createPreview !== false, updateMetadata = options.updateMetadata !== false, dryRun = options.dryRun === true;
  const row = await loadPhoto(photoId), needsPoster = createPoster && !row.poster_key && !row.thumbnail_key, needsPreview = createPreview && !row.preview_key;
  const actions = { update_metadata:updateMetadata&&(!(Number(row.duration_seconds)>0)||!row.width||!row.height||["upload_date","file_mtime","unknown"].includes(row.captured_at_source)),create_poster:needsPoster,create_preview:needsPreview };
  if (dryRun && !options.validateDerivatives) return { photo:row,actions,metadata:null,created:[],possible_orphans:[] };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orange-photos-video-")), extension = path.extname(row.original_filename || row.object_key) || ".video", inputPath = path.join(tempDir, `original${extension}`), posterPath = path.join(tempDir, "poster.jpg"), previewPath = path.join(tempDir, "preview.mp4"), possibleOrphans = [];
  try {
    await fs.writeFile(inputPath, await getOrangePhotoObjectBuffer(row.object_key));
    const metadata = await probeVideoFile(inputPath); if (!metadata.duration || !metadata.width || !metadata.height) throw new Error("ffprobe no devolvió metadatos válidos.");
    const generated = [];
    if (needsPoster) generated.push({ variant:"poster",path:posterPath,mime_type:"image/jpeg",extension:"jpg",...(await createVideoPoster(inputPath,posterPath)) });
    if (needsPreview) generated.push({ variant:"preview",path:previewPath,mime_type:"video/mp4",extension:"mp4",...(await createVideoPreview(inputPath,previewPath)) });
    if (dryRun) return { photo:row,actions,metadata,created:generated.map(item=>({variant:item.variant,size:item.size,width:item.metadata.width,height:item.metadata.height})),possible_orphans:[] };
    const derivatives = [];
    try {
      for (const item of generated) {
        const buffer = await fs.readFile(item.path), upload = await uploadOrangePhotoToWasabi(buffer, { familyId:row.family_id,mimeType:item.mime_type,extension:item.extension,originalFilename:`${row.original_filename || row.id}-${item.variant}.${item.extension}`,variant:item.variant });
        derivatives.push({ ...item, upload });
      }
      await register(row,metadata,derivatives,updateMetadata,possibleOrphans);
    } catch (error) {
      const uploadedKeys = derivatives.map(item => item.upload.object_key);
      error.possibleOrphans = [...new Set([...possibleOrphans, ...uploadedKeys])];
      throw error;
    }
    return { photo:row,actions,metadata,created:derivatives.map(item=>({variant:item.variant,object_key:item.upload.object_key,size:item.upload.size_bytes,width:item.metadata.width,height:item.metadata.height})),possible_orphans:[] };
  } finally { await fs.rm(tempDir,{recursive:true,force:true}); }
}

module.exports = { probeVideoFile, createVideoPoster, createVideoPreview, processStoredOrangePhotoVideo };
