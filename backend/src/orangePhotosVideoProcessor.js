/* global require, module */
const fs = require("node:fs/promises");
const fsNative = require("node:fs");
const { createHash } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;
const pool = require("../db");
const { getOrangePhotoObjectStream, uploadOrangePhotoToWasabi, uploadOrangePhotoFileToWasabi } = require("./wasabiClient");
const { createImageDerivative } = require("./orangePhotosImageProcessor");

const execFileAsync = promisify(execFile);
const QUERY_TIMEOUT = 15000;
const VIDEO_THUMBNAIL_MAX_SIDE = 480;
const VIDEO_PLAYBACK_LANDSCAPE_MAX_WIDTH = 1920;
const VIDEO_PLAYBACK_LANDSCAPE_MAX_HEIGHT = 1080;
const VIDEO_PLAYBACK_PORTRAIT_MAX_WIDTH = 1080;
const VIDEO_PLAYBACK_PORTRAIT_MAX_HEIGHT = 1920;
const VIDEO_PLAYBACK_MAX_FPS = 30;
const validDateIso = value => { if (value == null || value === "") return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString(); };
async function sha256File(filePath) { const hash = createHash("sha256"); for await (const chunk of fsNative.createReadStream(filePath)) hash.update(chunk); return hash.digest("hex"); }
async function videoPhase(row, phase, failureMessage, work) {
  const started = Date.now();
  try {
    const result = await work();
    console.info("OrangePhotos video processing", { photo_id:row.id,phase,duration_ms:Date.now()-started,object_key:row.object_key,message:"completed" });
    return result;
  } catch (error) {
    console.error("OrangePhotos video processing", { photo_id:row.id,phase,duration_ms:Date.now()-started,object_key:row.object_key,message:error?.message||failureMessage });
    throw new Error(failureMessage, { cause:error });
  }
}

async function query(text, values = [], client = pool) {
  return client.query({ text, values, query_timeout: QUERY_TIMEOUT });
}

async function probeVideoFile(filePath) {
  const { stdout } = await execFileAsync(ffprobePath, ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath], { timeout: 120000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const parsed = JSON.parse(stdout), stream = (parsed.streams || []).find(item => item.codec_type === "video");
  if (!stream) throw new Error("ffprobe no encontrÃ³ una pista de vÃ­deo.");
  const duration = Number(stream.duration || parsed.format?.duration), width = Number(stream.width), height = Number(stream.height);
  const sideRotation = (stream.side_data_list || []).find(item => Number.isFinite(Number(item.rotation)))?.rotation;
  const rotation = Number(sideRotation ?? stream.tags?.rotate ?? 0);
  return { duration:Number.isFinite(duration)&&duration>0?duration:null,width:Number.isInteger(width)&&width>0?width:null,height:Number.isInteger(height)&&height>0?height:null,rotation:Number.isFinite(rotation)?rotation:0,codec_name:stream.codec_name||null,format_name:parsed.format?.format_name||null,creation_time:validDateIso(stream.tags?.creation_time||parsed.format?.tags?.creation_time) };
}

async function runFfmpeg(args, timeout = 180000) {
  return execFileAsync(ffmpegPath, args, { timeout, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
}

async function createVideoPoster(inputPath, outputPath) {
  const scale = "scale=w='if(gt(iw,ih),trunc(min(1280,iw)/2)*2,-2)':h='if(gt(iw,ih),-2,trunc(min(1280,ih)/2)*2)'";
  try { await runFfmpeg(["-y", "-ss", "1", "-i", inputPath, "-frames:v", "1", "-vf", scale, "-q:v", "3", outputPath]); }
  catch { await runFfmpeg(["-y", "-i", inputPath, "-frames:v", "1", "-vf", scale, "-q:v", "3", outputPath]); }
  const stat = await fs.stat(outputPath); if (!stat.size) throw new Error("ffmpeg generÃ³ un poster vacÃ­o.");
  return { size:stat.size, metadata:await probeVideoFile(outputPath) };
}

async function createVideoThumbnail(posterPath, outputPath) {
  return createImageDerivative(posterPath, outputPath, {
    maxSide: VIDEO_THUMBNAIL_MAX_SIDE,
    format: { mimeType: "image/jpeg", extension: "jpg" },
    quality: "thumbnail",
  });
}

async function createVideoPreview(inputPath, outputPath) {
  const scale = "scale=w='if(gt(iw,ih),trunc(min(720,iw)/2)*2,-2)':h='if(gt(iw,ih),-2,trunc(min(720,ih)/2)*2)'";
  await runFfmpeg(["-y", "-i", inputPath, "-t", "3", "-an", "-vf", scale, "-r", "25", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath]);
  const stat = await fs.stat(outputPath); if (!stat.size) throw new Error("ffmpeg generÃ³ un preview vacÃ­o.");
  return { size:stat.size, metadata:await probeVideoFile(outputPath) };
}

async function createVideoPlayback(inputPath, outputPath) {
  const scale = `scale=` + `w='if(gte(iw,ih),min(${VIDEO_PLAYBACK_LANDSCAPE_MAX_WIDTH},iw),min(${VIDEO_PLAYBACK_PORTRAIT_MAX_WIDTH},iw))':` + `h='if(gte(iw,ih),min(${VIDEO_PLAYBACK_LANDSCAPE_MAX_HEIGHT},ih),min(${VIDEO_PLAYBACK_PORTRAIT_MAX_HEIGHT},ih))':` + `force_original_aspect_ratio=decrease:` + `force_divisible_by=2`;
  await runFfmpeg(["-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a:0?", "-vf", scale, "-fpsmax", String(VIDEO_PLAYBACK_MAX_FPS), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", outputPath], 30 * 60 * 1000);
  const stat = await fs.stat(outputPath);
  if (!stat.size) throw new Error("ffmpeg generó un playback vacío.");
  return { size: stat.size, metadata: await probeVideoFile(outputPath) };
}

async function loadPhoto(photoId) {
  const row = (await query(`SELECT p.id,p.family_id,p.original_filename,p.mime_type,p.duration_seconds,p.width,p.height,p.orientation,p.captured_at,p.captured_at_source,original.bucket,original.object_key,original.mime_type AS original_mime_type,poster.object_key AS poster_key,poster.bucket AS poster_bucket,thumbnail.object_key AS thumbnail_key,preview.object_key AS preview_key,playback.object_key AS playback_key FROM public.orange_photos p JOIN public.orange_photo_files original ON original.photo_id=p.id AND original.variant='original' LEFT JOIN public.orange_photo_files poster ON poster.photo_id=p.id AND poster.variant='poster' LEFT JOIN public.orange_photo_files thumbnail ON thumbnail.photo_id=p.id AND thumbnail.variant='thumbnail' LEFT JOIN public.orange_photo_files preview ON preview.photo_id=p.id AND preview.variant='preview' LEFT JOIN public.orange_photo_files playback ON playback.photo_id=p.id AND playback.variant='playback' WHERE p.id=$1::uuid AND p.media_type='video'`, [photoId])).rows[0];
  if (!row) throw new Error("VÃ­deo registrado no encontrado o sin original.");
  return row;
}

async function register(row, metadata, derivatives, updateMetadata, possibleOrphans) {
  let client = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    for (const derivative of derivatives) {
      const inserted = await query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL) ON CONFLICT(photo_id,variant) DO NOTHING RETURNING id`, [row.family_id,row.id,derivative.variant,derivative.upload.provider,derivative.upload.bucket,derivative.upload.object_key,derivative.mime_type,derivative.metadata.width,derivative.metadata.height,derivative.upload.size_bytes,derivative.upload.checksum_sha256], client);
      if (!inserted.rowCount) throw new Error(`La variante ${derivative.variant} ya existe; el objeto subido queda como posible huÃ©rfano.`);
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
  const replacePoster = options.replacePoster === true, createPoster = options.createPoster !== false, createThumbnail = options.createThumbnail !== false && !replacePoster, createPreview = options.createPreview !== false, createPlayback = options.createPlayback === true, updateMetadata = options.updateMetadata !== false, dryRun = options.dryRun === true;
  const row = await loadPhoto(photoId), needsPoster = createPoster && (replacePoster || (!row.poster_key && !row.thumbnail_key)), needsThumbnail = createThumbnail && !row.thumbnail_key && Boolean(row.poster_key || needsPoster), needsPreview = createPreview && !row.preview_key, needsPlayback = createPlayback && !row.playback_key, shouldUpdateMetadata = updateMetadata && (!(Number(row.duration_seconds)>0)||!row.width||!row.height||["upload_date","file_mtime","unknown"].includes(row.captured_at_source)), needsOriginal = needsPoster || needsPreview || needsPlayback || shouldUpdateMetadata;
  const actions = { update_metadata:shouldUpdateMetadata,create_poster:needsPoster,create_thumbnail:needsThumbnail,create_preview:needsPreview,create_playback:needsPlayback };
  if (dryRun && !options.validateDerivatives) return { photo:row,actions,metadata:null,created:[],possible_orphans:[] };
  if (!needsOriginal && !needsThumbnail) return { photo:row,actions,metadata:null,created:[],possible_orphans:[] };
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orange-photos-video-")), extension = path.extname(row.original_filename || row.object_key) || ".video", inputPath = path.join(tempDir, `original${extension}`), posterPath = path.join(tempDir, "poster.jpg"), thumbnailPath = path.join(tempDir, "thumbnail.jpg"), previewPath = path.join(tempDir, "preview.mp4"), playbackPath = path.join(tempDir, "playback.mp4"), possibleOrphans = [];
  try {
    let metadata = null;
    if (needsOriginal) await videoPhase(row,"download_original","No se pudo descargar el vÃ­deo original.",async()=>{const source=await getOrangePhotoObjectStream({bucket:row.bucket,object_key:row.object_key});await pipeline(source.Body,fsNative.createWriteStream(inputPath));});
    if (shouldUpdateMetadata) metadata = await videoPhase(row,"probe_video","No se pudieron leer los metadatos del vÃ­deo.",async()=>{const probed=await probeVideoFile(inputPath);if(!probed.duration||!probed.width||!probed.height)throw new Error("ffprobe no devolviÃ³ metadatos vÃ¡lidos.");return probed;});
    const generated = [];
    if (needsPoster) generated.push({ variant:"poster",path:posterPath,mime_type:"image/jpeg",extension:"jpg",...(await videoPhase(row,"generate_poster","ffmpeg no pudo generar la miniatura.",()=>createVideoPoster(inputPath,posterPath))) });
    if (needsThumbnail) { if (!needsPoster) await videoPhase(row,"download_poster","No se pudo descargar el poster del vÃ­deo.",async()=>{const source=await getOrangePhotoObjectStream({bucket:row.poster_bucket,object_key:row.poster_key});await pipeline(source.Body,fsNative.createWriteStream(posterPath));}); generated.push({ variant:"thumbnail",path:thumbnailPath,mime_type:"image/jpeg",extension:"jpg",...(await videoPhase(row,"generate_thumbnail","No se pudo generar el thumbnail del vÃ­deo.",()=>createVideoThumbnail(posterPath,thumbnailPath))) }); }
    if (needsPreview) generated.push({ variant:"preview",path:previewPath,mime_type:"video/mp4",extension:"mp4",...(await createVideoPreview(inputPath,previewPath)) });
    if (needsPlayback) generated.push({ variant:"playback",path:playbackPath,mime_type:"video/mp4",extension:"mp4",...(await videoPhase(row,"generate_playback","No se pudo generar el playback del vídeo.",()=>createVideoPlayback(inputPath,playbackPath))) });
    if (dryRun) return { photo:row,actions,metadata,created:generated.map(item=>({variant:item.variant,size:item.size,width:item.metadata.width,height:item.metadata.height})),possible_orphans:[] };
    const derivatives = [];
    try {
      for (const item of generated) {
        const upload = item.variant === "playback"
          ? await uploadOrangePhotoFileToWasabi(item.path, { familyId:row.family_id, photoId:row.id, mimeType:item.mime_type, extension:item.extension, originalFilename:`${row.original_filename || row.id}-${item.variant}.${item.extension}`, sizeBytes:item.size, checksumSha256:await sha256File(item.path), variant:item.variant })
          : await (async () => { const buffer = await fs.readFile(item.path); return item.variant==="poster"?await videoPhase(row,"upload_poster","No se pudo guardar la miniatura.",()=>uploadOrangePhotoToWasabi(buffer, { familyId:row.family_id,photoId:item.variant==="thumbnail"?row.id:undefined,mimeType:item.mime_type,extension:item.extension,originalFilename:`${row.original_filename || row.id}-${item.variant}.${item.extension}`,variant:item.variant })):await uploadOrangePhotoToWasabi(buffer, { familyId:row.family_id,photoId:item.variant==="thumbnail"?row.id:undefined,mimeType:item.mime_type,extension:item.extension,originalFilename:`${row.original_filename || row.id}-${item.variant}.${item.extension}`,variant:item.variant }); })();
        derivatives.push({ ...item, upload });
      }
      if (!replacePoster) await videoPhase(row,"replace_database_record",needsPoster&&!needsPreview?"No se pudo registrar la nueva miniatura.":"No se pudieron registrar los derivados del vÃ­deo.",()=>register(row,metadata,derivatives,shouldUpdateMetadata,possibleOrphans));
    } catch (error) {
      const uploadedKeys = derivatives.map(item => item.upload.object_key);
      error.possibleOrphans = [...new Set([...possibleOrphans, ...uploadedKeys])];
      throw error;
    }
    return { photo:row,actions,metadata,created:derivatives.map(item=>({variant:item.variant,provider:item.upload.provider,bucket:item.upload.bucket,object_key:item.upload.object_key,mime_type:item.mime_type,size_bytes:item.upload.size_bytes,checksum_sha256:item.upload.checksum_sha256,etag:item.upload.etag||null,width:item.metadata.width,height:item.metadata.height})),possible_orphans:[] };
  } finally { await fs.rm(tempDir,{recursive:true,force:true}); }
}

module.exports = { probeVideoFile, createVideoPoster, createVideoPreview, createVideoPlayback, processStoredOrangePhotoVideo };
