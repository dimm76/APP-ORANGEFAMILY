BEGIN;

ALTER TABLE public.orange_photo_files
  DROP CONSTRAINT orange_photo_files_variant_check;

ALTER TABLE public.orange_photo_files
  ADD CONSTRAINT orange_photo_files_variant_check
  CHECK (
    variant = ANY (
      ARRAY[
        'original'::text,
        'preview'::text,
        'thumbnail'::text,
        'poster'::text,
        'playback'::text
      ]
    )
  );

COMMIT;
