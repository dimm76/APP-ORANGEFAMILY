BEGIN;

ALTER TABLE public.family_memberships
  ADD COLUMN module_access jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.family_memberships
  ADD CONSTRAINT family_memberships_module_access_object_chk
  CHECK (jsonb_typeof(module_access) = 'object');

UPDATE public.family_memberships
SET module_access = CASE
  WHEN role = 'owner' THEN
    '{
      "orange_photos": true,
      "wiki": true,
      "notes": true,
      "documents": true,
      "finances": true
    }'::jsonb
  ELSE
    '{
      "orange_photos": true,
      "wiki": false,
      "notes": false,
      "documents": false,
      "finances": false
    }'::jsonb
END;

COMMIT;
