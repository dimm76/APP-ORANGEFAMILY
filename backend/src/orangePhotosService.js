/* eslint-disable no-useless-assignment, no-unused-vars */
/* global require, module */
const pool = require("../db");
const fs = require("node:fs/promises");
const fsNative = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { resolveAuthenticatedFamily } = require("./attachmentsService");
const { clientContext } = require("./orangePhotosClientContext");
const { assertReadableOrangePhotosStorageKey, deleteOrangePhotoObject, getSignedOrangePhotoUrl, getOrangePhotoObjectStream, uploadOrangePhotoFileToWasabi, uploadOrangePhotoToWasabi } = require("./wasabiClient");
const { getAttachmentsConfig } = require("./attachmentsConfig");
const { probeVideoFile, createVideoPoster, processStoredOrangePhotoVideo } = require("./orangePhotosVideoProcessor");
const exifr = require("exifr");

const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISIBILITIES=new Set(["private","family","selected"]); const MEDIA_TYPES=new Set(["image","video"]);
const LIBRARY_SCOPES=new Set(["all","owned","shared_with_me","shared_by_me"]);
const SHARE_SCOPES=new Set(["all","family","selected"]);
const MIME_EXT={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"heic","video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm"};
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
const SIMPLE_VIDEO_MAX_BYTES = 500 * 1024 * 1024;
const MAX_VIDEO_BYTES = 10 * 1024 * 1024 * 1024;
const MULTIPART_PART_BYTES = 25 * 1024 * 1024;
const MULTIPART_UPLOAD_TTL_HOURS = 24;
const MAX_ZIP_DOWNLOAD_ITEMS = 500;
const SHA256_RE=/^[0-9a-f]{64}$/;
const ok=payload=>({ok:true,payload});
const bad=(status,code,reason,details=null)=>{
  if(reason==null){reason=code;code=status===404?"UPLOAD_NOT_FOUND":status===413?"FILE_TOO_LARGE":"INVALID_METADATA";}
  return {ok:false,status,code,reason,details};
};
const uuid=v=>UUID_RE.test(String(v||"").trim()); const text=(v,n=500)=>v==null?null:String(v).trim().slice(0,n)||null;
const number=value=>{if(value==null||value==="")return null;const parsed=Number(value);return Number.isFinite(parsed)?parsed:null;}; const bool=v=>v===true||v==="true"||v===1||v==="1";
const dateIso=value=>{if(value==null||value==="")return null;const parsed=new Date(value);return Number.isNaN(parsed.getTime())?null:parsed.toISOString();};
const visibilitySql=(alias="p")=>`(${alias}.owner_user_id=$2::uuid OR ${alias}.visibility='family' OR (${alias}.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_shares s WHERE s.photo_id=${alias}.id AND s.user_id=$2::uuid)) OR EXISTS(SELECT 1 FROM public.orange_photo_album_items ai_access JOIN public.orange_photo_albums a_access ON a_access.id=ai_access.album_id AND a_access.family_id=${alias}.family_id AND a_access.is_archived=false WHERE ai_access.photo_id=${alias}.id AND (a_access.owner_user_id=$2::uuid OR a_access.visibility='family' OR (a_access.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_album_shares ash_access WHERE ash_access.album_id=a_access.id AND ash_access.user_id=$2::uuid)))))`;
const albumVisibilitySql=(alias="a")=>`(${alias}.owner_user_id=$2::uuid OR ${alias}.visibility='family' OR (${alias}.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_album_shares s WHERE s.album_id=${alias}.id AND s.user_id=$2::uuid)))`;

async function recordPhotoEvent(client,{familyId,photoId=null,actorUserId=null,eventType,clientType="web",installationId=null,metadata={}}){
  await client.query(`INSERT INTO public.orange_photo_events(family_id,photo_id,actor_user_id,event_type,client_type,installation_id,metadata) VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb)`,[familyId,photoId,actorUserId,eventType,clientType,installationId,JSON.stringify(metadata||{})]);
}
async function recordDecisionEvent(auth,context,eventType,checksum,photoId=null){
  if(context.clientType!=="android_sync")return;
  await pool.query(`INSERT INTO public.orange_photo_events(family_id,photo_id,actor_user_id,event_type,client_type,installation_id,metadata) SELECT $1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7::jsonb WHERE NOT EXISTS(SELECT 1 FROM public.orange_photo_events e WHERE e.family_id=$1::uuid AND e.actor_user_id=$3::uuid AND e.installation_id IS NOT DISTINCT FROM $6 AND e.photo_id IS NOT DISTINCT FROM $2::uuid AND e.event_type=$4 AND e.metadata->>'checksum_sha256'=$8)`,[auth.familyId,photoId,auth.userId,eventType,context.clientType,context.installationId,JSON.stringify({checksum_sha256:checksum,decision:eventType==="duplicate_resolved"?"already_owned":eventType==="upload_suppressed"?"suppressed":"restore_available"}),checksum]);
}

async function memberIds(familyId, ids){
  const unique=[...new Set((ids||[]).map(String).filter(uuid))]; if(!unique.length)return [];
  const r=await pool.query(`SELECT au.id::text FROM public.auth_users au JOIN public.family_memberships fm ON fm.person_id=au.person_id AND fm.status='active' WHERE fm.family_id=$1::uuid AND au.status='active' AND au.id=ANY($2::uuid[])`,[familyId,unique]);
  if(r.rows.length!==unique.length) throw Object.assign(new Error("Uno o más usuarios no pertenecen a la familia."),{status:400}); return unique;
}
async function familyMembers(req){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;const r=await pool.query(`SELECT au.id,COALESCE(NULLIF(btrim(p.preferred_name),''),btrim(concat_ws(' ',p.first_name,p.last_name)),au.email) display_name,fm.role FROM public.auth_users au JOIN public.persons p ON p.id=au.person_id JOIN public.family_memberships fm ON fm.person_id=p.id WHERE fm.family_id=$1::uuid AND fm.status='active' AND au.status='active' ORDER BY display_name`,[a.familyId]);return ok({items:r.rows});}

function imageDimensions(buffer,mime){try{if(mime==='image/png'&&buffer.length>=24)return{width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};if(mime==='image/webp'&&buffer.length>=30&&buffer.toString('ascii',12,16)==='VP8X')return{width:1+buffer.readUIntLE(24,3),height:1+buffer.readUIntLE(27,3)};if(mime==='image/jpeg'){let o=2;while(o+9<buffer.length){if(buffer[o]!==255){o++;continue;}const m=buffer[o+1],l=buffer.readUInt16BE(o+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(m))return{width:buffer.readUInt16BE(o+7),height:buffer.readUInt16BE(o+5)};if(l<2)break;o+=2+l;}}}catch{/* optional */}return{width:null,height:null};}
function normalizeMetadata(body={},file={}){const m=body.metadata||body;const mime=String(file.mimeType||m.mime_type||"").toLowerCase();const media=String(m.media_type||mime.split('/')[0]);const manualCaptured=dateIso(m.captured_at),fileModified=dateIso(m.file_last_modified_at),capturedAt=manualCaptured||fileModified||new Date().toISOString();return{media_type:media,original_filename:text(file.filename||m.original_filename,500),mime_type:mime,extension:text(m.extension||MIME_EXT[mime],20),title:text(m.title),description:text(m.description,5000),captured_at:capturedAt,captured_at_source:manualCaptured?'manual':fileModified?'file_mtime':'upload_date',timezone:text(m.timezone,100),width:number(m.width),height:number(m.height),duration_seconds:number(m.duration_seconds),orientation:number(m.orientation),camera_make:text(m.camera_make,200),camera_model:text(m.camera_model,200),lens_model:text(m.lens_model,200),latitude:number(m.latitude),longitude:number(m.longitude),altitude_meters:number(m.altitude_meters),location_name:text(m.location_name),location_country:text(m.location_country,200),location_region:text(m.location_region,200),location_locality:text(m.location_locality,200),location_source:m.location_source||((m.latitude!=null||m.longitude!=null||m.location_name)?'manual':null),visibility:m.visibility||'private',exif_json:{}};}

async function applyExifMetadata(buffer,m){if(m.media_type!=="image")return;let raw;try{raw=await exifr.parse(buffer,{tiff:true,exif:true,gps:true,ifd0:true,ifd1:false,icc:false,iptc:false,jfif:false,xmp:false,translateValues:false,reviveValues:true,sanitize:true});}catch{return;}if(!raw)return;const picked={};for(const key of ["DateTimeOriginal","CreateDate","ModifyDate","Orientation","Make","Model","LensModel","GPSLatitude","GPSLongitude","GPSAltitude","latitude","longitude","ImageWidth","ImageHeight","ExifImageWidth","ExifImageHeight"]){const value=raw[key];if(value!=null)picked[key]=value instanceof Date?value.toISOString():value;}const captured=dateIso(raw.DateTimeOriginal)||dateIso(raw.CreateDate);if(captured&&m.captured_at_source!=="manual"){m.captured_at=captured;m.captured_at_source="exif";}const orientation=number(raw.Orientation);if(Number.isInteger(orientation)&&orientation>=1&&orientation<=8)m.orientation=orientation;m.camera_make=text(raw.Make,200)||m.camera_make;m.camera_model=text(raw.Model,200)||m.camera_model;m.lens_model=text(raw.LensModel,200)||m.lens_model;const latitude=number(raw.latitude??raw.GPSLatitude),longitude=number(raw.longitude??raw.GPSLongitude);if(Number.isFinite(latitude))m.latitude=latitude;if(Number.isFinite(longitude))m.longitude=longitude;m.altitude_meters=number(raw.GPSAltitude)??m.altitude_meters;let width=number(raw.ExifImageWidth??raw.ImageWidth),height=number(raw.ExifImageHeight??raw.ImageHeight);width=Number.isInteger(width)&&width>0?width:null;height=Number.isInteger(height)&&height>0?height:null;if(width&&height&&[5,6,7,8].includes(m.orientation)){[width,height]=[height,width];}m.width=width||m.width;m.height=height||m.height;if(m.latitude!=null&&m.longitude!=null)m.location_source="exif";m.exif_json=picked;}
async function applyStoredImageMetadata(buffer,m){const d=imageDimensions(buffer,m.mime_type);m.width=m.width||d.width;m.height=m.height||d.height;await applyExifMetadata(buffer,m);return m;}
function applyVideoCreationTime(metadata,m){const captured=dateIso(metadata?.creation_time);if(captured&&m.captured_at_source!=="manual"){m.captured_at=captured;m.captured_at_source="exif";}}
function validateMetadata(m){if(!MEDIA_TYPES.has(m.media_type)||!MIME_EXT[m.mime_type])return bad(400,"UNSUPPORTED_FILE_TYPE","Tipo de archivo no permitido.");if(!m.original_filename)return bad(400,"INVALID_METADATA","Nombre original obligatorio.");if(!VISIBILITIES.has(m.visibility))return bad(400,"INVALID_METADATA","Visibilidad no válida.");if(m.latitude!=null&&(m.latitude < -90||m.latitude>90)||m.longitude!=null&&(m.longitude < -180||m.longitude>180))return bad(400,"INVALID_METADATA","Coordenadas no válidas.");return null;}

function normalizeDuplicateFilename(value) {
  return path.basename(String(value || "").replace(/\\/g, "/")).trim().toLowerCase().normalize("NFKC").replace(/\s+/g, " ");
}

async function findPossibleDuplicate(familyId, ownerUserId, originalFilename, sizeBytes) {
  const normalized = normalizeDuplicateFilename(originalFilename);
  if (!uuid(ownerUserId) || !normalized || !Number.isSafeInteger(Number(sizeBytes)) || Number(sizeBytes) <= 0) return null;
  const result = await pool.query(`SELECT p.id photo_id,p.original_filename,f.size_bytes,p.captured_at,p.created_at,p.is_trashed FROM public.orange_photos p JOIN public.orange_photo_files f ON f.photo_id=p.id AND f.family_id=p.family_id AND f.variant='original' WHERE p.family_id=$1::uuid AND p.owner_user_id=$2::uuid AND lower(p.original_filename)=$3 AND f.size_bytes=$4::bigint ORDER BY p.created_at DESC LIMIT 1`,[familyId,ownerUserId,normalized,String(sizeBytes)]);
  return result.rows[0] || null;
}

async function findExactDuplicate(familyId, ownerUserId, checksumSha256) {
  const checksum = String(checksumSha256 || "").trim().toLowerCase();
  if (!uuid(ownerUserId) || !SHA256_RE.test(checksum)) return null;
  const result = await pool.query(`SELECT p.id photo_id,p.original_filename,f.size_bytes,f.checksum_sha256,p.captured_at,p.created_at,p.is_trashed FROM public.orange_photo_files f JOIN public.orange_photos p ON p.id=f.photo_id AND p.family_id=f.family_id WHERE p.family_id=$1::uuid AND p.owner_user_id=$2::uuid AND f.variant='original' AND f.checksum_sha256=$3 ORDER BY p.is_trashed ASC,p.created_at DESC LIMIT 1`,[familyId,ownerUserId,checksum]);
  return result.rows[0] || null;
}

async function findUploadSuppression(familyId, ownerUserId, checksumSha256) {
  const checksum=String(checksumSha256||"").trim().toLowerCase();
  if(!uuid(ownerUserId)||!SHA256_RE.test(checksum))return null;
  const result=await pool.query(`SELECT checksum_sha256,deleted_at FROM public.orange_photo_upload_suppressions WHERE family_id=$1::uuid AND owner_user_id=$2::uuid AND checksum_sha256=$3`,[familyId,ownerUserId,checksum]);
  return result.rows[0]||null;
}

function uploadCheckDecision(duplicate,suppression) {
  if(duplicate&&!duplicate.is_trashed)return{decision:"already_owned",photo_id:duplicate.photo_id};
  if(duplicate)return{decision:"restore_available",photo_id:duplicate.photo_id};
  if(suppression)return{decision:"suppressed"};
  return{decision:"upload_required"};
}

function uploadModeFor(mimeType, sizeBytes) {
  const mime = String(mimeType || "").trim().toLowerCase(), size = Number(sizeBytes), mediaType = mime.split("/")[0];
  if (!MIME_EXT[mime] || !MEDIA_TYPES.has(mediaType)) return bad(400,"UNSUPPORTED_FILE_TYPE","Tipo de archivo no permitido.");
  if (!Number.isSafeInteger(size) || size <= 0) return bad(400,"EMPTY_FILE","El archivo está vacío.");
  if (mediaType === "image" && size > MAX_IMAGE_BYTES) return bad(413,"FILE_TOO_LARGE","La imagen supera el límite máximo de 30 MB.");
  if (mediaType === "video" && size > MAX_VIDEO_BYTES) return bad(413,"FILE_TOO_LARGE","El vídeo supera el límite máximo de 10 GB.");
  return ok({ upload_mode:mediaType === "video" && size > SIMPLE_VIDEO_MAX_BYTES ? "multipart" : "simple" });
}

async function checkUpload(req, body = {}) {
  const a=resolveAuthenticatedFamily(req); if(!a.ok)return a;
  const context=clientContext(req);
  const filename=normalizeDuplicateFilename(body.original_filename), size=Number(body.size_bytes), mime=String(body.mime_type||"").toLowerCase();
  if(!filename)return bad(400,"INVALID_METADATA","Nombre original obligatorio.");
  const mode=uploadModeFor(mime,size); if(!mode.ok)return mode;
  const uploadMode=mode.payload.upload_mode==="multipart"?"direct_backend":mode.payload.upload_mode;
  const limits={max_image_bytes:MAX_IMAGE_BYTES,simple_video_max_bytes:SIMPLE_VIDEO_MAX_BYTES,max_video_bytes:MAX_VIDEO_BYTES,multipart_part_bytes:MULTIPART_PART_BYTES};
  if(Object.prototype.hasOwnProperty.call(body,"checksum_sha256")){
    const checksum=String(body.checksum_sha256||"").trim().toLowerCase();
    if(!SHA256_RE.test(checksum))return bad(400,"INVALID_METADATA","Checksum SHA-256 no válido.");
    const duplicate=await findExactDuplicate(a.familyId,a.userId,checksum);
    const suppression=duplicate?null:await findUploadSuppression(a.familyId,a.userId,checksum);
    const decision=bool(body.force_duplicate)?{decision:"upload_required"}:uploadCheckDecision(duplicate,suppression);
    if(decision.decision==="already_owned")await recordDecisionEvent(a,context,"duplicate_resolved",checksum,decision.photo_id);
    if(decision.decision==="suppressed")await recordDecisionEvent(a,context,"upload_suppressed",checksum);
    if(decision.decision==="restore_available")await recordDecisionEvent(a,context,"restore_available_detected",checksum,decision.photo_id);
    return ok({...decision,upload_mode:uploadMode,limits});
  }
  const possible=await findPossibleDuplicate(a.familyId,a.userId,filename,size);
  return ok({possible_duplicate:possible,upload_mode:uploadMode,limits});
}

async function checkStorageStatus(req, body = {}) {
  const auth = resolveAuthenticatedFamily(req);
  if (!auth.ok) return auth;
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 200) {
    return bad(400, "INVALID_METADATA", "items debe contener entre 1 y 200 elementos.");
  }
  const items = [];
  for (const raw of body.items) {
    const item = {
      clientId: String(raw?.client_id || "").trim(),
      algorithm: String(raw?.hash_algorithm || "").trim().toLowerCase(),
      hash: String(raw?.hash || "").trim().toLowerCase(),
      size: Number(raw?.size_bytes),
      displayName: raw?.display_name == null ? null : String(raw.display_name).trim(),
    };
    if (!item.clientId || item.clientId.length > 200 || item.algorithm !== "sha256" || !SHA256_RE.test(item.hash) || !Number.isSafeInteger(item.size) || item.size < 0 || (item.displayName != null && item.displayName.length > 500)) {
      return bad(400, "INVALID_METADATA", "Elemento de comprobación no válido.");
    }
    items.push(item);
  }
  const hashes = [...new Set(items.map(item => item.hash))];
  const exact = (await pool.query(`SELECT DISTINCT ON (f.checksum_sha256) f.checksum_sha256,p.id photo_id FROM public.orange_photo_files f JOIN public.orange_photos p ON p.id=f.photo_id AND p.family_id=f.family_id WHERE p.family_id=$1::uuid AND p.owner_user_id=$2::uuid AND p.is_trashed=false AND f.variant='original' AND f.checksum_sha256=ANY($3::text[]) ORDER BY f.checksum_sha256,p.created_at DESC`, [auth.familyId, auth.userId, hashes])).rows;
  const exactByHash = new Map(exact.map(row => [row.checksum_sha256, row]));
  const unresolved = items.filter(item => !exactByHash.has(item.hash) && item.displayName);
  let possible = [];
  if (unresolved.length) {
    const names = [...new Set(unresolved.map(item => item.displayName.toLowerCase()))];
    const sizes = [...new Set(unresolved.map(item => String(item.size)))];
    possible = (await pool.query(`SELECT lower(p.original_filename) normalized_name,f.size_bytes::text FROM public.orange_photos p JOIN public.orange_photo_files f ON f.photo_id=p.id AND f.family_id=p.family_id AND f.variant='original' WHERE p.family_id=$1::uuid AND p.owner_user_id=$2::uuid AND p.is_trashed=false AND lower(p.original_filename)=ANY($3::text[]) AND f.size_bytes::text=ANY($4::text[])`, [auth.familyId, auth.userId, names, sizes])).rows;
  }
  const possibleKeys = new Set(possible.map(row => `${row.normalized_name}\u0000${row.size_bytes}`));
  return ok({ items: items.map(item => {
    const match = exactByHash.get(item.hash);
    if (match) return { client_id: item.clientId, status: "backed_up", remote_photo_id: match.photo_id };
    const key = `${item.displayName?.toLowerCase() || ""}\u0000${item.size}`;
    return { client_id: item.clientId, status: possibleKeys.has(key) ? "possible_match" : "not_found", remote_photo_id: null };
  }) });
}

async function insertPhoto(auth,m,storage,poster=null,warning=null,clearSuppressionChecksum=null,context={clientType:"web",installationId:null},uploadMode="simple"){const client=await pool.connect();try{await client.query('BEGIN');const p=(await client.query(`INSERT INTO public.orange_photos(family_id,owner_user_id,media_type,title,description,original_filename,mime_type,extension,captured_at,captured_at_source,timezone,width,height,duration_seconds,orientation,camera_make,camera_model,lens_model,latitude,longitude,altitude_meters,location_name,location_country,location_region,location_locality,location_source,exif_json,visibility,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$2,$2) RETURNING *`,[auth.familyId,auth.userId,m.media_type,m.title,m.description,m.original_filename,m.mime_type,m.extension,m.captured_at,m.captured_at_source,m.timezone,m.width,m.height,m.duration_seconds,m.orientation,m.camera_make,m.camera_model,m.lens_model,m.latitude,m.longitude,m.altitude_meters,m.location_name,m.location_country,m.location_region,m.location_locality,m.location_source,m.exif_json,m.visibility])).rows[0];await client.query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,'original',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[auth.familyId,p.id,storage.provider||'wasabi',storage.bucket,storage.object_key,storage.mime_type||m.mime_type,m.width,m.height,storage.size_bytes||null,storage.checksum_sha256||null,storage.etag||null]);if(poster)await client.query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,'poster',$3,$4,$5,'image/jpeg',$6,$7,$8,$9,$10)`,[auth.familyId,p.id,poster.provider||'wasabi',poster.bucket,poster.object_key,poster.width,poster.height,poster.size_bytes||null,poster.checksum_sha256||null,poster.etag||null]);await recordPhotoEvent(client,{familyId:auth.familyId,photoId:p.id,actorUserId:auth.userId,eventType:"uploaded",...context,metadata:{media_type:m.media_type,original_filename:m.original_filename,size_bytes:storage.size_bytes??null,checksum_sha256:storage.checksum_sha256??null,upload_mode:uploadMode}});if(SHA256_RE.test(String(clearSuppressionChecksum||"")))await client.query(`DELETE FROM public.orange_photo_upload_suppressions WHERE family_id=$1::uuid AND owner_user_id=$2::uuid AND checksum_sha256=$3`,[auth.familyId,auth.userId,clearSuppressionChecksum]);await client.query('COMMIT');return ok({item:p,warning});}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
async function createFromExisting(req,body){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;if(a.role!=='owner')return bad(403,"Solo el propietario familiar puede registrar objetos existentes.");const s=body.storage||{};try{assertReadableOrangePhotosStorageKey(s.object_key,getAttachmentsConfig().envPrefix);}catch(e){return bad(400,e.message);}if(s.bucket!=='orangedesk'||s.variant!=='original')return bad(400,"Almacenamiento legacy no válido.");const m=normalizeMetadata(body);const err=validateMetadata(m);if(err)return err;return insertPhoto(a,m,{...s,provider:'wasabi',mime_type:m.mime_type});}
async function upload(req, file, fields = {}, posterFile = null) {
  const a = resolveAuthenticatedFamily(req);
  if (!a.ok) return a;
  if (!file?.buffer?.length) return bad(400, "EMPTY_FILE", "El archivo está vacío.");

  let supplied = {};
  try { supplied = fields.metadata ? JSON.parse(fields.metadata) : fields; }
  catch { return bad(400, "INVALID_METADATA", "Metadatos JSON no válidos."); }

  const m = normalizeMetadata(supplied, file);
  const err = validateMetadata(m);
  if (err) return err;
  const mode = uploadModeFor(m.mime_type,file.buffer.length); if(!mode.ok)return mode;
  if (mode.payload.upload_mode !== "simple") return bad(413,"FILE_TOO_LARGE","Los vídeos de más de 500 MB deben utilizar la subida para archivos grandes.");
  if (posterFile && (m.media_type !== "video" || posterFile.mimeType !== "image/jpeg" || posterFile.buffer.length > 2 * 1024 * 1024)) return bad(400, "INVALID_POSTER", "Póster no válido.");

  let checksumSha256;
  try { checksumSha256=createHash("sha256").update(file.buffer).digest("hex"); }
  catch(error){ console.error("OrangePhotos hash",{message:error.message}); return bad(500,"HASH_CALCULATION_FAILED","No se pudo verificar el archivo."); }
  const forceDuplicate=bool(fields.force_duplicate),duplicate=await findExactDuplicate(a.familyId,a.userId,checksumSha256);
  if(duplicate && !forceDuplicate)return bad(409,"DUPLICATE_FILE","Este archivo ya existe en OrangePhotos.",{duplicate});
  const suppression=await findUploadSuppression(a.familyId,a.userId,checksumSha256);
  if(suppression&&!forceDuplicate)return bad(409,"UPLOAD_SUPPRESSED","Este archivo fue eliminado voluntariamente y no se volverá a subir automáticamente.");

  if (m.media_type === "image") await applyStoredImageMetadata(file.buffer,m);

  let stored = null;
  let posterStored = null;
  const warnings = [];
  let tempDir = null;
  let generatedPoster = null;

  try {
    if (m.media_type === "video") {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "orange-photos-upload-"));
      const inputPath = path.join(tempDir, `original.${m.extension || "video"}`);
      const posterPath = path.join(tempDir, "poster.jpg");
      await fs.writeFile(inputPath, file.buffer);

      try {
        const metadata = await probeVideoFile(inputPath);
        m.duration_seconds = metadata.duration || m.duration_seconds;
        m.width = metadata.width || m.width;
        m.height = metadata.height || m.height;
        m.orientation = metadata.rotation ?? m.orientation;
        applyVideoCreationTime(metadata, m);
      } catch (error) {
        warnings.push("Metadatos de vídeo pendientes");
        console.warn("OrangePhotos video metadata", error.message);
      }

      try {
        const poster = await createVideoPoster(inputPath, posterPath);
        generatedPoster = {
          buffer: await fs.readFile(posterPath),
          width: poster.metadata.width,
          height: poster.metadata.height,
        };
      } catch (error) {
        console.warn("OrangePhotos server poster", error.message);
      }
    }

    try { stored = await uploadOrangePhotoToWasabi(file.buffer, { familyId:a.familyId,mimeType:m.mime_type,extension:m.extension,originalFilename:m.original_filename,checksumSha256 }); }
    catch(error){ console.error("OrangePhotos storage upload",{message:error.message}); return bad(502,"STORAGE_UPLOAD_FAILED","No se pudo transferir el archivo al almacenamiento."); }

    if (m.media_type === "video") {
      const posterCandidates = [];
      if (generatedPoster) posterCandidates.push({ ...generatedPoster, source:"server" });
      if (posterFile) posterCandidates.push({ buffer:posterFile.buffer, ...imageDimensions(posterFile.buffer, "image/jpeg"), source:"browser" });

      for (const candidate of posterCandidates) {
        try {
          posterStored = {
            ...(await uploadOrangePhotoToWasabi(candidate.buffer, { familyId:a.familyId,mimeType:"image/jpeg",extension:"jpg",originalFilename:"poster.jpg",variant:"poster" })),
            width: candidate.width,
            height: candidate.height,
          };
          break;
        } catch (error) {
          console.warn(`OrangePhotos ${candidate.source} poster upload`, error.message);
        }
      }
      if (!posterStored) warnings.push("Subido sin miniatura");
    }

    let result;
    try { result = await insertPhoto(a, m, stored, posterStored, [...new Set(warnings)].join(" · ") || null, forceDuplicate&&suppression?checksumSha256:null,clientContext(req),"simple"); }
    catch(error){
      console.error("OrangePhotos database registration",{object_key:stored.object_key,message:error.message,code:error.code,detail:error.detail,constraint:error.constraint,table:error.table,column:error.column});
      try { await deleteOrangePhotoObject(stored); if(posterStored)await deleteOrangePhotoObject(posterStored); }
      catch(cleanupError){ console.error("OrangePhotos database cleanup",{object_key:stored.object_key,message:cleanupError.message}); }
      return bad(500,"DATABASE_REGISTRATION_FAILED","El archivo se transfirió, pero no pudo registrarse.");
    }
    if (result.ok && m.media_type === "video" && result.payload?.item?.id) {
      const photoId = result.payload.item.id;
      setImmediate(() => {
        processStoredOrangePhotoVideo(photoId, { createPoster:false, createPreview:true, updateMetadata:false })
          .catch(error => console.error("OrangePhotos delayed video preview", { photo_id:photoId, message:error.message, possible_orphans:error.possibleOrphans || [] }));
      });
    }
    return result;
  } catch (error) {
    if (stored) console.error("OrangePhotos: posible objeto huérfano", { bucket:stored.bucket, object_key:stored.object_key });
    if (posterStored) console.error("OrangePhotos: posible objeto huérfano", { bucket:posterStored.bucket, object_key:posterStored.object_key });
    return bad(500, "INTERNAL_ERROR", "No se pudo completar la subida.");
  } finally {
    if (tempDir) await fs.rm(tempDir, { recursive:true, force:true });
  }
}

async function uploadDirect(req) {
  const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;
  if(String(req.headers["content-type"]||"").split(";",1)[0].trim().toLowerCase()!=="application/octet-stream")return bad(400,"INVALID_UPLOAD_MODE","Este endpoint requiere un cuerpo binario.");
  let decodedFilename;
  try{decodedFilename=decodeURIComponent(String(req.headers["x-orange-filename"]||""));}
  catch{return bad(400,"INVALID_METADATA","Nombre original no válido.");}
  const originalFilename=path.basename(decodedFilename.replace(/\\/g,"/")).trim().normalize("NFKC").replace(/\s+/g," ");
  const mimeType=String(req.headers["x-orange-mime-type"]||"").trim().toLowerCase(),declaredSize=Number(req.headers["x-orange-file-size"]),forceDuplicate=String(req.headers["x-orange-force-duplicate"]||"")==="true";
  if(!originalFilename||!Number.isSafeInteger(declaredSize)||declaredSize<=0)return bad(400,"EMPTY_FILE","El archivo está vacío.");
  if(originalFilename.length>500)return bad(400,"INVALID_METADATA","El nombre del archivo es demasiado largo.");
  if(!MIME_EXT[mimeType]||mimeType.split("/")[0]!=="video")return bad(400,"UNSUPPORTED_FILE_TYPE","Tipo de archivo no permitido.");
  if(declaredSize<=SIMPLE_VIDEO_MAX_BYTES)return bad(400,"INVALID_UPLOAD_MODE","Este archivo debe utilizar la subida normal.");
  if(declaredSize>MAX_VIDEO_BYTES)return bad(413,"FILE_TOO_LARGE","El vídeo supera el límite máximo de 10 GB.");
  let supplied={};
  try{const header=String(req.headers["x-orange-metadata"]||"");supplied=header?JSON.parse(decodeURIComponent(header)):{};}
  catch{return bad(400,"INVALID_METADATA","Metadatos JSON no válidos.");}
  const metadata=normalizeMetadata(supplied,{filename:originalFilename,mimeType});
  const invalid=validateMetadata(metadata);if(invalid)return invalid;
  let tempDir=null,stored=null,posterStored=null;
  const warnings=[];
  try{
    tempDir=await fs.mkdtemp(path.join(os.tmpdir(),"orange-photos-direct-"));
    const inputPath=path.join(tempDir,`original.${metadata.extension}`),posterPath=path.join(tempDir,"poster.jpg"),hash=createHash("sha256");
    let receivedBytes=0,requestAborted=false;
    req.once("aborted",()=>{requestAborted=true;});
    const countingTransform=new Transform({transform(chunk,encoding,callback){receivedBytes+=chunk.length;if(receivedBytes>declaredSize||receivedBytes>MAX_VIDEO_BYTES)return callback(Object.assign(new Error("La transferencia supera el tamaño declarado."),{code:"UPLOAD_INTERRUPTED"}));hash.update(chunk);callback(null,chunk);}});
    try{await pipeline(req,countingTransform,fsNative.createWriteStream(inputPath));}
    catch(error){console.error("OrangePhotos direct receive",{message:error.message});return bad(400,"UPLOAD_INTERRUPTED",requestAborted?"La conexión se interrumpió durante la subida.":"La transferencia terminó antes de recibir el archivo completo.");}
    if(requestAborted||receivedBytes!==declaredSize)return bad(400,"UPLOAD_INTERRUPTED",requestAborted?"La conexión se interrumpió durante la subida.":"La transferencia terminó antes de recibir el archivo completo.");
    const checksumSha256=hash.digest("hex"),duplicate=await findExactDuplicate(auth.familyId,auth.userId,checksumSha256);
    if(duplicate&&!forceDuplicate)return bad(409,"DUPLICATE_FILE","Este mismo archivo ya existe en OrangePhotos.",{duplicate});
    const suppression=await findUploadSuppression(auth.familyId,auth.userId,checksumSha256);
    if(suppression&&!forceDuplicate)return bad(409,"UPLOAD_SUPPRESSED","Este archivo fue eliminado voluntariamente y no se volverá a subir automáticamente.");
    try{const video=await probeVideoFile(inputPath);metadata.duration_seconds=video.duration||metadata.duration_seconds;metadata.width=video.width||metadata.width;metadata.height=video.height||metadata.height;metadata.orientation=video.rotation??metadata.orientation;applyVideoCreationTime(video,metadata);}
    catch(error){warnings.push("Metadatos de vídeo pendientes");console.error("OrangePhotos direct video metadata",{message:error.message});}
    let generatedPoster=null;
    try{const poster=await createVideoPoster(inputPath,posterPath);generatedPoster={buffer:await fs.readFile(posterPath),width:poster.metadata.width,height:poster.metadata.height};}
    catch(error){warnings.push("Subido sin miniatura");console.error("OrangePhotos direct video poster",{message:error.message});}
    try{stored=await uploadOrangePhotoFileToWasabi(inputPath,{familyId:auth.familyId,mimeType,extension:metadata.extension,originalFilename,sizeBytes:declaredSize,checksumSha256});}
    catch(error){console.error("OrangePhotos direct storage upload",{message:error.message});return bad(502,"STORAGE_UPLOAD_FAILED","No se pudo transferir el archivo al almacenamiento.");}
    if(generatedPoster){try{posterStored={...(await uploadOrangePhotoToWasabi(generatedPoster.buffer,{familyId:auth.familyId,mimeType:"image/jpeg",extension:"jpg",originalFilename:"poster.jpg",variant:"poster"})),width:generatedPoster.width,height:generatedPoster.height};}catch(error){warnings.push("Subido sin miniatura");console.error("OrangePhotos direct poster upload",{message:error.message});}}
    let result;
    try{result=await insertPhoto(auth,metadata,stored,posterStored,[...new Set(warnings)].join(" · ")||null,forceDuplicate&&suppression?checksumSha256:null,clientContext(req),"direct_backend");}
    catch(error){console.error("OrangePhotos direct database registration",{object_key:stored.object_key,message:error.message,code:error.code,detail:error.detail,constraint:error.constraint,table:error.table,column:error.column});try{await deleteOrangePhotoObject(stored);if(posterStored)await deleteOrangePhotoObject(posterStored);}catch(cleanupError){console.error("OrangePhotos direct database cleanup",{object_key:stored.object_key,message:cleanupError.message});}return bad(500,"DATABASE_REGISTRATION_FAILED","El archivo se transfirió, pero no pudo registrarse en OrangePhotos.");}
    if(result.ok&&result.payload?.item?.id){const photoId=result.payload.item.id;setImmediate(()=>processStoredOrangePhotoVideo(photoId,{createPoster:false,createPreview:true,updateMetadata:false}).catch(error=>console.error("OrangePhotos direct delayed video preview",{photo_id:photoId,message:error.message,possible_orphans:error.possibleOrphans||[]})));}
    return result;
  } catch(error) {
    console.error("OrangePhotos direct internal",{message:error.message,object_key:stored?.object_key||null});
    return bad(500,"INTERNAL_ERROR","No se pudo completar la subida.");
  } finally {
    if(tempDir)await fs.rm(tempDir,{recursive:true,force:true});
  }
}

async function list(req){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;const q=req.query||{},page=Math.max(1,Number(q.page)||1),per=Math.min(100,Math.max(1,Number(q.per_page)||30)),vals=[a.familyId,a.userId],where=[`p.family_id=$1::uuid`,visibilitySql(),`COALESCE(us.is_hidden,false)=false`];if(!(bool(q.include_trashed)&&String(q.owner_user_id||a.userId)===a.userId))where.push('p.is_trashed=false');const add=(sql,v)=>{vals.push(v);where.push(sql.replace('?',`$${vals.length}`));};if(q.search)add(`(p.title ILIKE ? OR p.description ILIKE ? OR p.original_filename ILIKE ?)`,`%${String(q.search).slice(0,120)}%`),vals.push(vals[vals.length-1],vals[vals.length-1]);if(MEDIA_TYPES.has(q.media_type))add('p.media_type=?',q.media_type);if(uuid(q.owner_user_id))add('p.owner_user_id=?::uuid',q.owner_user_id);if(VISIBILITIES.has(q.visibility))add('p.visibility=?',q.visibility);if(uuid(q.album_id))add('EXISTS(SELECT 1 FROM public.orange_photo_album_items ai WHERE ai.photo_id=p.id AND ai.album_id=?::uuid)',q.album_id);if(uuid(q.tag_id))add('EXISTS(SELECT 1 FROM public.orange_photo_tag_items ti WHERE ti.photo_id=p.id AND ti.tag_id=?::uuid)',q.tag_id);if(Number(q.year))add('EXTRACT(YEAR FROM p.captured_at)=?',Number(q.year));if(Number(q.month))add('EXTRACT(MONTH FROM p.captured_at)=?',Number(q.month));if(q.favorite!=null)add('COALESCE(us.is_favorite,p.is_favorite)=?',bool(q.favorite));const base=`FROM public.orange_photos p LEFT JOIN public.orange_photo_user_settings us ON us.photo_id=p.id AND us.user_id=$2::uuid WHERE ${where.join(' AND ')}`;const total=Number((await pool.query(`SELECT count(*)::int total ${base}`,vals)).rows[0].total);vals.push(per,(page-1)*per);const rows=(await pool.query(`SELECT p.*,COALESCE(NULLIF(btrim(pe.preferred_name),''),btrim(concat_ws(' ',pe.first_name,pe.last_name)),au.email) owner_display_name,(p.owner_user_id=$2::uuid) is_owner,COALESCE(us.is_hidden,false) is_hidden,COALESCE(us.is_favorite,p.is_favorite) is_favorite,(SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title)) FROM public.orange_photo_album_items ai JOIN public.orange_photo_albums a ON a.id=ai.album_id WHERE ai.photo_id=p.id) albums,(SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug)) FROM public.orange_photo_tag_items ti JOIN public.orange_photo_tags t ON t.id=ti.tag_id WHERE ti.photo_id=p.id) tags ${base} JOIN public.auth_users au ON au.id=p.owner_user_id LEFT JOIN public.persons pe ON pe.id=au.person_id ORDER BY p.captured_at DESC NULLS LAST,p.created_at DESC,p.id DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`,vals)).rows;const files=rows.length?(await pool.query(`SELECT photo_id,variant,bucket,object_key FROM public.orange_photo_files WHERE photo_id=ANY($1::uuid[]) AND variant IN ('thumbnail','preview','original','poster')`,[rows.map(r=>r.id)])).rows:[];const by=new Map();for(const f of files){if(!by.has(String(f.photo_id)))by.set(String(f.photo_id),{});by.get(String(f.photo_id))[f.variant]=f;}await Promise.all(rows.map(async r=>{const f=by.get(String(r.id))||{};const thumb=f.thumbnail||f.poster||f.preview||f.original,preview=f.preview||f.original;if(thumb)r.thumbnail_url=await getSignedOrangePhotoUrl(thumb);if(preview)r.preview_url=await getSignedOrangePhotoUrl(preview);r.albums=r.albums||[];r.tags=r.tags||[];}));return ok({items:rows,page,per_page:per,total,has_more:page*per<total});}

async function detail(req,id,{allowTrash=false}={}){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;if(!uuid(id))return bad(400,"Identificador no válido.");const r=(await pool.query(`SELECT p.*,COALESCE(NULLIF(btrim(pe.preferred_name),''),btrim(concat_ws(' ',pe.first_name,pe.last_name)),au.email) owner_display_name,(p.owner_user_id=$2::uuid) is_owner,COALESCE(us.is_hidden,false) is_hidden,COALESCE(us.is_favorite,p.is_favorite) is_favorite FROM public.orange_photos p JOIN public.auth_users au ON au.id=p.owner_user_id LEFT JOIN public.persons pe ON pe.id=au.person_id LEFT JOIN public.orange_photo_user_settings us ON us.photo_id=p.id AND us.user_id=$2::uuid WHERE p.id=$3::uuid AND p.family_id=$1::uuid AND ${visibilitySql()} AND (p.is_trashed=false OR ($4 AND p.owner_user_id=$2::uuid))`,[a.familyId,a.userId,id,allowTrash])).rows[0];if(!r)return bad(404,"Foto no encontrada.");await signPhotoFiles([r]);return ok({item:r,auth:a});}
async function update(req,id,body){const d=await detail(req,id,{allowTrash:true});if(!d.ok)return d;if(!d.payload.item.is_owner)return bad(403,"Solo el propietario puede editar la foto.");const allowed=['title','description','captured_at','timezone','latitude','longitude','altitude_meters','location_name','location_country','location_region','location_locality','is_favorite'];const sets=[],changed=[],vals=[d.payload.auth.familyId,id,d.payload.auth.userId];for(const k of allowed)if(Object.hasOwn(body,k)){const v=k==='is_favorite'?bool(body[k]):['latitude','longitude','altitude_meters'].includes(k)?number(body[k]):text(body[k],k==='description'?5000:500);if(k==='latitude'&&v!=null&&(v< -90||v>90)||k==='longitude'&&v!=null&&(v< -180||v>180))return bad(400,"Coordenadas no válidas.");if(String(d.payload.item[k]??'')===String(v??''))continue;changed.push(k);vals.push(v);sets.push(`${k}=$${vals.length}`);}if(changed.includes('captured_at'))sets.push(`captured_at_source='manual'`);if(['latitude','longitude','location_name'].some(k=>changed.includes(k)))sets.push(`location_source='manual'`);if(!sets.length)return ok({item:d.payload.item});sets.push('updated_by=$3::uuid');const c=await pool.connect();try{await c.query('BEGIN');await c.query(`UPDATE public.orange_photos SET ${sets.join(',')} WHERE family_id=$1::uuid AND id=$2::uuid`,vals);await recordPhotoEvent(c,{familyId:d.payload.auth.familyId,photoId:id,actorUserId:d.payload.auth.userId,eventType:'metadata_updated',...clientContext(req),metadata:{changed_fields:changed}});await c.query('COMMIT');}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}const refreshed=await listSafe({...req,query:{ids:id,page:1,per_page:1}});return refreshed.ok&&refreshed.payload.items[0]?ok({item:refreshed.payload.items[0]}):detail(req,id,{allowTrash:true});}
async function generateVideoPoster(req,id,body={}){const d=await detail(req,id,{allowTrash:true});if(!d.ok)return d;const photo=d.payload.item,replaceExisting=body.replace_existing===true;if(!photo.is_owner)return bad(403,"Solo el propietario puede generar la miniatura.");if(photo.media_type!=="video")return bad(400,"La miniatura solo puede generarse para vídeos.");const files=(await pool.query(`SELECT id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag FROM public.orange_photo_files WHERE family_id=$1::uuid AND photo_id=$2::uuid AND variant=ANY($3::text[])`,[d.payload.auth.familyId,id,["original","poster","thumbnail"]])).rows;if(!files.some(row=>row.variant==="original"))return bad(404,"El vídeo original no está disponible.");const currentPoster=files.find(row=>row.variant==="poster"),hasThumbnail=files.some(row=>row.variant==="thumbnail");if((currentPoster||hasThumbnail)&&!replaceExisting)return bad(409,"El vídeo ya dispone de miniatura. Indica que deseas sustituirla.");try{if(!replaceExisting){await processStoredOrangePhotoVideo(id,{createPoster:true,createPreview:false,updateMetadata:false});return detail(req,id,{allowTrash:true});}const processed=await processStoredOrangePhotoVideo(id,{createPoster:true,createPreview:false,updateMetadata:false,replacePoster:true}),created=processed.created.find(item=>item.variant==="poster");if(!created)throw new Error("No se pudo registrar la nueva miniatura.");const c=await pool.connect();let committed=false,phaseStarted=Date.now();try{await c.query('BEGIN');if(currentPoster){await c.query(`UPDATE public.orange_photo_files SET provider=$1,bucket=$2,object_key=$3,mime_type=$4,width=$5,height=$6,size_bytes=$7,checksum_sha256=$8,etag=$9 WHERE id=$10::uuid AND family_id=$11::uuid AND photo_id=$12::uuid`,[created.provider,created.bucket,created.object_key,created.mime_type,created.width,created.height,created.size_bytes,created.checksum_sha256,created.etag,currentPoster.id,d.payload.auth.familyId,id]);}else{await c.query(`INSERT INTO public.orange_photo_files(family_id,photo_id,variant,provider,bucket,object_key,mime_type,width,height,size_bytes,checksum_sha256,etag) VALUES($1,$2,'poster',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,[d.payload.auth.familyId,id,created.provider,created.bucket,created.object_key,created.mime_type,created.width,created.height,created.size_bytes,created.checksum_sha256,created.etag]);}await c.query('COMMIT');committed=true;console.info("OrangePhotos poster replacement",{photo_id:id,phase:"replace_database_record",duration_ms:Date.now()-phaseStarted,object_key:created.object_key,message:"completed"});}catch(error){console.error("OrangePhotos poster replacement",{photo_id:id,phase:"replace_database_record",duration_ms:Date.now()-phaseStarted,object_key:created.object_key,message:error.message});await c.query('ROLLBACK').catch(()=>{});try{await deleteOrangePhotoObject(created);}catch(cleanupError){console.error("OrangePhotos replacement poster cleanup",{photo_id:id,phase:"delete_old_poster",duration_ms:0,object_key:created.object_key,message:cleanupError.message});}throw new Error("No se pudo registrar la nueva miniatura.",{cause:error});}finally{c.release();}if(committed&&currentPoster&&currentPoster.object_key!==created.object_key){phaseStarted=Date.now();try{await deleteOrangePhotoObject(currentPoster);console.info("OrangePhotos poster replacement",{photo_id:id,phase:"delete_old_poster",duration_ms:Date.now()-phaseStarted,object_key:currentPoster.object_key,message:"completed"});}catch(error){console.error("OrangePhotos poster replacement",{photo_id:id,phase:"delete_old_poster",duration_ms:Date.now()-phaseStarted,object_key:currentPoster.object_key,message:error.message});}}return detail(req,id,{allowTrash:true});}catch(error){return bad(500,"VIDEO_POSTER_FAILED",error?.message||"No se pudo generar la miniatura.");}}
async function trash(req,id,restore=false){const d=await detail(req,id,{allowTrash:true});if(!d.ok)return d;if(!d.payload.item.is_owner)return bad(403,"Solo el propietario puede gestionar la papelera.");const c=await pool.connect();try{await c.query('BEGIN');const r=(await c.query(`UPDATE public.orange_photos SET is_trashed=$3,trashed_at=CASE WHEN $3 THEN now() ELSE NULL END,updated_by=$2 WHERE id=$1 RETURNING *`,[id,d.payload.auth.userId,!restore])).rows[0];await recordPhotoEvent(c,{familyId:d.payload.auth.familyId,photoId:id,actorUserId:d.payload.auth.userId,eventType:restore?'restored':'moved_to_trash',...clientContext(req)});await c.query('COMMIT');return ok({item:r});}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
async function signedUrl(req,id,original=false){const d=await detail(req,id);if(!d.ok)return d;const order=original?["original"]:["preview","original"];const f=(await pool.query(`SELECT bucket,object_key,variant FROM public.orange_photo_files WHERE photo_id=$1 AND variant=ANY($2::text[]) ORDER BY array_position($2::text[],variant) LIMIT 1`,[id,order])).rows[0];if(!f)return bad(404,"Archivo no disponible.");return ok({url:await getSignedOrangePhotoUrl(f),variant:f.variant,expires_in:3600});}
async function download(req,id){const d=await detail(req,id);if(!d.ok)return d;const f=(await pool.query(`SELECT bucket,object_key,mime_type,size_bytes FROM public.orange_photo_files WHERE photo_id=$1 AND variant='original' LIMIT 1`,[id])).rows[0];if(!f)return bad(404,"Archivo original no disponible.");return ok({download:await getOrangePhotoObjectStream(f),filename:d.payload.item.original_filename||`orange-photo-${id}`,event:{auth:d.payload.auth,photoId:id,context:clientContext(req),metadata:{format:'original',original_filename:d.payload.item.original_filename,size_bytes:f.size_bytes==null?null:Number(f.size_bytes)}}});}
async function recordCompletedDownload(event){await recordPhotoEvent(pool,{familyId:event.auth.familyId,photoId:event.photoId,actorUserId:event.auth.userId,eventType:'downloaded',...event.context,metadata:event.metadata});}
async function recordCompletedBulkDownload(req,items){const a=resolveAuthenticatedFamily(req);if(!a.ok)return;await recordPhotoEvent(pool,{familyId:a.familyId,actorUserId:a.userId,eventType:'bulk_downloaded',...clientContext(req),metadata:items.length<=100?{format:'zip',item_count:items.length,photo_ids:items.map(item=>item.id)}:{format:'zip',item_count:items.length}});}
const downloadObject=record=>getOrangePhotoObjectStream(record);
async function downloadMany(req,body={}){
  const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;
  let requested=body.photo_ids;
  if(typeof requested==="string"){try{requested=JSON.parse(requested);}catch{return bad(400,"INVALID_METADATA","La lista de fotos no es válida.");}}
  if(!Array.isArray(requested))return bad(400,"INVALID_METADATA","photo_ids debe ser una lista.");
  const ids=[...new Set(requested.map(value=>String(value||"").trim()))];
  if(ids.length<2)return bad(400,"INVALID_METADATA","Selecciona al menos dos elementos.");
  if(ids.length>MAX_ZIP_DOWNLOAD_ITEMS)return bad(400,"INVALID_METADATA","Puedes descargar un máximo de 500 elementos a la vez.");
  if(ids.some(id=>!uuid(id)))return bad(400,"INVALID_METADATA","Uno o más identificadores no son válidos.");
  const rows=(await pool.query(`SELECT p.id,p.original_filename,f.bucket,f.object_key,f.mime_type,f.size_bytes FROM public.orange_photos p JOIN public.orange_photo_files f ON f.photo_id=p.id AND f.family_id=p.family_id AND f.variant='original' WHERE p.family_id=$1::uuid AND ${visibilitySql()} AND p.is_trashed=false AND p.id=ANY($3::uuid[])`,[a.familyId,a.userId,ids])).rows;
  if(rows.length!==ids.length)return bad(404,"UPLOAD_NOT_FOUND","Una o más fotos no existen, no son accesibles o no tienen original disponible.");
  const byId=new Map(rows.map(row=>[String(row.id),row]));
  return ok({items:ids.map(id=>byId.get(id))});
}
async function share(req,id,body){const d=await detail(req,id,{allowTrash:true});if(!d.ok)return d;if(!d.payload.item.is_owner)return bad(403,"Solo el propietario puede compartir.");const visibility=String(body.visibility||'');if(!VISIBILITIES.has(visibility))return bad(400,"Visibilidad no válida.");let ids;try{ids=await memberIds(d.payload.auth.familyId,body.user_ids);}catch(e){return bad(e.status||400,e.message);}const c=await pool.connect();try{await c.query('BEGIN');await c.query(`UPDATE public.orange_photos SET visibility=$1,updated_by=$2 WHERE id=$3`,[visibility,d.payload.auth.userId,id]);await c.query(`DELETE FROM public.orange_photo_shares WHERE photo_id=$1`,[id]);if(visibility==='selected'&&ids.length)await c.query(`INSERT INTO public.orange_photo_shares(photo_id,user_id,shared_by) SELECT $1,unnest($2::uuid[]),$3`,[id,ids,d.payload.auth.userId]);await recordPhotoEvent(c,{familyId:d.payload.auth.familyId,photoId:id,actorUserId:d.payload.auth.userId,eventType:visibility==='private'?'unshared':'shared',...clientContext(req),metadata:{visibility,shared_user_ids:visibility==='selected'?ids:[]}});await c.query('COMMIT');return ok({visibility,user_ids:visibility==='selected'?ids:[]});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}

async function albums(req){const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;const r=await pool.query(`SELECT a.*,(a.owner_user_id=$2::uuid) is_owner,CASE WHEN a.owner_user_id=$2::uuid THEN true WHEN a.visibility='family' THEN a.allow_contributions WHEN a.visibility='selected' THEN COALESCE(current_share.can_contribute,false) ELSE false END can_contribute,(a.owner_user_id<>$2::uuid OR a.visibility IN ('family','selected')) is_shared_effectively,CASE WHEN a.owner_user_id<>$2::uuid THEN COALESCE(NULLIF(btrim(owner_person.preferred_name),''),btrim(concat_ws(' ',owner_person.first_name,owner_person.last_name)),owner_user.email) END shared_by_display_name,COALESCE((SELECT array_agg(ash.user_id ORDER BY ash.user_id) FROM public.orange_photo_album_shares ash WHERE ash.album_id=a.id),'{}'::uuid[]) shared_user_ids,COALESCE((SELECT bool_or(ash.can_contribute) FROM public.orange_photo_album_shares ash WHERE ash.album_id=a.id),false) shared_can_contribute,COALESCE((SELECT jsonb_agg(jsonb_build_object('display_name',COALESCE(NULLIF(btrim(shared_person.preferred_name),''),btrim(concat_ws(' ',shared_person.first_name,shared_person.last_name)),shared_user.email)) ORDER BY COALESCE(NULLIF(btrim(shared_person.preferred_name),''),btrim(concat_ws(' ',shared_person.first_name,shared_person.last_name)),shared_user.email)) FROM public.orange_photo_album_shares ash JOIN public.auth_users shared_user ON shared_user.id=ash.user_id LEFT JOIN public.persons shared_person ON shared_person.id=shared_user.person_id WHERE ash.album_id=a.id),'[]'::jsonb) shared_people,(SELECT count(*)::int FROM public.orange_photo_album_items ai JOIN public.orange_photos p ON p.id=ai.photo_id WHERE ai.album_id=a.id AND p.family_id=$1 AND ${visibilitySql('p')} AND p.is_trashed=false) photo_count FROM public.orange_photo_albums a JOIN public.auth_users owner_user ON owner_user.id=a.owner_user_id LEFT JOIN public.persons owner_person ON owner_person.id=owner_user.person_id LEFT JOIN public.orange_photo_album_shares current_share ON current_share.album_id=a.id AND current_share.user_id=$2::uuid WHERE a.family_id=$1 AND a.is_archived=false AND ${albumVisibilitySql()} ORDER BY a.sort_order,lower(a.title)`,[auth.familyId,auth.userId]);const coverIds=r.rows.map(row=>row.cover_photo_id).filter(Boolean);const covers=coverIds.length?(await pool.query(`SELECT DISTINCT ON (photo_id) photo_id,bucket,object_key FROM public.orange_photo_files WHERE family_id=$1 AND photo_id=ANY($2::uuid[]) AND variant IN ('thumbnail','poster','preview','original') ORDER BY photo_id,CASE variant WHEN 'thumbnail' THEN 1 WHEN 'poster' THEN 2 WHEN 'preview' THEN 3 ELSE 4 END`,[auth.familyId,coverIds])).rows:[];const urls=new Map(await Promise.all(covers.map(async cover=>[String(cover.photo_id),await getSignedOrangePhotoUrl(cover)])));return ok({items:r.rows.map(row=>({...row,cover_thumbnail_url:urls.get(String(row.cover_photo_id))||null}))});}
async function createAlbum(req,body){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;const title=text(body.title,500),visibility=body.visibility||'private';if(!title||!VISIBILITIES.has(visibility))return bad(400,"Título o visibilidad no válidos.");if(body.parent_id){const p=(await pool.query(`SELECT id FROM public.orange_photo_albums WHERE id=$1 AND family_id=$2 AND owner_user_id=$3`,[body.parent_id,a.familyId,a.userId])).rows[0];if(!p)return bad(400,"Álbum padre no válido.");}const r=(await pool.query(`INSERT INTO public.orange_photo_albums(family_id,owner_user_id,parent_id,title,description,cover_photo_id,visibility,created_by,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$2,$2) RETURNING *`,[a.familyId,a.userId,body.parent_id||null,title,text(body.description,5000),body.cover_photo_id||null,visibility])).rows[0];return ok({item:r});}
async function albumOwned(req,id){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;const row=(await pool.query(`SELECT * FROM public.orange_photo_albums WHERE id=$1 AND family_id=$2`,[id,a.familyId])).rows[0];if(!row)return bad(404,"Álbum no encontrado.");if(String(row.owner_user_id)!==a.userId)return bad(403,"Solo el propietario puede modificar el álbum.");return ok({item:row,auth:a});}
async function albumAccess(req,id){const auth=resolveAuthenticatedFamily(req);if(!auth.ok)return auth;const row=(await pool.query(`SELECT a.*,a.owner_user_id=$2::uuid is_owner,(a.owner_user_id=$2::uuid OR a.visibility='family' OR (a.visibility='selected' AND ash.user_id IS NOT NULL)) can_view,CASE WHEN a.owner_user_id=$2::uuid THEN true WHEN a.visibility='family' THEN a.allow_contributions WHEN a.visibility='selected' THEN COALESCE(ash.can_contribute,false) ELSE false END can_contribute FROM public.orange_photo_albums a LEFT JOIN public.orange_photo_album_shares ash ON ash.album_id=a.id AND ash.user_id=$2::uuid WHERE a.id=$1 AND a.family_id=$3 AND a.is_archived=false`,[id,auth.userId,auth.familyId])).rows[0];if(!row||!row.can_view)return bad(404,"Álbum no encontrado.");return ok({item:row,auth,is_owner:row.is_owner,can_view:row.can_view,can_contribute:row.can_contribute});}
async function albumPhotoIds(req,albumId){const access=await albumAccess(req,albumId);if(!access.ok)return access;const rows=(await pool.query(`SELECT ai.photo_id FROM public.orange_photo_album_items ai JOIN public.orange_photos p ON p.id=ai.photo_id AND p.family_id=$2::uuid WHERE ai.album_id=$1::uuid AND p.is_trashed=false ORDER BY ai.sort_order ASC,ai.photo_id ASC`,[albumId,access.payload.auth.familyId])).rows;return ok({photo_ids:rows.map(row=>row.photo_id)});}
async function updateAlbum(req,id,body){const d=await albumOwned(req,id);if(!d.ok)return d;const title=Object.hasOwn(body,'title')?text(body.title,500):d.payload.item.title,description=Object.hasOwn(body,'description')?text(body.description,5000):d.payload.item.description,visibility=Object.hasOwn(body,'visibility')?String(body.visibility):d.payload.item.visibility,sortOrder=Object.hasOwn(body,'sort_order')?Number(body.sort_order):d.payload.item.sort_order,isArchived=Object.hasOwn(body,'is_archived')?bool(body.is_archived):d.payload.item.is_archived;let coverPhotoId=d.payload.item.cover_photo_id;if(!title||!VISIBILITIES.has(visibility)||!Number.isFinite(Number(sortOrder)))return bad(400,"Datos no válidos.");if(Object.hasOwn(body,'cover_photo_id')){coverPhotoId=body.cover_photo_id;if(coverPhotoId!==null){if(!uuid(coverPhotoId))return bad(400,"INVALID_METADATA","La imagen de portada no pertenece al álbum.");const valid=(await pool.query(`SELECT 1 FROM public.orange_photos p JOIN public.orange_photo_album_items ai ON ai.photo_id=p.id AND ai.album_id=$1 WHERE p.id=$2 AND p.family_id=$3 AND p.is_trashed=false AND p.media_type='image'`,[id,coverPhotoId,d.payload.auth.familyId])).rowCount;if(!valid)return bad(400,"INVALID_METADATA","La imagen de portada no pertenece al álbum.");}}const r=(await pool.query(`UPDATE public.orange_photo_albums SET title=$1,description=$2,visibility=$3,sort_order=$4,is_archived=$5,cover_photo_id=$6,updated_by=$7 WHERE id=$8 RETURNING *`,[title,description,visibility,Number(sortOrder),isArchived,coverPhotoId,d.payload.auth.userId,id])).rows[0];return ok({item:r});}
async function addPhoto(req,albumId,body,remove=false){const access=await albumAccess(req,albumId);if(!access.ok)return access;const photoId=body.photo_id||body.photoId;if(!uuid(photoId))return bad(400,"Foto no válida.");const photo=await detail(req,photoId);if(!photo.ok)return photo;if(!access.payload.is_owner&&!access.payload.can_contribute)return bad(403,"No tienes permiso para añadir contenido a este álbum.");if(!access.payload.is_owner&&String(photo.payload.item.owner_user_id)!==access.payload.auth.userId)return bad(403,"Solo puedes añadir al álbum fotos y vídeos de tu propiedad.");const c=await pool.connect();try{await c.query('BEGIN');let changed;if(remove){const relation=(await c.query(`SELECT added_by FROM public.orange_photo_album_items WHERE album_id=$1 AND photo_id=$2 FOR UPDATE`,[albumId,photoId])).rows[0];if(relation&&!access.payload.is_owner&&String(relation.added_by)!==access.payload.auth.userId){await c.query('ROLLBACK');return bad(403,"Solo puedes retirar del álbum los elementos que hayas añadido.");}changed=relation?(await c.query(`DELETE FROM public.orange_photo_album_items WHERE album_id=$1 AND photo_id=$2 RETURNING photo_id`,[albumId,photoId])).rowCount:0;if(changed){const album=(await c.query(`SELECT cover_photo_id FROM public.orange_photo_albums WHERE id=$1::uuid FOR UPDATE`,[albumId])).rows[0];if(album&&String(album.cover_photo_id||"")===String(photoId)){const nextCover=(await c.query(`SELECT p.id FROM public.orange_photo_album_items ai JOIN public.orange_photos p ON p.id=ai.photo_id WHERE ai.album_id=$1::uuid AND p.family_id=$2::uuid AND p.is_trashed=false AND p.media_type='image' ORDER BY ai.sort_order ASC,ai.photo_id ASC LIMIT 1`,[albumId,access.payload.auth.familyId])).rows[0];if(nextCover?.id)await c.query(`UPDATE public.orange_photo_albums SET cover_photo_id=$1::uuid,updated_by=$2::uuid WHERE id=$3::uuid`,[nextCover.id,access.payload.auth.userId,albumId]);else await c.query(`UPDATE public.orange_photo_albums SET cover_photo_id=NULL,updated_by=$1::uuid WHERE id=$2::uuid`,[access.payload.auth.userId,albumId]);}}}else changed=(await c.query(`INSERT INTO public.orange_photo_album_items(album_id,photo_id,sort_order,added_by) VALUES($1,$2,$3,$4) ON CONFLICT(album_id,photo_id) DO NOTHING RETURNING photo_id`,[albumId,photoId,Number(body.sort_order)||0,access.payload.auth.userId])).rowCount;if(changed&&!remove&&photo.payload.item.media_type==='image')await c.query(`UPDATE public.orange_photo_albums SET cover_photo_id=$1,updated_by=$2 WHERE id=$3 AND cover_photo_id IS NULL`,[photoId,access.payload.auth.userId,albumId]);if(changed)await recordPhotoEvent(c,{familyId:access.payload.auth.familyId,photoId,actorUserId:access.payload.auth.userId,eventType:remove?'removed_from_album':'added_to_album',...clientContext(req),metadata:{album_id:albumId}});await c.query('COMMIT');return ok(remove?{removed:Boolean(changed)}:{added:Boolean(changed)});}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
async function shareAlbum(req,id,body){const owned=await albumOwned(req,id);if(!owned.ok)return owned;const visibility=String(body.visibility||'');if(!VISIBILITIES.has(visibility))return bad(400,"Visibilidad no válida.");const canContribute=visibility==='private'?false:bool(body.can_contribute);let ids;try{ids=await memberIds(owned.payload.auth.familyId,body.user_ids);}catch(e){return bad(400,e.message);}const allowContributions=visibility==='family'&&canContribute;const c=await pool.connect();try{await c.query('BEGIN');await c.query(`UPDATE public.orange_photo_albums SET visibility=$1,allow_contributions=$2,updated_by=$3 WHERE id=$4`,[visibility,allowContributions,owned.payload.auth.userId,id]);await c.query(`DELETE FROM public.orange_photo_album_shares WHERE album_id=$1`,[id]);if(visibility==='selected'&&ids.length)await c.query(`INSERT INTO public.orange_photo_album_shares(album_id,user_id,shared_by,can_contribute) SELECT $1,unnest($2::uuid[]),$3,$4`,[id,ids,owned.payload.auth.userId,canContribute]);await c.query('COMMIT');return ok({visibility,user_ids:visibility==='selected'?ids:[],can_contribute:canContribute,allow_contributions:allowContributions,private_photo_count:0,warning:null});}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function tags(req){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;const r=await pool.query(`SELECT t.*,count(ti.photo_id)::int photo_count FROM public.orange_photo_tags t LEFT JOIN public.orange_photo_tag_items ti ON ti.tag_id=t.id WHERE t.family_id=$1 GROUP BY t.id ORDER BY lower(t.name)`,[a.familyId]);return ok({items:r.rows});}
async function createTag(req,body){const a=resolveAuthenticatedFamily(req);if(!a.ok)return a;const name=text(body.name,120),slug=String(body.slug||name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);if(!name||!slug)return bad(400,"Nombre de etiqueta obligatorio.");const r=(await pool.query(`INSERT INTO public.orange_photo_tags(family_id,name,slug) VALUES($1,$2,$3) ON CONFLICT(family_id,slug) DO UPDATE SET name=excluded.name RETURNING *`,[a.familyId,name,slug])).rows[0];return ok({item:r});}

function buildPhotoQuery(req, queryOverride = null) {
  const auth = resolveAuthenticatedFamily(req); if (!auth.ok) return auth;
  const q = queryOverride || req.query || {}, values = [auth.familyId, auth.userId], where = [`p.family_id=$1::uuid`, visibilitySql(), `COALESCE(us.is_hidden,false)=false`];
  const add = (sql, value) => { values.push(value); where.push(sql.replaceAll("?", `$${values.length}`)); };
  if (q.trashed != null ? bool(q.trashed) : bool(q.include_trashed) && String(q.owner_user_id || auth.userId) === auth.userId) where.push("p.is_trashed=true"); else where.push("p.is_trashed=false");
  const libraryScope=String(q.library_scope||"all"),shareScope=String(q.share_scope||"all"),mediaType=String(q.media_type||"all");
  if (!LIBRARY_SCOPES.has(libraryScope)) return bad(400, "Alcance de biblioteca no válido.");
  if (!SHARE_SCOPES.has(shareScope)) return bad(400, "Alcance de compartición no válido.");
  if (mediaType!=="all"&&!MEDIA_TYPES.has(mediaType)) return bad(400, "Tipo de contenido no válido.");
  if (q.search) add("concat_ws(' ',p.title,p.description,p.original_filename) ILIKE ?", `%${String(q.search).slice(0, 120)}%`);
  if (mediaType!=="all") add("p.media_type=?", mediaType);
  if (libraryScope==="owned") where.push("p.owner_user_id=$2::uuid");
  if (libraryScope==="shared_with_me") where.push(`p.owner_user_id<>$2::uuid AND (p.visibility='family' OR (p.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_shares ls WHERE ls.photo_id=p.id AND ls.user_id=$2::uuid)) OR EXISTS(SELECT 1 FROM public.orange_photo_album_items lai JOIN public.orange_photo_albums la ON la.id=lai.album_id AND la.family_id=p.family_id AND la.is_archived=false WHERE lai.photo_id=p.id AND (la.visibility='family' OR (la.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_album_shares lash WHERE lash.album_id=la.id AND lash.user_id=$2::uuid)))))`);
  if (libraryScope==="shared_by_me") {
    where.push("p.owner_user_id=$2::uuid AND (p.visibility IN ('family','selected') OR EXISTS(SELECT 1 FROM public.orange_photo_album_items lbi JOIN public.orange_photo_albums lb ON lb.id=lbi.album_id AND lb.owner_user_id=$2::uuid AND lb.is_archived=false AND lb.visibility IN ('family','selected') WHERE lbi.photo_id=p.id))");
  }
  if (libraryScope==="shared_by_me"&&shareScope!=="all") add("(p.visibility=? OR EXISTS(SELECT 1 FROM public.orange_photo_album_items lsi JOIN public.orange_photo_albums lsa ON lsa.id=lsi.album_id AND lsa.owner_user_id=$2::uuid AND lsa.is_archived=false AND lsa.visibility=? WHERE lsi.photo_id=p.id))",shareScope);
  if (uuid(q.owner_user_id)) add("p.owner_user_id=?::uuid", q.owner_user_id);
  if (VISIBILITIES.has(q.visibility)) add("p.visibility=?", q.visibility);
  if (uuid(q.album_id)) add("EXISTS(SELECT 1 FROM public.orange_photo_album_items ai WHERE ai.photo_id=p.id AND ai.album_id=?::uuid)", q.album_id);
  if (q.ids) { const ids=String(q.ids).split(",").filter(uuid).slice(0,100); if(!ids.length)return bad(400,"Identificadores no válidos."); add("p.id=ANY(?::uuid[])",ids); }
  if (uuid(q.tag_id)) add("EXISTS(SELECT 1 FROM public.orange_photo_tag_items ti WHERE ti.photo_id=p.id AND ti.tag_id=?::uuid)", q.tag_id);
  if (Number(q.year)) add("EXTRACT(YEAR FROM p.captured_at)=?", Number(q.year));
  if (Number(q.month)) add("EXTRACT(MONTH FROM p.captured_at)=?", Number(q.month));
  if (q.favorite != null) add("COALESCE(us.is_favorite,p.is_favorite)=?", bool(q.favorite));
  if (q.before) { const date = new Date(q.before); if (Number.isNaN(date.getTime())) return bad(400, "Fecha de salto no válida."); add("p.captured_at<=?::timestamptz", date.toISOString()); }
  if (q.before_exclusive) { const date = new Date(q.before_exclusive); if (Number.isNaN(date.getTime())) return bad(400, "Fecha de salto no válida."); add("p.captured_at<?::timestamptz", date.toISOString()); }
  if (q.after) { const date = new Date(q.after); if (Number.isNaN(date.getTime())) return bad(400, "Fecha de salto no válida."); add("p.captured_at>?::timestamptz", date.toISOString()); }
  const joins = `FROM public.orange_photos p LEFT JOIN public.orange_photo_user_settings us ON us.photo_id=p.id AND us.user_id=$2::uuid JOIN public.auth_users au ON au.id=p.owner_user_id LEFT JOIN public.persons pe ON pe.id=au.person_id`;
  return ok({ auth, q, values, joins, condition: `WHERE ${where.join(" AND ")}` });
}

async function signPhotoFiles(rows) {
  const files = rows.length ? (await pool.query(`SELECT photo_id,variant,bucket,object_key,width,height FROM public.orange_photo_files WHERE photo_id=ANY($1::uuid[]) AND variant IN ('thumbnail','preview','original','poster')`, [rows.map(row => row.id)])).rows : [], by = new Map();
  const shares = rows.length ? (await pool.query(`SELECT photo_id,array_agg(user_id) user_ids FROM public.orange_photo_shares WHERE photo_id=ANY($1::uuid[]) GROUP BY photo_id`, [rows.map(row => row.id)])).rows : [], sharedBy = new Map(shares.map(row => [String(row.photo_id), row.user_ids]));
  for (const file of files) { const key = String(file.photo_id); if (!by.has(key)) by.set(key, {}); by.get(key)[file.variant] = file; }
  await Promise.all(rows.map(async row => { const variants=by.get(String(row.id))||{},thumbnail=variants.thumbnail,preview=variants.preview,poster=variants.poster;row.thumbnail_url=thumbnail?await getSignedOrangePhotoUrl(thumbnail):null;row.thumbnail_width=thumbnail?.width??null;row.thumbnail_height=thumbnail?.height??null;row.preview_url=row.media_type==="image"&&preview?await getSignedOrangePhotoUrl(preview):null;row.poster_url=row.media_type==="video"&&poster?await getSignedOrangePhotoUrl(poster):null;row.video_preview_url=row.media_type==="video"&&preview?await getSignedOrangePhotoUrl(preview):null;row.original_url=variants.original?await getSignedOrangePhotoUrl(variants.original):null;row.shared_user_ids=sharedBy.get(String(row.id))||[];row.albums=row.albums||[];row.tags=row.tags||[];}));
}

async function listSafe(req, queryOverride = null, options = {}) {
  const context = buildPhotoQuery(req, queryOverride); if (!context.ok) return context;
  const { q, values, joins, condition } = context.payload, page = Math.max(1, Number(q.page) || 1), per = Math.min(100, Math.max(1, Number(q.per_page) || 30));
  const total = Number((await pool.query(`SELECT count(*)::int total ${joins} ${condition}`, values)).rows[0].total), pagedValues = [...values, per, (page - 1) * per];
  const order = options.ascending ? "ASC NULLS LAST" : "DESC NULLS LAST";
  const rows = (await pool.query(`SELECT p.*,COALESCE(NULLIF(btrim(pe.preferred_name),''),btrim(concat_ws(' ',pe.first_name,pe.last_name)),au.email) owner_display_name,CASE WHEN p.owner_user_id<>$2::uuid THEN COALESCE(NULLIF(btrim(pe.preferred_name),''),btrim(concat_ws(' ',pe.first_name,pe.last_name)),au.email) END shared_by_display_name,(p.owner_user_id=$2::uuid) is_owner,CASE WHEN p.visibility IN ('family','selected') THEN p.visibility END share_kind,CASE WHEN p.visibility='selected' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('display_name',COALESCE(NULLIF(btrim(sp.preferred_name),''),btrim(concat_ws(' ',sp.first_name,sp.last_name)),sau.email)) ORDER BY COALESCE(NULLIF(btrim(sp.preferred_name),''),btrim(concat_ws(' ',sp.first_name,sp.last_name)),sau.email)) FROM public.orange_photo_shares s JOIN public.auth_users sau ON sau.id=s.user_id LEFT JOIN public.persons sp ON sp.id=sau.person_id WHERE s.photo_id=p.id),'[]'::jsonb) ELSE '[]'::jsonb END shared_people,(p.visibility IN ('family','selected')) is_shared_directly,EXISTS(SELECT 1 FROM public.orange_photo_album_items sai JOIN public.orange_photo_albums saa ON saa.id=sai.album_id AND saa.is_archived=false AND saa.visibility IN ('family','selected') WHERE sai.photo_id=p.id AND (saa.owner_user_id=$2::uuid OR saa.visibility='family' OR (saa.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_album_shares sash WHERE sash.album_id=saa.id AND sash.user_id=$2::uuid)))) is_shared_via_album,(p.owner_user_id<>$2::uuid OR p.visibility IN ('family','selected') OR EXISTS(SELECT 1 FROM public.orange_photo_album_items sei JOIN public.orange_photo_albums sea ON sea.id=sei.album_id AND sea.is_archived=false AND sea.visibility IN ('family','selected') WHERE sei.photo_id=p.id AND (sea.owner_user_id=$2::uuid OR sea.visibility='family' OR (sea.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_album_shares sesh WHERE sesh.album_id=sea.id AND sesh.user_id=$2::uuid))))) is_shared_effectively,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',sal.id,'title',sal.title,'visibility',sal.visibility,'owner_user_id',sal.owner_user_id,'owner_display_name',COALESCE(NULLIF(btrim(spe.preferred_name),''),btrim(concat_ws(' ',spe.first_name,spe.last_name)),sauo.email),'is_owner',sal.owner_user_id=$2::uuid) ORDER BY lower(sal.title)) FROM public.orange_photo_album_items siai JOIN public.orange_photo_albums sal ON sal.id=siai.album_id AND sal.is_archived=false AND sal.visibility IN ('family','selected') JOIN public.auth_users sauo ON sauo.id=sal.owner_user_id LEFT JOIN public.persons spe ON spe.id=sauo.person_id WHERE siai.photo_id=p.id AND (sal.owner_user_id=$2::uuid OR sal.visibility='family' OR (sal.visibility='selected' AND EXISTS(SELECT 1 FROM public.orange_photo_album_shares sash2 WHERE sash2.album_id=sal.id AND sash2.user_id=$2::uuid)))),'[]'::jsonb) shared_via_albums,COALESCE(us.is_hidden,false) is_hidden,COALESCE(us.is_favorite,p.is_favorite) is_favorite,(SELECT jsonb_agg(jsonb_build_object('id',al.id,'title',al.title)) FROM public.orange_photo_album_items ai JOIN public.orange_photo_albums al ON al.id=ai.album_id WHERE ai.photo_id=p.id) albums,(SELECT jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'slug',t.slug)) FROM public.orange_photo_tag_items ti JOIN public.orange_photo_tags t ON t.id=ti.tag_id WHERE ti.photo_id=p.id) tags ${joins} ${condition} ORDER BY p.captured_at ${order},p.created_at ${options.ascending ? "ASC" : "DESC"},p.id ${options.ascending ? "ASC" : "DESC"} LIMIT $${pagedValues.length - 1} OFFSET $${pagedValues.length}`, pagedValues)).rows;
  if (options.ascending) rows.reverse();
  await signPhotoFiles(rows);for(const row of rows)if(!row.is_owner&&row.visibility==='selected')row.is_shared_directly=row.shared_user_ids.map(String).includes(String(context.payload.auth.userId));return ok({ items: rows, page, per_page: per, total, has_more: page * per < total });
}

async function timeline(req) {
  const query = { ...(req.query || {}) };
  delete query.before;
  delete query.page;
  delete query.per_page;

  const context = buildPhotoQuery(req, query);
  if (!context.ok) return context;

  const { values, joins, condition } = context.payload;
  const rows = (
    await pool.query(
      `SELECT EXTRACT(YEAR FROM p.captured_at)::int AS year, EXTRACT(MONTH FROM p.captured_at)::int AS month, COUNT(*)::int AS count, MAX(p.captured_at) AS first_captured_at ${joins} ${condition} AND p.captured_at IS NOT NULL GROUP BY EXTRACT(YEAR FROM p.captured_at), EXTRACT(MONTH FROM p.captured_at) ORDER BY EXTRACT(YEAR FROM p.captured_at) DESC, EXTRACT(MONTH FROM p.captured_at) DESC`,
      values
    )
  ).rows;
  const years = new Map();
  for (const row of rows) {
    if (!years.has(row.year)) years.set(row.year, { year: row.year, months: [] });
    years.get(row.year).months.push({ month: row.month, count: row.count, first_captured_at: row.first_captured_at, cursor: row.first_captured_at });
  }
  return ok({ items: [...years.values()] });
}

async function purge(req, id) {
  const detailResult = await detail(req, id, { allowTrash: true });
  if (!detailResult.ok) return detailResult;
  const photo = detailResult.payload.item, auth = detailResult.payload.auth;
  if (!photo.is_owner) return bad(403, "Solo el propietario puede eliminar definitivamente la foto.");
  if (!photo.is_trashed) return bad(409, "La foto debe estar en la papelera antes de eliminarla definitivamente.");
  const files = (await pool.query(`SELECT id,bucket,object_key,variant,checksum_sha256 FROM public.orange_photo_files WHERE family_id=$1::uuid AND photo_id=$2::uuid ORDER BY CASE variant WHEN 'thumbnail' THEN 1 WHEN 'preview' THEN 2 WHEN 'poster' THEN 3 WHEN 'original' THEN 4 ELSE 5 END`, [auth.familyId, id])).rows;
  const checksum=String(files.find(file=>file.variant==="original")?.checksum_sha256||"").trim().toLowerCase();
  for (const file of files) await deleteOrangePhotoObject(file);
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    if(SHA256_RE.test(checksum))await client.query(`INSERT INTO public.orange_photo_upload_suppressions(family_id,owner_user_id,checksum_sha256) VALUES($1::uuid,$2::uuid,$3) ON CONFLICT(family_id,owner_user_id,checksum_sha256) DO UPDATE SET deleted_at=now()`,[auth.familyId,auth.userId,checksum]);
    await recordPhotoEvent(client,{familyId:auth.familyId,photoId:id,actorUserId:auth.userId,eventType:'purged',...clientContext(req),metadata:{photo_id:id,original_filename:photo.original_filename,checksum_sha256:SHA256_RE.test(checksum)?checksum:null,media_type:photo.media_type}});
    await client.query(`DELETE FROM public.orange_photos WHERE family_id=$1::uuid AND id=$2::uuid AND owner_user_id=$3::uuid AND is_trashed=true`, [auth.familyId, id, auth.userId]);
    await client.query("COMMIT");
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  return ok({ deleted: true, id, deleted_files: files.length });
}

async function emptyTrash(req) {
  const auth = resolveAuthenticatedFamily(req); if (!auth.ok) return auth;
  const ids = (await pool.query(`SELECT id FROM public.orange_photos WHERE family_id=$1::uuid AND owner_user_id=$2::uuid AND is_trashed=true ORDER BY trashed_at ASC,id ASC`, [auth.familyId, auth.userId])).rows.map(row => row.id);
  let deleted = 0; const failed = [];
  for (const id of ids) {
    try { const result = await purge(req, id); if (result.ok) deleted += 1; else failed.push({ id, message: result.reason }); }
    catch (error) { failed.push({ id, message: error.message }); }
  }
  return ok({ total: ids.length, deleted, failed });
}

async function aroundDate(req) {
  const date = new Date(req.query?.date); if (Number.isNaN(date.getTime())) return bad(400, "Fecha de salto no válida.");
  const direction = String(req.query?.direction || "");
  if (direction && direction !== "newer" && direction !== "older") return bad(400, "Dirección de paginación no válida.");
  const baseQuery = { ...(req.query || {}) };
  delete baseQuery.date; delete baseQuery.direction; delete baseQuery.before; delete baseQuery.before_exclusive; delete baseQuery.after; delete baseQuery.page;
  const pageQuery = direction === "newer"
    ? { ...baseQuery, after: date.toISOString(), page: 1 }
    : direction === "older"
      ? { ...baseQuery, before_exclusive: date.toISOString(), page: 1 }
      : { ...baseQuery, before: date.toISOString(), page: 1 };
  const result = await listSafe(req, pageQuery, { ascending: direction === "newer" });
  if (!result.ok) return result;
  const items = result.payload.items || [], newerCursor = items[0]?.captured_at || null, olderCursor = items[items.length - 1]?.captured_at || null;
  const context = buildPhotoQuery(req, baseQuery); if (!context.ok) return context;
  const { values, joins, condition } = context.payload;
  const newerBoundary = newerCursor || date.toISOString(), olderBoundary = olderCursor || date.toISOString();
  const bounds = (await pool.query(`SELECT EXISTS(SELECT 1 ${joins} ${condition} AND p.captured_at>$${values.length + 1}::timestamptz) has_newer,EXISTS(SELECT 1 ${joins} ${condition} AND p.captured_at<$${values.length + 2}::timestamptz) has_older`, [...values, newerBoundary, olderBoundary])).rows[0];
  return ok({ ...result.payload, items, has_newer: bounds.has_newer === true, has_older: bounds.has_older === true, newer_cursor: newerCursor, older_cursor: olderCursor });
}

async function events(req,id){
  const d=await detail(req,id,{allowTrash:true});if(!d.ok)return d;
  if(!d.payload.item.is_owner)return bad(403,"Solo el propietario puede consultar el historial de la foto.");
  const items=(await pool.query(`SELECT id,event_type,client_type,installation_id,actor_user_id,occurred_at,metadata FROM public.orange_photo_events WHERE family_id=$1::uuid AND photo_id=$2::uuid ORDER BY occurred_at DESC LIMIT 100`,[d.payload.auth.familyId,id])).rows;
  return ok({items});
}

module.exports={familyMembers,createFromExisting,upload,uploadDirect,checkUpload,checkStorageStatus,list:listSafe,timeline,aroundDate,detail,events,update,generateVideoPoster,trash,purge,emptyTrash,signedUrl,download,recordCompletedDownload,recordCompletedBulkDownload,downloadMany,downloadObject,share,albums,createAlbum,albumPhotoIds,updateAlbum,addPhoto,shareAlbum,tags,createTag,insertPhoto,recordPhotoEvent,clientContext,applyStoredImageMetadata,normalizeMetadata,validateMetadata,findPossibleDuplicate,findExactDuplicate,findUploadSuppression,uploadCheckDecision,normalizeDuplicateFilename,uploadModeFor,ok,bad,bool,MIME_EXT,MAX_IMAGE_BYTES,SIMPLE_VIDEO_MAX_BYTES,MAX_VIDEO_BYTES,MULTIPART_PART_BYTES,MULTIPART_UPLOAD_TTL_HOURS};
