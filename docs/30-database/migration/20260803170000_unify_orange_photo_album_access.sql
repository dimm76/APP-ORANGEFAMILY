BEGIN;

ALTER TABLE public.orange_photo_albums ADD COLUMN IF NOT EXISTS allow_comments boolean NOT NULL DEFAULT false;

CREATE TABLE public.orange_photo_album_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id uuid NOT NULL REFERENCES public.orange_photo_albums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('family','external')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','revoked')),
  invitation_id uuid REFERENCES public.orange_photo_album_guest_invitations(id) ON DELETE SET NULL,
  created_by_user_id uuid NOT NULL REFERENCES public.auth_users(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orange_photo_album_access_unique UNIQUE (album_id,user_id),
  CONSTRAINT orange_photo_album_access_state_check CHECK (
    (status='pending' AND accepted_at IS NULL AND revoked_at IS NULL)
    OR (status='active' AND accepted_at IS NOT NULL AND revoked_at IS NULL)
    OR (status='revoked' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX idx_orange_photo_album_access_user ON public.orange_photo_album_access(user_id,status,album_id);
CREATE INDEX idx_orange_photo_album_access_album ON public.orange_photo_album_access(album_id,status,subject_type);

UPDATE public.orange_photo_albums SET allow_contributions=false WHERE visibility='private';
UPDATE public.orange_photo_albums album SET allow_contributions=COALESCE((SELECT bool_or(share.can_contribute) FROM public.orange_photo_album_shares share WHERE share.album_id=album.id),false) WHERE album.visibility='selected';

INSERT INTO public.orange_photo_album_access(album_id,user_id,subject_type,status,created_by_user_id,accepted_at,created_at,updated_at)
SELECT share.album_id,share.user_id,'family','active',share.shared_by,now(),now(),now()
FROM public.orange_photo_album_shares share JOIN public.orange_photo_albums album ON album.id=share.album_id AND album.visibility='selected' JOIN public.auth_users auth_user ON auth_user.id=share.user_id JOIN public.family_memberships membership ON membership.person_id=auth_user.person_id AND membership.family_id=album.family_id AND membership.status='active'
WHERE share.user_id<>album.owner_user_id
ON CONFLICT(album_id,user_id) DO UPDATE SET subject_type='family',status='active',invitation_id=NULL,accepted_at=COALESCE(public.orange_photo_album_access.accepted_at,excluded.accepted_at),revoked_at=NULL,updated_at=now();

INSERT INTO public.orange_photo_album_access(album_id,user_id,subject_type,status,created_by_user_id,accepted_at,created_at,updated_at)
SELECT album.id,auth_user.id,'family','active',album.owner_user_id,now(),now(),now()
FROM public.orange_photo_albums album JOIN public.family_memberships membership ON membership.family_id=album.family_id AND membership.status='active' JOIN public.auth_users auth_user ON auth_user.person_id=membership.person_id AND auth_user.status IN ('active','pending')
WHERE album.visibility='family' AND auth_user.id<>album.owner_user_id
ON CONFLICT(album_id,user_id) DO UPDATE SET subject_type='family',status='active',invitation_id=NULL,accepted_at=COALESCE(public.orange_photo_album_access.accepted_at,excluded.accepted_at),revoked_at=NULL,updated_at=now();

INSERT INTO public.orange_photo_album_access(album_id,user_id,subject_type,status,invitation_id,created_by_user_id,accepted_at,revoked_at,created_at,updated_at)
SELECT g.album_id,g.user_id,'external',CASE WHEN g.status='active' THEN 'active' WHEN g.status='revoked' THEN 'revoked' ELSE 'pending' END,g.invitation_id,g.granted_by_user_id,CASE WHEN g.status='active' THEN COALESCE(g.created_at,now()) END,CASE WHEN g.status='revoked' THEN COALESCE(g.revoked_at,now()) END,COALESCE(g.created_at,now()),COALESCE(g.updated_at,g.created_at,now())
FROM public.orange_photo_album_guest_grants g
ON CONFLICT(album_id,user_id) DO UPDATE SET subject_type='external',status=excluded.status,invitation_id=excluded.invitation_id,created_by_user_id=excluded.created_by_user_id,accepted_at=excluded.accepted_at,revoked_at=excluded.revoked_at,updated_at=now();

UPDATE public.orange_photo_album_guest_invitations invitation SET accepted_by_user_id=access.user_id FROM public.orange_photo_album_access access WHERE access.invitation_id=invitation.id AND access.status='active' AND invitation.accepted_by_user_id IS NULL;

DO $$ DECLARE expected_count bigint; migrated_count bigint; BEGIN
  SELECT count(*) INTO expected_count FROM public.orange_photo_album_shares share JOIN public.orange_photo_albums album ON album.id=share.album_id AND album.visibility='selected' JOIN public.auth_users auth_user ON auth_user.id=share.user_id JOIN public.family_memberships membership ON membership.person_id=auth_user.person_id AND membership.family_id=album.family_id AND membership.status='active' WHERE share.user_id<>album.owner_user_id;
  SELECT count(*) INTO migrated_count FROM public.orange_photo_album_access access JOIN public.orange_photo_albums album ON album.id=access.album_id WHERE access.subject_type='family' AND access.status='active' AND album.visibility='selected';
  IF migrated_count < expected_count THEN RAISE EXCEPTION 'ACL familiar incompleta: esperadas %, migradas %',expected_count,migrated_count; END IF;
END $$;
DO $$ DECLARE expected_count bigint; migrated_count bigint; BEGIN
  SELECT count(*) INTO expected_count FROM public.orange_photo_albums album JOIN public.family_memberships membership ON membership.family_id=album.family_id AND membership.status='active' JOIN public.auth_users auth_user ON auth_user.person_id=membership.person_id AND auth_user.status IN ('active','pending') WHERE album.visibility='family' AND auth_user.id<>album.owner_user_id;
  SELECT count(*) INTO migrated_count FROM public.orange_photo_album_access access JOIN public.orange_photo_albums album ON album.id=access.album_id WHERE album.visibility='family' AND access.subject_type='family' AND access.status='active';
  IF migrated_count < expected_count THEN RAISE EXCEPTION 'ACL de familia completa incompleta: esperadas %, migradas %',expected_count,migrated_count; END IF;
END $$;
DO $$ DECLARE expected_count bigint; migrated_count bigint; BEGIN
  SELECT count(*) INTO expected_count FROM public.orange_photo_album_guest_grants;
  SELECT count(*) INTO migrated_count FROM public.orange_photo_album_access WHERE subject_type='external';
  IF migrated_count < expected_count THEN RAISE EXCEPTION 'ACL externa incompleta: esperadas %, migradas %',expected_count,migrated_count; END IF;
END $$;

REVOKE ALL ON public.orange_photo_album_access FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orange_photo_album_access TO orangefamily_app_user;

COMMIT;
