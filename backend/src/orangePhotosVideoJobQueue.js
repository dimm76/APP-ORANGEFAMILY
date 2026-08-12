/* global require, module, console, setImmediate, setInterval, clearInterval */
const pool = require("../db");
const { processStoredOrangePhotoVideo } = require("./orangePhotosVideoProcessor");

const VIDEO_JOB_PRIORITY = Object.freeze({ HISTORICAL_RECONCILIATION: 10, NEW_UPLOAD: 100 });
const VIDEO_JOB_ADVISORY_LOCK_ID = "7349012026";

async function enqueueVideoJob(photoId, { source, priority, options }) {
  const result = await pool.query(`INSERT INTO public.orange_photo_video_jobs (photo_id,family_id,source,priority,status,options_json,attempts,last_error,created_at,updated_at,started_at,finished_at) SELECT p.id,p.family_id,$2,$3,'pending',$4::jsonb,0,NULL,now(),now(),NULL,NULL FROM public.orange_photos p WHERE p.id=$1::uuid AND p.media_type='video' ON CONFLICT (photo_id) DO UPDATE SET source=EXCLUDED.source,priority=GREATEST(public.orange_photo_video_jobs.priority,EXCLUDED.priority),status=CASE WHEN public.orange_photo_video_jobs.status='processing' THEN 'processing' ELSE 'pending' END,options_json=EXCLUDED.options_json,last_error=NULL,updated_at=now(),started_at=CASE WHEN public.orange_photo_video_jobs.status='processing' THEN public.orange_photo_video_jobs.started_at ELSE NULL END,finished_at=NULL RETURNING photo_id,source,priority,status`, [photoId, source, priority, JSON.stringify(options || {})]);
  if (!result.rowCount) throw new Error("No se pudo encolar el vídeo: fotografía inexistente o no es un vídeo.");
  return result.rows[0];
}
function enqueueNewUploadVideoJob(photoId, options) { return enqueueVideoJob(photoId, { source:"new_upload", priority:VIDEO_JOB_PRIORITY.NEW_UPLOAD, options }); }
function enqueueHistoricalVideoJob(photoId, options) { return enqueueVideoJob(photoId, { source:"historical_reconciliation", priority:VIDEO_JOB_PRIORITY.HISTORICAL_RECONCILIATION, options }); }

async function claimNextJob(client) {
  await client.query("BEGIN");
  try {
    const selected = await client.query("SELECT photo_id,family_id,source,priority,options_json,attempts FROM public.orange_photo_video_jobs WHERE status='pending' ORDER BY priority DESC,created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1");
    if (!selected.rowCount) { await client.query("COMMIT"); return null; }
    const job = selected.rows[0];
    await client.query("UPDATE public.orange_photo_video_jobs SET status='processing',attempts=attempts+1,started_at=now(),finished_at=NULL,last_error=NULL,updated_at=now() WHERE photo_id=$1::uuid", [job.photo_id]);
    await client.query("COMMIT");
    return job;
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
}

async function drainVideoJobQueue() {
  const client = await pool.connect();
  let locked = false;
  const result = { acquired:false, processed:0, succeeded:0, failed:0 };
  try {
    const lock = await client.query("SELECT pg_try_advisory_lock($1::bigint) AS acquired", [VIDEO_JOB_ADVISORY_LOCK_ID]);
    if (lock.rows[0]?.acquired !== true) return result;
    locked = true; result.acquired = true;
    await client.query("UPDATE public.orange_photo_video_jobs SET status='pending',started_at=NULL,updated_at=now() WHERE status='processing'");
    while (true) {
      const job = await claimNextJob(client);
      if (!job) break;
      result.processed += 1;
      try {
        await processStoredOrangePhotoVideo(job.photo_id, job.options_json || {});
        await client.query("UPDATE public.orange_photo_video_jobs SET status='completed',finished_at=now(),last_error=NULL,updated_at=now() WHERE photo_id=$1::uuid", [job.photo_id]);
        result.succeeded += 1;
      } catch (error) {
        const message = String(error?.message || error).slice(0, 5000);
        await client.query("UPDATE public.orange_photo_video_jobs SET status='failed',finished_at=now(),last_error=$2,updated_at=now() WHERE photo_id=$1::uuid", [job.photo_id, message]);
        result.failed += 1;
        console.error("OrangePhotos video job queue", { photo_id:job.photo_id, message });
      }
    }
    return result;
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1::bigint)", [VIDEO_JOB_ADVISORY_LOCK_ID]).catch(() => {});
    client.release();
  }
}

function startVideoJobQueueWorker({ pollIntervalMs = 5000 } = {}) {
  let running = false;
  const run = async () => { if (running) return; running = true; try { await drainVideoJobQueue(); } catch (error) { console.error("OrangePhotos video job queue", { message:error.message }); } finally { running = false; } };
  setImmediate(run);
  const timer = setInterval(run, pollIntervalMs); timer.unref?.();
  return () => clearInterval(timer);
}

module.exports = { VIDEO_JOB_PRIORITY, enqueueNewUploadVideoJob, enqueueHistoricalVideoJob, drainVideoJobQueue, startVideoJobQueueWorker };
