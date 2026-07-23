BEGIN;

CREATE INDEX idx_orange_photo_files_original_checksum
ON public.orange_photo_files(family_id, checksum_sha256)
WHERE variant = 'original'
  AND checksum_sha256 IS NOT NULL;

CREATE INDEX idx_orange_photos_possible_duplicate
ON public.orange_photos(family_id, lower(original_filename));

CREATE TABLE public.orange_photo_uploads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    provider text NOT NULL DEFAULT 'wasabi',
    bucket text NOT NULL,
    object_key text NOT NULL,
    provider_upload_id text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    extension text,
    media_type text NOT NULL,
    size_bytes bigint NOT NULL,
    metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'initiated',
    uploaded_parts jsonb NOT NULL DEFAULT '[]'::jsonb,
    error_code text,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz,
    expires_at timestamptz NOT NULL,
    CONSTRAINT orange_photo_uploads_family_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE CASCADE,
    CONSTRAINT orange_photo_uploads_owner_fkey FOREIGN KEY (owner_user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE,
    CONSTRAINT orange_photo_uploads_media_type_check CHECK (media_type IN ('image', 'video')),
    CONSTRAINT orange_photo_uploads_status_check CHECK (status IN ('initiated','uploading','completing','processing','completed','aborted','failed')),
    CONSTRAINT orange_photo_uploads_size_check CHECK (size_bytes > 0),
    CONSTRAINT orange_photo_uploads_object_unique UNIQUE (provider, bucket, object_key),
    CONSTRAINT orange_photo_uploads_provider_id_unique UNIQUE (provider, bucket, provider_upload_id)
);

CREATE INDEX idx_orange_photo_uploads_owner_status
ON public.orange_photo_uploads(family_id, owner_user_id, status);

CREATE INDEX idx_orange_photo_uploads_expires
ON public.orange_photo_uploads(expires_at)
WHERE status IN ('initiated', 'uploading', 'failed');

CREATE TRIGGER trg_orange_photo_uploads_updated_at
BEFORE UPDATE ON public.orange_photo_uploads
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
