BEGIN;

ALTER TABLE public.orange_photos
  DROP CONSTRAINT orange_photos_captured_source_check;

ALTER TABLE public.orange_photos
  ADD CONSTRAINT orange_photos_captured_source_check
  CHECK (
    captured_at_source IN (
      'exif',
      'file_mtime',
      'upload_date',
      'manual',
      'unknown',
      'filename'
    )
  );

COMMIT;
