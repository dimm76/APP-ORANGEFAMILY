BEGIN;

ALTER TABLE public.orange_photo_library_items
    DROP CONSTRAINT orange_photo_library_items_captured_source_check;

ALTER TABLE public.orange_photo_library_items
    ADD CONSTRAINT orange_photo_library_items_captured_source_check
    CHECK (
        captured_at_source IN (
            'exif',
            'file_mtime',
            'upload_date',
            'manual',
            'unknown',
            'filename',
            'date_taken'
        )
    );

COMMIT;
