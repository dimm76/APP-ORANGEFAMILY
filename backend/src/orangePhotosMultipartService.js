/* global require, module, Buffer, setImmediate */
const { createHash } = require("node:crypto");
const pool = require("../db");
const photos = require("./orangePhotosService");
const {
  abortOrangePhotoMultipartUpload,
  completeOrangePhotoMultipartUpload,
  createOrangePhotoMultipartUpload,
  deleteOrangePhotoObject,
  getOrangePhotoObjectStream,
  getOrangePhotoUploadPartUrl,
  headOrangePhotoObject,
  listOrangePhotoMultipartParts,
} = require("./wasabiClient");
const { processStoredOrangePhotoVideo } = require("./orangePhotosVideoProcessor");

const URL_EXPIRES_SECONDS = 900;
const ACTIVE_STATUSES = new Set(["initiated", "uploading"]);
const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function log(stage,error,upload={}){console.error(`OrangePhotos ${stage}`,{upload_id:upload.id||null,photo_id:upload.photo_id||null,object_key:upload.object_key||null,message:error?.message||String(error)});}
function partsTotal(upload){return Math.ceil(Number(upload.size_bytes)/photos.MULTIPART_PART_BYTES);}
function expired(upload){return new Date(upload.expires_at).getTime()<=Date.now();}
function missingMultipart(error){return ["NoSuchUpload","NotFound","404"].includes(String(error?.name||error?.Code||error?.$metadata?.httpStatusCode));}

async function ownedUpload(req,id){
  const auth=photos.resolveOrangePhotosFamily(req);if(!auth.ok)return auth;
  if(!UUID_RE.test(String(id||"")))return photos.bad(404,"UPLOAD_NOT_FOUND","Subida no encontrada.");
  const row=(await pool.query(`SELECT * FROM public.orange_photo_uploads WHERE id=$1::uuid AND family_id=$2::uuid AND owner_user_id=$3::uuid`,[id,auth.familyId,auth.userId])).rows[0];
  if(!row)return photos.bad(404,"UPLOAD_NOT_FOUND","Subida no encontrada.");
  if(String(row.family_id)!==String(auth.familyId)||String(row.owner_user_id)!==String(auth.userId))return photos.bad(404,"UPLOAD_NOT_FOUND","Subida no encontrada.");
  return photos.ok({auth,upload:row});
}

async function initiate(req,body={}){
  const auth=photos.resolveOrangePhotosFamily(req);if(!auth.ok)return auth;
  const originalFilename=String(body.original_filename||"").replace(/\\/g,"/").split("/").pop().trim().normalize("NFKC").replace(/\s+/g," ").slice(0,500),size=Number(body.size_bytes),mime=String(body.mime_type||"").toLowerCase();
  const clientUploadKey=String(body.client_upload_key||"").trim().slice(0,200)||null;
  if(!originalFilename)return photos.bad(400,"INVALID_METADATA","Nombre original obligatorio.");
  const mode=photos.uploadModeFor(mime,size);if(!mode.ok)return mode;
  const mediaType=mime.startsWith("image/")?"image":"video";
  const metadata=photos.normalizeMetadata({...(body.metadata||{}),original_filename:originalFilename,mime_type:mime,media_type:mediaType});
  const invalid=photos.validateMetadata(metadata);if(invalid)return invalid;
  if(clientUploadKey){
    const existing=(await pool.query(`SELECT * FROM public.orange_photo_uploads WHERE family_id=$1::uuid AND owner_user_id=$2::uuid AND client_upload_key=$3 AND status IN ('initiated','uploading','completing','processing') AND expires_at>now() ORDER BY created_at DESC LIMIT 1`,[auth.familyId,auth.userId,clientUploadKey])).rows[0];
    if(existing){
      if(existing.original_filename!==originalFilename||Number(existing.size_bytes)!==size||existing.mime_type!==mime)return photos.bad(409,"UPLOAD_CLIENT_KEY_CONFLICT","La clave de subida ya está asociada a otro archivo.");
      return photos.ok({upload:{id:existing.id,part_size:photos.MULTIPART_PART_BYTES,parts_total:partsTotal(existing),expires_at:existing.expires_at,status:existing.status,resumed:true}});
    }
  }
  const duplicate=await photos.findPossibleDuplicate(auth.familyId,auth.userId,originalFilename,size);
  if(duplicate&&body.force_possible_duplicate!==true)return photos.bad(409,"POSSIBLE_DUPLICATE","Existe un archivo con el mismo nombre y tamaño.",{duplicate});
  let storage;
  try{storage=await createOrangePhotoMultipartUpload({familyId:auth.familyId,mimeType:mime,extension:metadata.extension});}
  catch(error){log("multipart init",error);return photos.bad(502,"STORAGE_INIT_FAILED","No se pudo iniciar la subida en el almacenamiento.");}
  const expiresAt=new Date(Date.now()+photos.MULTIPART_UPLOAD_TTL_HOURS*60*60*1000);
  try{
    const upload=(await pool.query(`INSERT INTO public.orange_photo_uploads(family_id,owner_user_id,provider,bucket,object_key,provider_upload_id,original_filename,mime_type,extension,media_type,size_bytes,metadata_json,expires_at,client_upload_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14) RETURNING id,status,expires_at`,[auth.familyId,auth.userId,storage.provider,storage.bucket,storage.object_key,storage.provider_upload_id,originalFilename,mime,metadata.extension,mediaType,String(size),JSON.stringify({metadata,force_duplicate:body.force_duplicate===true}),expiresAt,clientUploadKey])).rows[0];
    return photos.ok({upload:{id:upload.id,part_size:photos.MULTIPART_PART_BYTES,parts_total:Math.ceil(size/photos.MULTIPART_PART_BYTES),expires_at:upload.expires_at,status:upload.status,resumed:false}});
  }catch(error){
    const raceLost=error?.code==="23505"&&error?.constraint==="uq_orange_photo_uploads_owner_client_key";
    console.error("OrangePhotos multipart database init",{code:error?.code||null,constraint:error?.constraint||null,client_upload_key:clientUploadKey,original_filename:originalFilename,object_key:storage.object_key||null});
    try{await abortOrangePhotoMultipartUpload(storage);}catch(cleanupError){console.error("OrangePhotos multipart init cleanup",{code:cleanupError?.code||cleanupError?.name||null,constraint:cleanupError?.constraint||null,client_upload_key:clientUploadKey,original_filename:originalFilename,object_key:storage.object_key||null});}
    if(raceLost){
      const winner=(await pool.query(`SELECT * FROM public.orange_photo_uploads WHERE family_id=$1::uuid AND owner_user_id=$2::uuid AND client_upload_key=$3 AND status IN ('initiated','uploading','completing','processing') AND expires_at>now() ORDER BY created_at DESC LIMIT 1`,[auth.familyId,auth.userId,clientUploadKey])).rows[0];
      if(winner){
        if(winner.original_filename!==originalFilename||Number(winner.size_bytes)!==size||winner.mime_type!==mime)return photos.bad(409,"UPLOAD_CLIENT_KEY_CONFLICT","La clave de subida ya pertenece a otro archivo.");
        return photos.ok({upload:{id:winner.id,part_size:photos.MULTIPART_PART_BYTES,parts_total:Math.ceil(Number(winner.size_bytes)/photos.MULTIPART_PART_BYTES),expires_at:winner.expires_at,status:winner.status,resumed:true}});
      }
    }
    return photos.bad(500,"DATABASE_REGISTRATION_FAILED","La subida se inició, pero no pudo registrarse.");
  }
}

async function signParts(req,id,body={}){
  const found=await ownedUpload(req,id);if(!found.ok)return found;const upload=found.payload.upload;
  if(expired(upload))return photos.bad(410,"UPLOAD_EXPIRED","La subida ha caducado.");
  if(!ACTIVE_STATUSES.has(upload.status))return photos.bad(409,"UPLOAD_INVALID_STATUS","La subida no permite firmar partes en su estado actual.");
  const numbers=body.part_numbers;
  if(!Array.isArray(numbers)||numbers.length<1||numbers.length>10||new Set(numbers).size!==numbers.length||numbers.some(value=>!Number.isInteger(value)||value<1||value>partsTotal(upload)))return photos.bad(400,"UPLOAD_PART_INVALID","Los números de parte no son válidos.");
  const parts=[];try{for(const partNumber of numbers)parts.push({part_number:partNumber,url:await getOrangePhotoUploadPartUrl(upload,partNumber,URL_EXPIRES_SECONDS),expires_in:URL_EXPIRES_SECONDS});}
  catch(error){log("multipart sign",error,upload);return photos.bad(502,"STORAGE_SIGN_FAILED","No se pudieron preparar las partes de la subida.");}
  await pool.query(`UPDATE public.orange_photo_uploads SET status='uploading' WHERE id=$1::uuid`,[upload.id]);return photos.ok({parts});
}

function validateCompletedParts(upload,parts){const total=partsTotal(upload);if(!Array.isArray(parts)||parts.length!==total)return false;const sorted=[...parts].sort((a,b)=>a.part_number-b.part_number);return sorted.every((part,index)=>part&&part.part_number===index+1&&typeof part.etag==="string"&&part.etag.trim());}
async function failUpload(upload,code,message){await pool.query(`UPDATE public.orange_photo_uploads SET status='failed',error_code=$2,error_message=$3 WHERE id=$1::uuid`,[upload.id,code,message]);return photos.bad(code==="DUPLICATE_FILE"?409:502,code,message);}

async function complete(req,id,body={}){
  const found=await ownedUpload(req,id);if(!found.ok)return found;const upload=found.payload.upload;
  if(expired(upload))return photos.bad(410,"UPLOAD_EXPIRED","La subida ha caducado.");
  if(!ACTIVE_STATUSES.has(upload.status))return photos.bad(409,"UPLOAD_INVALID_STATUS","La subida no puede completarse en su estado actual.");
  if(!validateCompletedParts(upload,body.parts))return photos.bad(400,"UPLOAD_PART_INVALID","La lista de partes no es válida.");
  const parts=[...body.parts].sort((a,b)=>a.part_number-b.part_number).map(part=>({part_number:part.part_number,etag:part.etag.trim(),size_bytes:Number(part.size_bytes)||undefined}));
  await pool.query(`UPDATE public.orange_photo_uploads SET status='completing',uploaded_parts=$2::jsonb WHERE id=$1::uuid`,[upload.id,JSON.stringify(parts)]);
  try{await completeOrangePhotoMultipartUpload(upload,parts);}catch(error){log("multipart complete",error,upload);return failUpload(upload,"STORAGE_COMPLETE_FAILED","No se pudo completar la subida en el almacenamiento.");}
  let head;try{head=await headOrangePhotoObject(upload.object_key);}catch(error){log("multipart verify",error,upload);try{await deleteOrangePhotoObject(upload);}catch(cleanupError){log("multipart verify cleanup",cleanupError,upload);}return failUpload(upload,"STORAGE_VERIFY_FAILED","No se pudo verificar el archivo recibido.");}
  if(head.content_length!==Number(upload.size_bytes)){try{await deleteOrangePhotoObject(upload);}catch(error){log("multipart verify cleanup",error,upload);}return failUpload(upload,"STORAGE_VERIFY_FAILED","El archivo recibido no coincide con el tamaño original.");}
  await pool.query(`UPDATE public.orange_photo_uploads SET status='processing' WHERE id=$1::uuid`,[upload.id]);
  let checksum,imageBuffer=null;
  try{const object=await getOrangePhotoObjectStream(upload),hash=createHash("sha256"),chunks=upload.media_type==="image"?[]:null;for await(const chunk of object.Body){hash.update(chunk);if(chunks)chunks.push(chunk);}checksum=hash.digest("hex");if(chunks)imageBuffer=Buffer.concat(chunks);}
  catch(error){log("multipart hash",error,upload);try{await deleteOrangePhotoObject(upload);}catch(cleanupError){log("multipart hash cleanup",cleanupError,upload);}return failUpload(upload,"HASH_CALCULATION_FAILED","No se pudo verificar el contenido del archivo.");}
  const duplicate=await photos.findExactDuplicate(upload.family_id,upload.owner_user_id,checksum),config=upload.metadata_json||{};
  if(duplicate&&!config.force_duplicate){try{await deleteOrangePhotoObject(upload);}catch(error){log("multipart duplicate cleanup",error,upload);}await pool.query(`UPDATE public.orange_photo_uploads SET status='aborted',error_code='DUPLICATE_FILE',error_message=$2 WHERE id=$1::uuid`,[upload.id,"Este archivo ya existe en OrangePhotos."]);return photos.bad(409,"DUPLICATE_FILE","Este archivo ya existe en OrangePhotos.",{duplicate});}
  const suppression=await photos.findUploadSuppression(upload.family_id,upload.owner_user_id,checksum);
  if(suppression&&!config.force_duplicate){try{await deleteOrangePhotoObject(upload);}catch(error){log("multipart suppression cleanup",error,upload);}const message="Este archivo fue eliminado anteriormente y no se volverá a subir automáticamente.";await pool.query(`UPDATE public.orange_photo_uploads SET status='aborted',error_code='UPLOAD_SUPPRESSED',error_message=$2 WHERE id=$1::uuid`,[upload.id,message]);return photos.bad(409,"UPLOAD_SUPPRESSED",message);}
  const metadata=config.metadata||photos.normalizeMetadata({original_filename:upload.original_filename,mime_type:upload.mime_type,media_type:upload.media_type});
  if(upload.media_type==="image")await photos.applyStoredImageMetadata(imageBuffer,metadata);
  let result;try{result=await photos.insertPhoto(found.payload.auth,metadata,{provider:upload.provider,bucket:upload.bucket,object_key:upload.object_key,mime_type:upload.mime_type,size_bytes:Number(upload.size_bytes),checksum_sha256:checksum,etag:head.etag},null,null,config.force_duplicate&&suppression?checksum:null,photos.clientContext(req),"multipart");}
  catch(error){log("multipart database registration",error,upload);try{await deleteOrangePhotoObject(upload);}catch(cleanupError){log("multipart database cleanup",cleanupError,upload);}await pool.query(`UPDATE public.orange_photo_uploads SET status='failed',error_code='DATABASE_REGISTRATION_FAILED',error_message=$2 WHERE id=$1::uuid`,[upload.id,"El archivo se transfirió, pero no pudo registrarse."]);return photos.bad(500,"DATABASE_REGISTRATION_FAILED","El archivo se transfirió, pero no pudo registrarse.");}
  await pool.query(`UPDATE public.orange_photo_uploads SET status='completed',completed_at=now(),error_code=NULL,error_message=NULL WHERE id=$1::uuid`,[upload.id]);
  const photoId=result.payload.item.id;if(upload.media_type==="video")setImmediate(()=>processStoredOrangePhotoVideo(photoId,{createPoster:true,createPreview:true,updateMetadata:true}).catch(async error=>{log("video processing",error,{...upload,photo_id:photoId});try{await pool.query(`UPDATE public.orange_photo_uploads SET error_code='VIDEO_PROCESSING_FAILED',error_message=$2 WHERE id=$1::uuid`,[upload.id,"El vídeo se ha guardado, pero no se pudo generar su vista previa."]);}catch(updateError){log("video processing status",updateError,{...upload,photo_id:photoId});}}));
  return photos.ok({item:result.payload.item,warning:null});
}

async function abort(req,id){const found=await ownedUpload(req,id);if(!found.ok)return found;const upload=found.payload.upload;if(!["initiated","uploading","failed"].includes(upload.status))return photos.bad(409,"UPLOAD_INVALID_STATUS","La subida no puede cancelarse en su estado actual.");try{await abortOrangePhotoMultipartUpload(upload);}catch(error){if(!missingMultipart(error)){log("multipart abort",error,upload);return photos.bad(502,"UPLOAD_ABORT_FAILED","No se pudo cancelar la subida en el almacenamiento.");}}await pool.query(`UPDATE public.orange_photo_uploads SET status='aborted',error_code=NULL,error_message=NULL WHERE id=$1::uuid`,[upload.id]);return photos.ok({aborted:true});}

async function status(req,id){
  const found=await ownedUpload(req,id);if(!found.ok)return found;let u=found.payload.upload;let completedParts=[];
  if(ACTIVE_STATUSES.has(u.status)){try{completedParts=await listOrangePhotoMultipartParts(u);}catch(error){if(!missingMultipart(error))throw error;u=(await pool.query(`SELECT * FROM public.orange_photo_uploads WHERE id=$1::uuid`,[u.id])).rows[0];if(!["completed","processing"].includes(u.status)){const code=expired(u)?"UPLOAD_EXPIRED":"UPLOAD_NOT_FOUND";await pool.query(`UPDATE public.orange_photo_uploads SET status='failed',error_code=$2,error_message=$3 WHERE id=$1::uuid`,[u.id,code,"La sesión multipart ya no está disponible."]);u={...u,status:"failed",error_code:code,error_message:"La sesión multipart ya no está disponible."};}}}
  else if(Array.isArray(u.uploaded_parts)&&u.uploaded_parts.length)completedParts=u.uploaded_parts;
  return photos.ok({upload:{id:u.id,original_filename:u.original_filename,mime_type:u.mime_type,media_type:u.media_type,size_bytes:Number(u.size_bytes),part_size:photos.MULTIPART_PART_BYTES,parts_total:partsTotal(u),status:u.status,error_code:u.error_code,error_message:u.error_message,created_at:u.created_at,updated_at:u.updated_at,completed_at:u.completed_at,expires_at:u.expires_at,completed_parts:completedParts}});
}

async function listActive(req){const auth=photos.resolveOrangePhotosFamily(req);if(!auth.ok)return auth;const uploads=(await pool.query(`SELECT id,client_upload_key,original_filename,mime_type,media_type,size_bytes,status,created_at,updated_at,expires_at FROM public.orange_photo_uploads WHERE family_id=$1::uuid AND owner_user_id=$2::uuid AND status IN ('initiated','uploading','completing','processing') AND expires_at>now() ORDER BY created_at ASC`,[auth.familyId,auth.userId])).rows.map(upload=>({...upload,size_bytes:Number(upload.size_bytes)}));return photos.ok({uploads});}

module.exports={initiate,signParts,complete,abort,status,listActive};
