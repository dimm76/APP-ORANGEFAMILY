BEGIN;

INSERT INTO public.orange_photo_user_settings (
  photo_id,
  user_id,
  is_favorite
)
SELECT
  p.id,
  p.owner_user_id,
  true
FROM public.orange_photos p
WHERE p.is_favorite = true
AND NOT EXISTS (
  SELECT 1
  FROM public.orange_photo_user_settings us
  WHERE us.photo_id = p.id
  AND us.user_id = p.owner_user_id
)
ON CONFLICT (photo_id, user_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.orange_photos p
    WHERE p.is_favorite = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.orange_photo_user_settings us
      WHERE us.photo_id = p.id
      AND us.user_id = p.owner_user_id
    )
  ) THEN
    RAISE EXCEPTION 'orange_photo_user_settings favorite backfill incomplete';
  END IF;
END $$;

COMMIT;
