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

test("insertPhoto crea la copia lógica inicial desde metadata sin releer campos mutables legacy", async () => {
  const originalConnect = pool.connect;
  const queries = [];
  const familyId = "22222222-2222-4222-8222-222222222222";
  const userId = "11111111-1111-4111-8111-111111111111";
  const photoId = "33333333-3333-4333-8333-333333333333";
  const createdAt = "2026-08-19T16:40:00.000Z";
  const metadata = {
    media_type: "photo",
    title: "Canónico",
    description: "Descripción canónica",
    original_filename: "canonica.jpg",
    mime_type: "image/jpeg",
    extension: "jpg",
    captured_at: "2026-08-18T10:20:00.000Z",
    captured_at_source: "exif",
    timezone: "Europe/Madrid",
    width: 1200,
    height: 800,
    duration_seconds: null,
    orientation: 1,
    camera_make: "Orange",
    camera_model: "Orange One",
    lens_model: "Standard",
    latitude: 39.4702,
    longitude: -0.3768,
    altitude_meters: 15,
    location_name: "Valencia",
    location_country: "España",
    location_region: "Comunitat Valenciana",
    location_locality: "Valencia",
    location_source: "exif",
    exif_json: { source: "test" },
    visibility: "private",
  };
  const storage = {
    provider: "wasabi",
    bucket: "orangefamily",
    object_key: "original/canonica.jpg",
    mime_type: "image/jpeg",
    size_bytes: 2048,
    checksum_sha256: "a".repeat(64),
    etag: "etag",
  };
  const client = {
    query: async (text, params) => {
      queries.push({ text: String(text), params });
      if (String(text).includes("INSERT INTO public.orange_photos")) {
        return { rows: [{ id: photoId, created_at: createdAt }] };
      }
      return { rows: [] };
    },
    release: () => {},
  };

  pool.connect = async () => client;
  try {
    const result = await service.insertPhoto({ familyId, userId }, metadata, storage);
    const libraryInsert = queries.find(({ text }) =>
      text.includes("INSERT INTO public.orange_photo_library_items"),
    );

    assert.ok(libraryInsert);
    assert.match(libraryInsert.text, /VALUES/);
    assert.equal(
      (libraryInsert.text.match(/SELECT created_at FROM public\.orange_photos WHERE id=\$1::uuid AND owner_user_id=\$2::uuid/g) || []).length,
      1,
    );
    assert.doesNotMatch(
      libraryInsert.text,
      /SELECT id,owner_user_id,created_at,title,description,captured_at/,
    );
    for (const field of [
      "title",
      "description",
      "captured_at",
      "captured_at_source",
      "timezone",
      "latitude",
      "longitude",
      "altitude_meters",
      "location_name",
      "location_country",
      "location_region",
      "location_locality",
      "location_source",
      "visibility",
      "is_trashed",
      "trashed_at",
      "public_enabled",
      "public_token",
      "public_created_at",
      "public_revoked_at",
    ]) {
      assert.doesNotMatch(
        libraryInsert.text,
        new RegExp(`SELECT[^;]*${field}`),
      );
    }
    assert.deepEqual(libraryInsert.params, [
      photoId,
      userId,
      metadata.title,
      metadata.description,
      metadata.captured_at,
      metadata.captured_at_source,
      metadata.timezone,
      metadata.latitude,
      metadata.longitude,
      metadata.altitude_meters,
      metadata.location_name,
      metadata.location_country,
      metadata.location_region,
      metadata.location_locality,
      metadata.location_source,
      metadata.visibility,
    ]);
    assert.equal(result.ok, true);
  } finally {
    pool.connect = originalConnect;
  }
});
