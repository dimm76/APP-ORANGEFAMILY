const { createHash, randomUUID } = require("node:crypto");

const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
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

function assertOrangePhotosStorageKey(storageKey) {
  const key = String(storageKey || "").trim();
  if (!key.startsWith("family_photos/") || key.includes("..") || key.includes("\\")) {
    throw new Error("Objeto fuera del prefijo permitido de OrangePhotos.");
  }
  return key;
}

async function uploadOrangePhotoToWasabi(buffer, { familyId, mimeType, extension, originalFilename } = {}) {
  const { client, config } = getS3Client();
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("El archivo está vacío.");
  const now = new Date();
  const ext = String(extension || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = assertOrangePhotosStorageKey(`family_photos/originals/${familyId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`);
  await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: buffer, ContentType: mimeType }));
  return { provider: "wasabi", bucket: config.bucket, object_key: key, mime_type: mimeType,
    original_filename: String(originalFilename || "archivo").slice(0, 500), size_bytes: buffer.length,
    checksum_sha256: createHash("sha256").update(buffer).digest("hex") };
}

async function getSignedOrangePhotoUrl(record) {
  const { client, config } = getS3Client();
  const key = assertOrangePhotosStorageKey(record.object_key);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: record.bucket || config.bucket, Key: key }), { expiresIn: config.signedUrlSeconds });
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

module.exports = {
  uploadImageToWasabi,
  getSignedUrlForStorageKey,
  getObjectBufferFromWasabi,
  deleteObjectFromWasabi,
  assertOrangePhotosStorageKey,
  uploadOrangePhotoToWasabi,
  getSignedOrangePhotoUrl,
};
