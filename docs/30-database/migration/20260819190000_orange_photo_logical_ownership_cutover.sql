BEGIN;

UPDATE public.orange_photo_library_items li
SET title=p.title, description=p.description, captured_at=p.captured_at,
    captured_at_source=p.captured_at_source, timezone=p.timezone,
    latitude=p.latitude, longitude=p.longitude, altitude_meters=p.altitude_meters,
    location_name=p.location_name, location_country=p.location_country,
    location_region=p.location_region, location_locality=p.location_locality,
    location_source=p.location_source, visibility=p.visibility,
    is_trashed=p.is_trashed, trashed_at=p.trashed_at,
    public_enabled=p.public_enabled, public_token=p.public_token,
    public_created_at=p.public_created_at, public_revoked_at=p.public_revoked_at
FROM public.orange_photos p
WHERE li.photo_id=p.id AND li.user_id=p.owner_user_id;

UPDATE public.orange_photo_library_items li
SET title=p.title, description=p.description, captured_at=p.captured_at,
    captured_at_source=p.captured_at_source, timezone=p.timezone,
    latitude=p.latitude, longitude=p.longitude, altitude_meters=p.altitude_meters,
    location_name=p.location_name, location_country=p.location_country,
    location_region=p.location_region, location_locality=p.location_locality,
    location_source=p.location_source, visibility='private', is_trashed=false,
    trashed_at=NULL, public_enabled=false, public_token=NULL,
    public_created_at=NULL, public_revoked_at=NULL
FROM public.orange_photos p
WHERE li.photo_id=p.id AND li.user_id<>p.owner_user_id AND li.updated_at=li.added_at;

UPDATE public.orange_photo_shares s
SET owner_user_id=p.owner_user_id
FROM public.orange_photos p
WHERE s.owner_user_id IS NULL AND s.photo_id=p.id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.orange_photo_shares WHERE owner_user_id IS NULL) THEN
        RAISE EXCEPTION 'orange_photo_shares owner_user_id backfill incomplete';
    END IF;
END $$;

ALTER TABLE public.orange_photo_shares
    ALTER COLUMN owner_user_id SET NOT NULL,
    DROP CONSTRAINT orange_photo_shares_pkey,
    ADD CONSTRAINT orange_photo_shares_pkey PRIMARY KEY(photo_id,owner_user_id,user_id);

UPDATE public.orange_photo_album_items ai
SET source_user_id=COALESCE(
    CASE WHEN ai.added_by IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orange_photo_library_items li
        WHERE li.photo_id=ai.photo_id AND li.user_id=ai.added_by
    ) THEN ai.added_by END,
    p.owner_user_id
)
FROM public.orange_photos p
WHERE ai.source_user_id IS NULL AND ai.photo_id=p.id;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.orange_photo_album_items WHERE source_user_id IS NULL) THEN
        RAISE EXCEPTION 'orange_photo_album_items source_user_id backfill incomplete';
    END IF;
END $$;

ALTER TABLE public.orange_photo_album_items
    ALTER COLUMN source_user_id SET NOT NULL;

UPDATE public.orange_photo_events e
SET copy_owner_user_id=p.owner_user_id
FROM public.orange_photos p
WHERE e.photo_id IS NOT NULL AND e.copy_owner_user_id IS NULL AND e.photo_id=p.id;

COMMIT;
