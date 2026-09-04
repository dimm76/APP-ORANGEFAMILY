BEGIN;

DO $$
DECLARE
    missing_columns text[];
BEGIN
    SELECT array_agg(expected.name ORDER BY expected.name)
    INTO missing_columns
    FROM (
        VALUES
            ('title'),
            ('description'),
            ('captured_at'),
            ('captured_at_source'),
            ('timezone'),
            ('latitude'),
            ('longitude'),
            ('altitude_meters'),
            ('location_name'),
            ('location_country'),
            ('location_region'),
            ('location_locality'),
            ('location_source'),
            ('visibility'),
            ('is_favorite'),
            ('is_trashed'),
            ('trashed_at'),
            ('public_enabled'),
            ('public_token'),
            ('public_created_at'),
            ('public_revoked_at')
    ) AS expected(name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'orange_photos'
          AND c.column_name = expected.name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION
            'R5F expected legacy orange_photos columns are missing: %',
            array_to_string(missing_columns, ', ');
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.orange_photos p
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.orange_photo_library_items li
            WHERE li.photo_id = p.id
        )
    ) THEN
        RAISE EXCEPTION
            'R5F found physical assets without any logical library copy';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.orange_photo_album_items ai
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.orange_photo_library_items li
            WHERE li.photo_id = ai.photo_id
              AND li.user_id = ai.source_user_id
        )
    ) THEN
        RAISE EXCEPTION
            'R5F found album items without their source logical copy';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.orange_photos p
        LEFT JOIN public.orange_photo_user_settings us
          ON us.photo_id = p.id
         AND us.user_id = p.owner_user_id
        WHERE p.is_favorite = true
          AND COALESCE(us.is_favorite, false) = false
    ) THEN
        RAISE EXCEPTION
            'R5F found legacy favorite=true without canonical user setting';
    END IF;
END $$;

DROP INDEX public.idx_orange_photos_active;
DROP INDEX public.idx_orange_photos_family_captured;
DROP INDEX public.idx_orange_photos_family_trashed;
DROP INDEX public.idx_orange_photos_family_visibility;
DROP INDEX public.uq_orange_photos_public_token;

ALTER TABLE public.orange_photos
    DROP CONSTRAINT orange_photos_captured_source_check,
    DROP CONSTRAINT orange_photos_latitude_check,
    DROP CONSTRAINT orange_photos_location_source_check,
    DROP CONSTRAINT orange_photos_longitude_check,
    DROP CONSTRAINT orange_photos_public_link_check,
    DROP CONSTRAINT orange_photos_trash_check,
    DROP CONSTRAINT orange_photos_visibility_check;

ALTER TABLE public.orange_photos
    DROP COLUMN title,
    DROP COLUMN description,
    DROP COLUMN captured_at,
    DROP COLUMN captured_at_source,
    DROP COLUMN timezone,
    DROP COLUMN latitude,
    DROP COLUMN longitude,
    DROP COLUMN altitude_meters,
    DROP COLUMN location_name,
    DROP COLUMN location_country,
    DROP COLUMN location_region,
    DROP COLUMN location_locality,
    DROP COLUMN location_source,
    DROP COLUMN visibility,
    DROP COLUMN is_favorite,
    DROP COLUMN is_trashed,
    DROP COLUMN trashed_at,
    DROP COLUMN public_enabled,
    DROP COLUMN public_token,
    DROP COLUMN public_created_at,
    DROP COLUMN public_revoked_at;

COMMIT;
