BEGIN;

DO $$
DECLARE constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT con.conname FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public' AND rel.relname = 'family_memberships' AND con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%role%'
  LOOP EXECUTE format('ALTER TABLE public.family_memberships DROP CONSTRAINT %I', constraint_record.conname); END LOOP;
END $$;

ALTER TABLE public.family_memberships ADD CONSTRAINT family_memberships_role_check CHECK (role IN ('owner', 'member', 'guest'));

WITH external_people AS (
  SELECT DISTINCT a.family_id, u.person_id FROM public.orange_photo_album_guest_grants g JOIN public.orange_photo_albums a ON a.id = g.album_id JOIN public.auth_users u ON u.id = g.user_id WHERE g.status = 'active' AND g.revoked_at IS NULL AND u.person_id IS NOT NULL
)
INSERT INTO public.family_memberships (family_id, person_id, role, status, module_access)
SELECT ep.family_id, ep.person_id, 'guest', 'active', jsonb_build_object('orange_photos', true, 'wiki', false, 'notes', false, 'documents', false, 'finances', false)
FROM external_people ep WHERE NOT EXISTS (SELECT 1 FROM public.family_memberships fm WHERE fm.family_id = ep.family_id AND fm.person_id = ep.person_id);

UPDATE public.family_memberships SET module_access = jsonb_build_object('orange_photos', true, 'wiki', false, 'notes', false, 'documents', false, 'finances', false) WHERE role = 'guest';
COMMIT;
