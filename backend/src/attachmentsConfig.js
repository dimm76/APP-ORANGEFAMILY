const DEFAULT_MAX_MB = 10;
const DEFAULT_ALLOWED_MIME = "image/jpeg,image/png,image/webp,image/gif";
const DEFAULT_ENV_PREFIX = "app-orangefamily/staging";
const SIGNED_URL_SECONDS = 3600;

function parsePositiveInt(raw, fallback) {
  const value = Number(raw);

  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function getAttachmentsConfig() {
  const endpoint = String(process.env.WASABI_ENDPOINT || "").trim();
  const region = String(process.env.WASABI_REGION || "").trim();
  const bucket = String(process.env.WASABI_BUCKET || "").trim();
  const accessKeyId = String(process.env.WASABI_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(
    process.env.WASABI_SECRET_ACCESS_KEY || ""
  ).trim();

  const envPrefix = String(
    process.env.WASABI_ENV_PREFIX || DEFAULT_ENV_PREFIX
  )
    .trim()
    .replace(/^\/+|\/+$/g, "");

  const maxImageMb = parsePositiveInt(
    process.env.ATTACHMENTS_MAX_IMAGE_MB,
    DEFAULT_MAX_MB
  );

  const allowedMimeRaw = String(
    process.env.ATTACHMENTS_ALLOWED_IMAGE_MIME || DEFAULT_ALLOWED_MIME
  ).trim();

  const allowedMimeTypes = allowedMimeRaw
    .split(",")
    .map((mimeType) => mimeType.trim().toLowerCase())
    .filter(Boolean);

  const missing = [];

  if (!endpoint) missing.push("WASABI_ENDPOINT");
  if (!region) missing.push("WASABI_REGION");
  if (!bucket) missing.push("WASABI_BUCKET");
  if (!accessKeyId) missing.push("WASABI_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("WASABI_SECRET_ACCESS_KEY");

  if (!envPrefix.startsWith("app-orangefamily/")) {
    missing.push("WASABI_ENV_PREFIX válido");
  }

  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    envPrefix,
    maxImageBytes: maxImageMb * 1024 * 1024,
    allowedMimeTypes,
    signedUrlSeconds: SIGNED_URL_SECONDS,
    missing,
    configured: missing.length === 0,
  };
}

function mimeToExtension(mimeType) {
  const normalized = String(mimeType || "").trim().toLowerCase();

  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/gif") return "gif";

  return null;
}

module.exports = {
  getAttachmentsConfig,
  mimeToExtension,
};