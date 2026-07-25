BEGIN;

ALTER TABLE public.orange_photo_uploads
    ADD COLUMN IF NOT EXISTS client_upload_key text,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_orange_photo_uploads_owner_client_key
    ON public.orange_photo_uploads(owner_user_id, client_upload_key)
    WHERE client_upload_key IS NOT NULL
      AND status IN ('initiated', 'uploading', 'completing', 'processing');

CREATE INDEX IF NOT EXISTS idx_orange_photo_uploads_active_owner
    ON public.orange_photo_uploads(owner_user_id, created_at DESC)
    WHERE status IN ('initiated', 'uploading', 'completing', 'processing');

DROP TRIGGER IF EXISTS trg_orange_photo_uploads_updated_at
    ON public.orange_photo_uploads;

CREATE TRIGGER trg_orange_photo_uploads_updated_at
BEFORE UPDATE ON public.orange_photo_uploads
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
