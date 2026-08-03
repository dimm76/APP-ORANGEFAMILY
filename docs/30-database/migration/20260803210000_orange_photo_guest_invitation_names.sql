BEGIN;

ALTER TABLE public.orange_photo_album_guest_invitations
  ADD COLUMN invited_first_name text,
  ADD COLUMN invited_last_name text;

ALTER TABLE public.orange_photo_album_guest_invitations
  ADD CONSTRAINT orange_photo_guest_invited_first_name_length
    CHECK (invited_first_name IS NULL OR char_length(btrim(invited_first_name)) BETWEEN 1 AND 100),
  ADD CONSTRAINT orange_photo_guest_invited_last_name_length
    CHECK (invited_last_name IS NULL OR char_length(btrim(invited_last_name)) BETWEEN 1 AND 150);

COMMIT;
