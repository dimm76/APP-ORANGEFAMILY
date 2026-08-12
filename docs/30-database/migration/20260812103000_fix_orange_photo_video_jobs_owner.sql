BEGIN;

ALTER TABLE public.orange_photo_video_jobs
  OWNER TO orangefamily_app_user;

ALTER INDEX public.idx_orange_photo_video_jobs_pending_priority
  OWNER TO orangefamily_app_user;

COMMIT;