BEGIN;


CREATE TABLE public.orange_photo_library_items (
    photo_id uuid NOT NULL,
    user_id uuid NOT NULL,
    added_at timestamptz NOT NULL DEFAULT now(),


    PRIMARY KEY (photo_id, user_id),


    CONSTRAINT orange_photo_library_items_photo_fkey
        FOREIGN KEY (photo_id)
        REFERENCES public.orange_photos(id)
        ON DELETE CASCADE,


    CONSTRAINT orange_photo_library_items_user_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.auth_users(id)
        ON DELETE CASCADE
);


CREATE INDEX idx_orange_photo_library_items_user
    ON public.orange_photo_library_items(user_id);


INSERT INTO public.orange_photo_library_items (
    photo_id,
    user_id,
    added_at
)
SELECT
    p.id,
    p.owner_user_id,
    p.created_at
FROM public.orange_photos p
ON CONFLICT (photo_id, user_id) DO NOTHING;


DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.orange_photos p
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.orange_photo_library_items li
            WHERE li.photo_id = p.id
              AND li.user_id = p.owner_user_id
        )
    ) THEN
        RAISE EXCEPTION
            'orange_photo_library_items backfill incomplete: one or more original owners are missing';
    END IF;
END
$$;


COMMIT;
