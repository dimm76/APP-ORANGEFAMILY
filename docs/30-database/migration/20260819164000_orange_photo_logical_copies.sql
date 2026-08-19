BEGIN;

ALTER TABLE public.orange_photo_library_items
    ADD COLUMN title text,
    ADD COLUMN description text,
    ADD COLUMN captured_at timestamptz,
    ADD COLUMN captured_at_source text NOT NULL DEFAULT 'unknown',
    ADD COLUMN timezone text,
    ADD COLUMN latitude double precision,
    ADD COLUMN longitude double precision,
    ADD COLUMN altitude_meters double precision,
    ADD COLUMN location_name text,
    ADD COLUMN location_country text,
    ADD COLUMN location_region text,
    ADD COLUMN location_locality text,
    ADD COLUMN location_source text,
    ADD COLUMN visibility text NOT NULL DEFAULT 'private',
    ADD COLUMN is_trashed boolean NOT NULL DEFAULT false,
    ADD COLUMN trashed_at timestamptz,
    ADD COLUMN public_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN public_token text,
    ADD COLUMN public_created_at timestamptz,
    ADD COLUMN public_revoked_at timestamptz,
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.orange_photo_library_items li
SET title = p.title, description = p.description, captured_at = p.captured_at,
    captured_at_source = p.captured_at_source, timezone = p.timezone,
    latitude = p.latitude, longitude = p.longitude, altitude_meters = p.altitude_meters,
    location_name = p.location_name, location_country = p.location_country,
    location_region = p.location_region, location_locality = p.location_locality,
    location_source = p.location_source,
    visibility = CASE WHEN li.user_id = p.owner_user_id THEN p.visibility ELSE 'private' END,
    is_trashed = CASE WHEN li.user_id = p.owner_user_id THEN p.is_trashed ELSE false END,
    trashed_at = CASE WHEN li.user_id = p.owner_user_id THEN p.trashed_at ELSE NULL END,
    public_enabled = CASE WHEN li.user_id = p.owner_user_id THEN p.public_enabled ELSE false END,
    public_token = CASE WHEN li.user_id = p.owner_user_id THEN p.public_token ELSE NULL END,
    public_created_at = CASE WHEN li.user_id = p.owner_user_id THEN p.public_created_at ELSE NULL END,
    public_revoked_at = CASE WHEN li.user_id = p.owner_user_id THEN p.public_revoked_at ELSE NULL END
FROM public.orange_photos p
WHERE p.id = li.photo_id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.orange_photo_library_items
               WHERE captured_at_source IS NULL OR visibility IS NULL) THEN
        RAISE EXCEPTION 'orange_photo_library_items backfill left required values NULL';
    END IF;
END $$;

ALTER TABLE public.orange_photo_library_items
    ADD CONSTRAINT orange_photo_library_items_captured_source_check
        CHECK (captured_at_source IN ('exif','file_mtime','upload_date','manual','unknown','filename')),
    ADD CONSTRAINT orange_photo_library_items_location_source_check
        CHECK (location_source IS NULL OR location_source IN ('exif','manual','geocoded')),
    ADD CONSTRAINT orange_photo_library_items_visibility_check
        CHECK (visibility IN ('private','family','selected')),
    ADD CONSTRAINT orange_photo_library_items_latitude_check
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    ADD CONSTRAINT orange_photo_library_items_longitude_check
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    ADD CONSTRAINT orange_photo_library_items_trash_check
        CHECK (is_trashed OR trashed_at IS NULL),
    ADD CONSTRAINT orange_photo_library_items_public_link_check
        CHECK (NOT public_enabled OR (public_token IS NOT NULL AND btrim(public_token) <> '' AND public_revoked_at IS NULL));

CREATE UNIQUE INDEX uq_orange_photo_library_items_public_token
    ON public.orange_photo_library_items(public_token)
    WHERE public_token IS NOT NULL;
CREATE INDEX idx_orange_photo_library_items_user_trash
    ON public.orange_photo_library_items(user_id, is_trashed, photo_id);
CREATE TRIGGER trg_orange_photo_library_items_updated_at
    BEFORE UPDATE ON public.orange_photo_library_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.orange_photo_shares ADD COLUMN owner_user_id uuid;
UPDATE public.orange_photo_shares s
SET owner_user_id = p.owner_user_id
FROM public.orange_photos p WHERE p.id = s.photo_id;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.orange_photo_shares WHERE owner_user_id IS NULL) THEN
        RAISE EXCEPTION 'orange_photo_shares backfill left owner_user_id NULL';
    END IF;
END $$;
ALTER TABLE public.orange_photo_shares
    ADD CONSTRAINT orange_photo_shares_owner_fkey
        FOREIGN KEY (owner_user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE,
    ADD CONSTRAINT orange_photo_shares_copy_fkey
        FOREIGN KEY (photo_id, owner_user_id)
        REFERENCES public.orange_photo_library_items(photo_id, user_id) ON DELETE CASCADE;
CREATE INDEX idx_orange_photo_shares_recipient
    ON public.orange_photo_shares(user_id, photo_id, owner_user_id);
-- owner_user_id remains nullable and the legacy primary key
-- remains in place until the runtime ownership cutover.

ALTER TABLE public.orange_photo_album_items ADD COLUMN source_user_id uuid;
UPDATE public.orange_photo_album_items ai
SET source_user_id = COALESCE(
    CASE WHEN ai.added_by IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orange_photo_library_items li
        WHERE li.photo_id = ai.photo_id AND li.user_id = ai.added_by
    ) THEN ai.added_by END,
    p.owner_user_id
)
FROM public.orange_photos p WHERE p.id = ai.photo_id;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.orange_photo_album_items WHERE source_user_id IS NULL) THEN
        RAISE EXCEPTION 'orange_photo_album_items backfill left source_user_id NULL';
    END IF;
END $$;
ALTER TABLE public.orange_photo_album_items
    ADD CONSTRAINT orange_photo_album_items_source_user_fkey
        FOREIGN KEY (source_user_id) REFERENCES public.auth_users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT orange_photo_album_items_copy_fkey
        FOREIGN KEY (photo_id, source_user_id)
        REFERENCES public.orange_photo_library_items(photo_id, user_id) ON DELETE CASCADE;
-- source_user_id remains nullable until the runtime ownership
-- cutover writes it on every album-item insertion.

ALTER TABLE public.orange_photo_events ADD COLUMN copy_owner_user_id uuid;
UPDATE public.orange_photo_events e
SET copy_owner_user_id = p.owner_user_id
FROM public.orange_photos p
WHERE e.photo_id = p.id AND e.photo_id IS NOT NULL;
ALTER TABLE public.orange_photo_events
    ADD CONSTRAINT orange_photo_events_copy_owner_fkey
        FOREIGN KEY (copy_owner_user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL;
CREATE INDEX idx_orange_photo_events_copy_date
    ON public.orange_photo_events(photo_id, copy_owner_user_id, occurred_at DESC);

COMMIT;
