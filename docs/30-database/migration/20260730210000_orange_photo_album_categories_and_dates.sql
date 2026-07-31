BEGIN;

ALTER TABLE public.orange_photo_albums
  ADD COLUMN IF NOT EXISTS date_mode text,
  ADD COLUMN IF NOT EXISTS date_start date,
  ADD COLUMN IF NOT EXISTS date_end date;

ALTER TABLE public.orange_photo_albums
  DROP CONSTRAINT IF EXISTS orange_photo_albums_date_mode_check;

ALTER TABLE public.orange_photo_albums
  ADD CONSTRAINT orange_photo_albums_date_mode_check
  CHECK (date_mode IS NULL OR date_mode IN ('single', 'range'));

ALTER TABLE public.orange_photo_albums
  DROP CONSTRAINT IF EXISTS orange_photo_albums_dates_check;

ALTER TABLE public.orange_photo_albums
  ADD CONSTRAINT orange_photo_albums_dates_check
  CHECK (
    (date_mode IS NULL AND date_start IS NULL AND date_end IS NULL)
    OR (date_mode = 'single' AND date_start IS NOT NULL AND date_end = date_start)
    OR (
      date_mode = 'range'
      AND date_start IS NOT NULL
      AND date_end IS NOT NULL
      AND date_end >= date_start
    )
  );

CREATE TABLE IF NOT EXISTS public.orange_photo_album_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  normalized_name varchar(120) NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orange_photo_album_categories_name_not_blank CHECK (btrim(name) <> ''),
  CONSTRAINT orange_photo_album_categories_normalized_name_not_blank CHECK (btrim(normalized_name) <> ''),
  CONSTRAINT orange_photo_album_categories_owner_name_unique UNIQUE (owner_user_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS orange_photo_album_categories_family_owner_order_idx
ON public.orange_photo_album_categories (family_id, owner_user_id, sort_order, normalized_name);

CREATE TABLE IF NOT EXISTS public.orange_photo_album_category_items (
  category_id uuid NOT NULL REFERENCES public.orange_photo_album_categories(id) ON DELETE CASCADE,
  album_id uuid NOT NULL REFERENCES public.orange_photo_albums(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, album_id)
);

CREATE INDEX IF NOT EXISTS orange_photo_album_category_items_album_idx
ON public.orange_photo_album_category_items(album_id);

COMMIT;
