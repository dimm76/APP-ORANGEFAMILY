BEGIN;

CREATE TABLE public.orange_photo_video_jobs (
  photo_id uuid PRIMARY KEY REFERENCES public.orange_photos(id) ON DELETE CASCADE,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  source text NOT NULL,
  priority smallint NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  options_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  CONSTRAINT orange_photo_video_jobs_source_check CHECK (source = ANY (ARRAY['new_upload'::text,'historical_reconciliation'::text])),
  CONSTRAINT orange_photo_video_jobs_status_check CHECK (status = ANY (ARRAY['pending'::text,'processing'::text,'completed'::text,'failed'::text])),
  CONSTRAINT orange_photo_video_jobs_priority_check CHECK (priority > 0),
  CONSTRAINT orange_photo_video_jobs_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX idx_orange_photo_video_jobs_pending_priority ON public.orange_photo_video_jobs (priority DESC,created_at ASC) WHERE status = 'pending';

COMMIT;
