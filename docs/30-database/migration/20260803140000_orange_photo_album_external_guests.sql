BEGIN;

CREATE TABLE public.orange_photo_album_guest_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), album_id uuid NOT NULL REFERENCES public.orange_photo_albums(id) ON DELETE CASCADE,
  invited_email text NOT NULL, invited_by_user_id uuid NOT NULL REFERENCES public.auth_users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE, can_view boolean NOT NULL DEFAULT true, can_contribute boolean NOT NULL DEFAULT false,
  can_comment boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked','expired')),
  expires_at timestamptz NOT NULL, accepted_at timestamptz, accepted_by_user_id uuid REFERENCES public.auth_users(id) ON DELETE SET NULL,
  revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (can_view OR (NOT can_contribute AND NOT can_comment))
);
CREATE UNIQUE INDEX uq_orange_photo_guest_invitation_pending_email ON public.orange_photo_album_guest_invitations(album_id, lower(invited_email)) WHERE status='pending' AND revoked_at IS NULL;
CREATE TABLE public.orange_photo_album_guest_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), album_id uuid NOT NULL REFERENCES public.orange_photo_albums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE, invitation_id uuid REFERENCES public.orange_photo_album_guest_invitations(id) ON DELETE SET NULL,
  can_view boolean NOT NULL DEFAULT true, can_contribute boolean NOT NULL DEFAULT false, can_comment boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')), granted_by_user_id uuid NOT NULL REFERENCES public.auth_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
  UNIQUE(album_id,user_id), CHECK (can_view OR (NOT can_contribute AND NOT can_comment))
);
CREATE INDEX idx_orange_photo_guest_grants_user_status ON public.orange_photo_album_guest_grants(user_id,status);
CREATE INDEX idx_orange_photo_guest_grants_album_status ON public.orange_photo_album_guest_grants(album_id,status);
CREATE TRIGGER trg_orange_photo_guest_invitations_updated_at BEFORE UPDATE ON public.orange_photo_album_guest_invitations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orange_photo_guest_grants_updated_at BEFORE UPDATE ON public.orange_photo_album_guest_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

REVOKE ALL ON public.orange_photo_album_guest_invitations FROM PUBLIC;
REVOKE ALL ON public.orange_photo_album_guest_grants FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.orange_photo_album_guest_invitations TO orangefamily_app_user;
GRANT SELECT, INSERT, UPDATE ON public.orange_photo_album_guest_grants TO orangefamily_app_user;

COMMIT;
