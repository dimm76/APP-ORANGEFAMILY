BEGIN;

DO $$
DECLARE
  missing_count bigint := 0;
BEGIN
  IF to_regclass('public.orange_photo_album_shares') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT count(*)
      FROM public.orange_photo_album_shares legacy
      LEFT JOIN public.orange_photo_album_access access
        ON access.album_id = legacy.album_id
       AND access.user_id = legacy.user_id
       AND access.subject_type = 'family'
       AND access.status = 'active'
       AND access.revoked_at IS NULL
      WHERE access.id IS NULL
    $sql$
    INTO missing_count;

    IF missing_count > 0 THEN
      RAISE EXCEPTION
        'R6D found legacy album shares without active canonical family ACL';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS public.orange_photo_album_shares;

COMMIT;
