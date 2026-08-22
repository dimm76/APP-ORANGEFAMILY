/* global require */
const test = require("node:test");
const assert = require("node:assert/strict");

for (const key of ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"]) process.env[key] ||= "test";
process.env.DB_PORT = "5432";

const pool = require("../db");
const service = require("../src/orangePhotosService");

const req = {
  user: {
    id: "11111111-1111-4111-8111-111111111111",
    families: [{ id: "22222222-2222-4222-8222-222222222222", role: "member" }],
  },
  headers: {},
};

async function check(sizeBytes) {
  const originalQuery = pool.query;
  pool.query = async () => ({ rows: [] });
  try {
    return await service.checkUpload(req, {
      original_filename: "video.mp4",
      size_bytes: sizeBytes,
      mime_type: "video/mp4",
    });
  } finally {
    pool.query = originalQuery;
  }
}

test("check conserva simple en el umbral de vídeo simple", async () => {
  const result = await check(service.SIMPLE_VIDEO_MAX_BYTES);
  assert.equal(result.ok, true);
  assert.equal(result.payload.upload_mode, "simple");
});

test("check devuelve multipart por encima del umbral de vídeo simple", async () => {
  const result = await check(service.SIMPLE_VIDEO_MAX_BYTES + 1);
  assert.equal(result.ok, true);
  assert.equal(result.payload.upload_mode, "multipart");
});

test("check con checksum nuevo devuelve upload_required sin supresión", async () => {
  const originalQuery = pool.query;

  pool.query = async () => ({ rows: [] });

  try {
    const result = await service.checkUpload(req, {
      original_filename: "foto.jpg",
      size_bytes: 1024,
      mime_type: "image/jpeg",
      checksum_sha256: "a".repeat(64),
    });

    assert.equal(result.ok, true);
    assert.equal(result.payload.decision, "upload_required");
    assert.equal(result.payload.upload_mode, "simple");
  } finally {
    pool.query = originalQuery;
  }
});
