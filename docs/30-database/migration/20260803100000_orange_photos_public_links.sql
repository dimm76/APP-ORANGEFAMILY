BEGIN;

ALTER TABLE public.orange_photos
  ADD COLUMN public_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN public_token text,
  ADD COLUMN public_created_at timestamptz,
  ADD COLUMN public_revoked_at timestamptz,
  ADD CONSTRAINT orange_photos_public_link_check CHECK (public_enabled = false OR (public_token IS NOT NULL AND btrim(public_token) <> '' AND public_revoked_at IS NULL));

ALTER TABLE public.orange_photo_albums
  ADD COLUMN public_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN public_token text,
  ADD COLUMN public_created_at timestamptz,
  ADD COLUMN public_revoked_at timestamptz,
  ADD CONSTRAINT orange_photo_albums_public_link_check CHECK (public_enabled = false OR (public_token IS NOT NULL AND btrim(public_token) <> '' AND public_revoked_at IS NULL));

CREATE UNIQUE INDEX uq_orange_photos_public_token ON public.orange_photos(public_token) WHERE public_token IS NOT NULL;
CREATE UNIQUE INDEX uq_orange_photo_albums_public_token ON public.orange_photo_albums(public_token) WHERE public_token IS NOT NULL;

COMMIT;
