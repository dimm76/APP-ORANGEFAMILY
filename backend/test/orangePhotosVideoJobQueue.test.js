const test = require("node:test");
const assert = require("node:assert/strict");
process.env.DB_HOST ||= "test";
process.env.DB_PORT ||= "5432";
process.env.DB_NAME ||= "test";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
const pool = require("../db");
const queue = require("../src/orangePhotosVideoJobQueue");

test("prioridades y encolado", async () => {
  assert.ok(queue.VIDEO_JOB_PRIORITY.NEW_UPLOAD > queue.VIDEO_JOB_PRIORITY.HISTORICAL_RECONCILIATION);
  const original = pool.query;
  const calls = [];
  pool.query = async (sql, values) => { calls.push({ sql:String(sql), values }); return { rowCount:1, rows:[{ source:values[1], priority:values[2] }] }; };
  try {
    await queue.enqueueNewUploadVideoJob("photo", {});
    await queue.enqueueHistoricalVideoJob("photo", {});
    assert.equal(calls[0].values[1], "new_upload"); assert.equal(calls[0].values[2], 100);
    assert.equal(calls[1].values[1], "historical_reconciliation"); assert.equal(calls[1].values[2], 10);
    assert.match(calls[0].sql, /source=CASE WHEN EXCLUDED\.priority >= public\.orange_photo_video_jobs\.priority/);
    assert.match(calls[0].sql, /options_json=CASE WHEN EXCLUDED\.priority >= public\.orange_photo_video_jobs\.priority/);
    assert.match(calls[0].sql, /priority=GREATEST\(public\.orange_photo_video_jobs\.priority,EXCLUDED\.priority\)/);
  } finally { pool.query = original; }
});

test("advisory lock ocupado no procesa", async () => {
  const original = pool.connect;
  let released = false;
  pool.connect = async () => ({ query: async () => ({ rows:[{ acquired:false }] }), release: () => { released = true; } });
  try { assert.deepEqual(await queue.drainVideoJobQueue(), { acquired:false, processed:0, succeeded:0, failed:0 }); assert.equal(released, true); } finally { pool.connect = original; }
});
