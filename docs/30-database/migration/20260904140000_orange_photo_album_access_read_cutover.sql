BEGIN;

DO $$
BEGIN
  IF EXISTS (
    WITH expected_family AS (
      SELECT DISTINCT s.album_id, s.user_id, s.shared_by AS created_by_user_id
      FROM public.orange_photo_album_shares s
      JOIN public.orange_photo_albums a ON a.id=s.album_id
      JOIN public.auth_users u ON u.id=s.user_id
      JOIN public.family_memberships membership ON membership.person_id=u.person_id
        AND membership.family_id=a.family_id
        AND membership.status='active'
        AND membership.role IN ('member','guest')
        AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
      WHERE a.visibility='selected'
        AND u.status IN ('active','pending')
        AND s.user_id<>a.owner_user_id
      UNION
      SELECT a.id, u.id, a.owner_user_id
      FROM public.orange_photo_albums a
      JOIN public.family_memberships membership ON membership.family_id=a.family_id
        AND membership.status='active'
        AND membership.role IN ('member','guest')
        AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
      JOIN public.persons person ON person.id=membership.person_id
      JOIN public.auth_users u ON u.person_id=person.id
      WHERE a.visibility='family'
        AND u.status IN ('active','pending')
        AND u.id<>a.owner_user_id
    )
    SELECT 1
    FROM expected_family expected
    JOIN public.orange_photo_album_access existing
      ON existing.album_id=expected.album_id
     AND existing.user_id=expected.user_id
     AND existing.subject_type='external'
  ) THEN
    RAISE EXCEPTION 'R6C found expected family recipients with existing external ACL rows';
  END IF;
END $$;

WITH expected_family AS (
  SELECT DISTINCT s.album_id, s.user_id, s.shared_by AS created_by_user_id
  FROM public.orange_photo_album_shares s
  JOIN public.orange_photo_albums a ON a.id=s.album_id
  JOIN public.auth_users u ON u.id=s.user_id
  JOIN public.family_memberships membership ON membership.person_id=u.person_id
    AND membership.family_id=a.family_id
    AND membership.status='active'
    AND membership.role IN ('member','guest')
    AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
  WHERE a.visibility='selected'
    AND u.status IN ('active','pending')
    AND s.user_id<>a.owner_user_id
  UNION
  SELECT a.id, u.id, a.owner_user_id
  FROM public.orange_photo_albums a
  JOIN public.family_memberships membership ON membership.family_id=a.family_id
    AND membership.status='active'
    AND membership.role IN ('member','guest')
    AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
  JOIN public.persons person ON person.id=membership.person_id
  JOIN public.auth_users u ON u.person_id=person.id
  WHERE a.visibility='family'
    AND u.status IN ('active','pending')
    AND u.id<>a.owner_user_id
)
INSERT INTO public.orange_photo_album_access
  (album_id,user_id,subject_type,status,revoked_at,created_by_user_id,created_at,updated_by_user_id,updated_at)
SELECT album_id,user_id,'family','active',NULL,created_by_user_id,now(),NULL,now()
FROM expected_family
ON CONFLICT (album_id,user_id) DO UPDATE
SET subject_type='family',status='active',revoked_at=NULL,
    created_by_user_id=EXCLUDED.created_by_user_id,updated_at=now()
WHERE public.orange_photo_album_access.subject_type='family';

WITH expected_family AS (
  SELECT DISTINCT s.album_id, s.user_id
  FROM public.orange_photo_album_shares s
  JOIN public.orange_photo_albums a ON a.id=s.album_id
  JOIN public.auth_users u ON u.id=s.user_id
  JOIN public.family_memberships membership ON membership.person_id=u.person_id
    AND membership.family_id=a.family_id AND membership.status='active'
    AND membership.role IN ('member','guest')
    AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
  WHERE a.visibility='selected' AND u.status IN ('active','pending') AND s.user_id<>a.owner_user_id
  UNION
  SELECT a.id,u.id
  FROM public.orange_photo_albums a
  JOIN public.family_memberships membership ON membership.family_id=a.family_id
    AND membership.status='active' AND membership.role IN ('member','guest')
    AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
  JOIN public.persons person ON person.id=membership.person_id
  JOIN public.auth_users u ON u.person_id=person.id
  WHERE a.visibility='family' AND u.status IN ('active','pending') AND u.id<>a.owner_user_id
)
UPDATE public.orange_photo_album_access access
SET status='revoked',revoked_at=now(),updated_at=now()
WHERE access.subject_type='family'
  AND access.status='active'
  AND access.revoked_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM expected_family expected
    WHERE expected.album_id=access.album_id AND expected.user_id=access.user_id
  );

DO $$
BEGIN
  -- final guard: expected_family must equal active family ACL
  IF EXISTS (
    WITH expected_family AS (
      SELECT DISTINCT s.album_id,s.user_id
      FROM public.orange_photo_album_shares s
      JOIN public.orange_photo_albums a ON a.id=s.album_id
      JOIN public.auth_users u ON u.id=s.user_id
      JOIN public.family_memberships membership ON membership.person_id=u.person_id AND membership.family_id=a.family_id AND membership.status='active' AND membership.role IN ('member','guest') AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
      WHERE a.visibility='selected' AND u.status IN ('active','pending') AND s.user_id<>a.owner_user_id
      UNION
      SELECT a.id,u.id
      FROM public.orange_photo_albums a
      JOIN public.family_memberships membership ON membership.family_id=a.family_id AND membership.status='active' AND membership.role IN ('member','guest') AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
      JOIN public.persons person ON person.id=membership.person_id
      JOIN public.auth_users u ON u.person_id=person.id
      WHERE a.visibility='family' AND u.status IN ('active','pending') AND u.id<>a.owner_user_id
    )
    SELECT 1 FROM expected_family expected
    LEFT JOIN public.orange_photo_album_access access ON access.album_id=expected.album_id AND access.user_id=expected.user_id AND access.subject_type='family' AND access.status='active' AND access.revoked_at IS NULL
    WHERE access.album_id IS NULL
  ) OR EXISTS (
    WITH expected_family AS (
      SELECT DISTINCT s.album_id,s.user_id
      FROM public.orange_photo_album_shares s
      JOIN public.orange_photo_albums a ON a.id=s.album_id
      JOIN public.auth_users u ON u.id=s.user_id
      JOIN public.family_memberships membership ON membership.person_id=u.person_id AND membership.family_id=a.family_id AND membership.status='active' AND membership.role IN ('member','guest') AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
      WHERE a.visibility='selected' AND u.status IN ('active','pending') AND s.user_id<>a.owner_user_id
      UNION
      SELECT a.id,u.id
      FROM public.orange_photo_albums a
      JOIN public.family_memberships membership ON membership.family_id=a.family_id AND membership.status='active' AND membership.role IN ('member','guest') AND COALESCE((membership.module_access ->> 'orange_photos')::boolean,false)=true
      JOIN public.persons person ON person.id=membership.person_id
      JOIN public.auth_users u ON u.person_id=person.id
      WHERE a.visibility='family' AND u.status IN ('active','pending') AND u.id<>a.owner_user_id
    )
    SELECT 1 FROM public.orange_photo_album_access access
    LEFT JOIN expected_family expected ON expected.album_id=access.album_id AND expected.user_id=access.user_id
    WHERE access.subject_type='family' AND access.status='active' AND access.revoked_at IS NULL AND expected.album_id IS NULL
  ) THEN
    RAISE EXCEPTION 'R6C family ACL does not match expected family recipients';
  END IF;
END $$;

COMMIT;
