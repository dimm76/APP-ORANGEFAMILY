/* global require, module, Buffer */
const { createHash, randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");

const {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} = require("@aws-sdk/client-s3");

const {
  getSignedUrl,
} = require("@aws-sdk/s3-request-presigner");

const {
  getAttachmentsConfig,
  mimeToExtension,
} = require("./attachmentsConfig");

let cachedClient = null;
let cachedClientKey = null;

function getS3Client() {
  const config = getAttachmentsConfig();

  if (!config.configured) {
    throw new Error(
      `Wasabi no configurado. Faltan: ${config.missing.join(", ")}`
    );
  }

  const clientKey = [
    config.endpoint,
    config.region,
    config.accessKeyId,
  ].join("|");

  if (cachedClient && cachedClientKey === clientKey) {
    return {
      client: cachedClient,
      config,
    };
  }

  cachedClient = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  cachedClientKey = clientKey;

  return {
    client: cachedClient,
    config,
  };
}

function assertStorageKeyInsideOrangeFamily(storageKey, envPrefix) {
  const key = String(storageKey || "").trim();
  const allowedPrefix = `${envPrefix}/attachments/`;

  if (!key.startsWith(allowedPrefix)) {
    throw new Error(
      "Objeto fuera del prefijo permitido de OrangeFamily."
    );
  }

  return key;
}

function assertReadableOrangePhotosStorageKey(storageKey, envPrefix) {
  const key = String(storageKey || "").trim();
  const currentPrefix = `${envPrefix}/orange-photos/`;
  if ((!key.startsWith(currentPrefix) && !key.startsWith("family_photos/")) || key.includes("..") || key.includes("\\")) {
    throw new Error("Objeto fuera del prefijo permitido de OrangePhotos.");
  }
  return key;
}

function assertWritableOrangePhotosStorageKey(storageKey, envPrefix) {
  const key = String(storageKey || "").trim();
  if (!key.startsWith(`${envPrefix}/orange-photos/`) || key.includes("..") || key.includes("\\")) {
    throw new Error("Objeto fuera del prefijo de escritura permitido de OrangePhotos.");
  }
  return key;
}

async function uploadOrangePhotoToWasabi(buffer, { familyId, mimeType, extension, originalFilename, variant = "original", checksumSha256 = null } = {}) {
  const { client, config } = getS3Client();
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("El archivo está vacío.");
  const now = new Date();
  const ext = String(extension || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const folder = variant === "poster" ? "posters" : variant === "preview" ? "previews" : "originals";
  const key = assertWritableOrangePhotosStorageKey(`${config.orangePhotosPrefix}/${folder}/${familyId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`, config.envPrefix);
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: buffer, ContentType: mimeType }));
  return { provider: "wasabi", bucket: config.bucket, object_key: key, mime_type: mimeType,
    original_filename: String(originalFilename || "archivo").slice(0, 500), size_bytes: buffer.length,
    checksum_sha256: checksumSha256 || createHash("sha256").update(buffer).digest("hex") };
}

function buildOrangePhotoObjectKey(config, familyId, extension) {
  const now = new Date();
  const ext = String(extension || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return assertWritableOrangePhotosStorageKey(`${config.orangePhotosPrefix}/originals/${familyId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`, config.envPrefix);
}

async function createOrangePhotoMultipartUpload({ familyId, mimeType, extension }) {
  const { client, config } = getS3Client();
  const objectKey = buildOrangePhotoObjectKey(config, familyId, extension);
  const result = await client.send(new CreateMultipartUploadCommand({ Bucket:config.bucket, Key:objectKey, ContentType:mimeType }));
  if (!result.UploadId) throw new Error("Wasabi no devolvió un identificador multipart.");
  return { provider:"wasabi", bucket:config.bucket, object_key:objectKey, provider_upload_id:String(result.UploadId) };
}

async function getOrangePhotoUploadPartUrl(record, partNumber, expiresIn = 900) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(record.object_key, config.envPrefix);
  return getSignedUrl(client, new UploadPartCommand({ Bucket:record.bucket || config.bucket, Key:key, UploadId:record.provider_upload_id, PartNumber:partNumber }), { expiresIn });
}

async function completeOrangePhotoMultipartUpload(record, parts) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(record.object_key, config.envPrefix);
  return client.send(new CompleteMultipartUploadCommand({ Bucket:record.bucket || config.bucket, Key:key, UploadId:record.provider_upload_id, MultipartUpload:{ Parts:parts.map(part => ({ PartNumber:part.part_number, ETag:part.etag })) } }));
}

async function abortOrangePhotoMultipartUpload(record) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(record.object_key, config.envPrefix);
  return client.send(new AbortMultipartUploadCommand({ Bucket:record.bucket || config.bucket, Key:key, UploadId:record.provider_upload_id }));
}

async function uploadOrangePhotoFileToWasabi(filePath, { familyId, mimeType, extension, originalFilename, sizeBytes, checksumSha256 } = {}) {
  const { client, config } = getS3Client();
  const objectKey = buildOrangePhotoObjectKey(config, familyId, extension);
  const created = await client.send(new CreateMultipartUploadCommand({ Bucket:config.bucket, Key:objectKey, ContentType:mimeType }));
  if (!created.UploadId) throw new Error("Wasabi no devolvió un identificador multipart.");
  const record={bucket:config.bucket,object_key:objectKey,provider_upload_id:String(created.UploadId)};
  let handle;
  try {
    handle=await fs.open(filePath,"r");
    const parts=[];let position=0,partNumber=1;
    while(position<Number(sizeBytes)){
      const buffer=Buffer.allocUnsafe(Math.min(25*1024*1024,Number(sizeBytes)-position));
      const {bytesRead}=await handle.read(buffer,0,buffer.length,position);
      if(!bytesRead)throw new Error("El archivo temporal terminó antes de lo esperado.");
      const uploaded=await client.send(new UploadPartCommand({Bucket:config.bucket,Key:objectKey,UploadId:record.provider_upload_id,PartNumber:partNumber,Body:buffer.subarray(0,bytesRead),ContentLength:bytesRead}));
      if(!uploaded.ETag)throw new Error("Wasabi no devolvió el ETag de una parte.");
      parts.push({PartNumber:partNumber,ETag:uploaded.ETag});position+=bytesRead;partNumber+=1;
    }
    const completed=await client.send(new CompleteMultipartUploadCommand({Bucket:config.bucket,Key:objectKey,UploadId:record.provider_upload_id,MultipartUpload:{Parts:parts}}));
    return {provider:"wasabi",bucket:config.bucket,object_key:objectKey,mime_type:mimeType,original_filename:String(originalFilename||"archivo").slice(0,500),size_bytes:Number(sizeBytes),checksum_sha256:checksumSha256,etag:completed.ETag||null};
  } catch(error) {
    try{await client.send(new AbortMultipartUploadCommand({Bucket:config.bucket,Key:objectKey,UploadId:record.provider_upload_id}));}
    catch(abortError){console.error("OrangePhotos server multipart abort",{object_key:objectKey,message:abortError.message});}
    throw error;
  } finally {
    if(handle)try{await handle.close();}catch(error){console.error("OrangePhotos server multipart file close",{object_key:objectKey,message:error.message});}
  }
}

async function getSignedOrangePhotoUrl(record) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(record.object_key, config.envPrefix);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: record.bucket || config.bucket, Key: key }), { expiresIn: config.signedUrlSeconds });
}

async function getOrangePhotoObjectStream(record) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(record.object_key, config.envPrefix);
  const result = await sendWithTimeout(client, new GetObjectCommand({ Bucket: record.bucket || config.bucket, Key: key }), 120000, "GetObject", key);
  if (!result.Body) throw new Error("El objeto de OrangePhotos está vacío.");
  return { Body: result.Body, ContentType: result.ContentType || record.mime_type || "application/octet-stream", ContentLength: result.ContentLength == null ? null : Number(result.ContentLength) };
}

function normalizeEtag(value) {
  return value == null ? null : String(value).replace(/^"|"$/g, "");
}

async function sendWithTimeout(client, command, timeoutMs, stage, objectKey = null, consume = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await client.send(command, { abortSignal: controller.signal });
    return consume ? await consume(result) : result;
  } catch (error) {
    if (controller.signal.aborted || error?.name === "AbortError") {
      throw new Error(`Timeout en ${stage}${objectKey ? `: ${objectKey}` : ""}.`);
    }
    const detail = error?.message || error?.Code || error?.code || error?.name || "error desconocido";
    throw new Error(`Error en ${stage}${objectKey ? `: ${objectKey}` : ""}: ${detail}.`);
  } finally {
    clearTimeout(timer);
  }
}

async function listOrangePhotosObjects({
  prefix = null,
  continuationToken = null,
  maxKeys = 1000,
} = {}) {
  const { client, config } = getS3Client();
  const safePrefix = String(prefix || `${config.orangePhotosPrefix}/`);
  const safeMaxKeys = Number(maxKeys);
  if (!safePrefix.startsWith(`${config.orangePhotosPrefix}/`) || safePrefix.includes("..") || safePrefix.includes("\\")) {
    throw new Error("Prefijo de OrangePhotos no válido.");
  }
  if (!Number.isInteger(safeMaxKeys) || safeMaxKeys < 1 || safeMaxKeys > 1000) {
    throw new Error("maxKeys debe ser un entero entre 1 y 1000.");
  }
  const result = await sendWithTimeout(client, new ListObjectsV2Command({ Bucket: config.bucket, Prefix: safePrefix, ContinuationToken: continuationToken || undefined, MaxKeys: safeMaxKeys }), 30000, "ListObjectsV2");
  return {
    objects: (result.Contents || []).map(item => ({ key: String(item.Key || ""), size: Number(item.Size || 0), etag: normalizeEtag(item.ETag), last_modified: item.LastModified instanceof Date ? item.LastModified.toISOString() : null, storage_class: item.StorageClass ? String(item.StorageClass) : null })),
    next_token: result.NextContinuationToken || null,
    is_truncated: Boolean(result.IsTruncated),
  };
}

async function headOrangePhotoObject(objectKey) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(objectKey, config.envPrefix);
  const result = await sendWithTimeout(client, new HeadObjectCommand({ Bucket: config.bucket, Key: key }), 30000, "HeadObject", key);
  return { content_type: result.ContentType ? String(result.ContentType).toLowerCase() : null, content_length: Number(result.ContentLength || 0), last_modified: result.LastModified instanceof Date ? result.LastModified.toISOString() : null, etag: normalizeEtag(result.ETag), metadata: result.Metadata && typeof result.Metadata === "object" ? { ...result.Metadata } : {} };
}

async function getOrangePhotoObjectBuffer(objectKey) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(objectKey, config.envPrefix);
  return sendWithTimeout(client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), 120000, "GetObject", key, async result => {
    if (!result.Body) throw new Error("El objeto de OrangePhotos está vacío.");
    const buffer = Buffer.from(await result.Body.transformToByteArray());
    if (!buffer.length) throw new Error("El objeto de OrangePhotos está vacío.");
    return buffer;
  });
}

async function uploadImageToWasabi(buffer, metadata = {}) {
  const { client, config } = getS3Client();

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("El archivo está vacío.");
  }

  const mimeType = String(metadata.mimeType || "")
    .trim()
    .toLowerCase();

  if (!config.allowedMimeTypes.includes(mimeType)) {
    throw new Error("Tipo MIME no permitido.");
  }

  if (buffer.length > config.maxImageBytes) {
    throw new Error("La imagen supera el tamaño máximo permitido.");
  }

  const extension = mimeToExtension(mimeType);

  if (!extension) {
    throw new Error("Extensión no soportada.");
  }

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fileId = randomUUID();

  const storageKey =
    `${config.envPrefix}/attachments/` +
    `${year}/${month}/${fileId}.${extension}`;

  assertStorageKeyInsideOrangeFamily(
    storageKey,
    config.envPrefix
  );

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    })
  );

  return {
    storage_provider: "wasabi",
    bucket: config.bucket,
    storage_key: storageKey,
    original_filename: metadata.originalFilename
      ? String(metadata.originalFilename).slice(0, 500)
      : null,
    mime_type: mimeType,
    size_bytes: buffer.length,
    checksum: createHash("sha256")
      .update(buffer)
      .digest("hex"),
  };
}

async function getSignedUrlForStorageKey(record) {
  const { client, config } = getS3Client();

  const storageKey = assertStorageKeyInsideOrangeFamily(
    record.storage_key,
    config.envPrefix
  );

  const command = new GetObjectCommand({
    Bucket: record.bucket || config.bucket,
    Key: storageKey,
  });

  return getSignedUrl(client, command, {
    expiresIn: config.signedUrlSeconds,
  });
}

async function getObjectBufferFromWasabi(record) {
  const { client, config } = getS3Client();

  const storageKey = assertStorageKeyInsideOrangeFamily(
    record.storage_key,
    config.envPrefix
  );

  const result = await client.send(
    new GetObjectCommand({
      Bucket: record.bucket || config.bucket,
      Key: storageKey,
    })
  );

  if (!result.Body) {
    throw new Error("El objeto de Wasabi está vacío.");
  }

  const bytes = await result.Body.transformToByteArray();

  return Buffer.from(bytes);
}

async function deleteObjectFromWasabi(record) {
  const { client, config } = getS3Client();

  const storageKey = assertStorageKeyInsideOrangeFamily(
    record.storage_key,
    config.envPrefix
  );

  await client.send(
    new DeleteObjectCommand({
      Bucket: record.bucket || config.bucket,
      Key: storageKey,
    })
  );
}

async function deleteOrangePhotoObject(record) {
  const { client, config } = getS3Client();
  const key = assertReadableOrangePhotosStorageKey(record.object_key, config.envPrefix);

  if (key.startsWith("family_photos/") && config.envPrefix !== "app-orangefamily/production") {
    console.warn("OrangePhotos omite el borrado fÃ­sico de un objeto legacy fuera de producciÃ³n.", { object_key: key });
    return { deleted: false, skipped_legacy_delete: true };
  }

  await sendWithTimeout(
    client,
    new DeleteObjectCommand({
      Bucket: record.bucket || config.bucket,
      Key: key,
    }),
    30000,
    "DeleteObject",
    key
  );
  return { deleted: true, skipped_legacy_delete: false };
}

module.exports = {
  uploadImageToWasabi,
  getSignedUrlForStorageKey,
  getObjectBufferFromWasabi,
  deleteObjectFromWasabi,
  deleteOrangePhotoObject,
  assertReadableOrangePhotosStorageKey,
  assertWritableOrangePhotosStorageKey,
  uploadOrangePhotoToWasabi,
  getSignedOrangePhotoUrl,
  getOrangePhotoObjectStream,
  listOrangePhotosObjects,
  headOrangePhotoObject,
  getOrangePhotoObjectBuffer,
  createOrangePhotoMultipartUpload,
  getOrangePhotoUploadPartUrl,
  completeOrangePhotoMultipartUpload,
  abortOrangePhotoMultipartUpload,
  uploadOrangePhotoFileToWasabi,
};
