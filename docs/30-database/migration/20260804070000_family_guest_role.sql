BEGIN;

ALTER TABLE public.family_memberships
  DROP CONSTRAINT IF EXISTS family_memberships_role_check;

ALTER TABLE public.family_memberships
  ADD CONSTRAINT family_memberships_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'owner'::text,
        'adult'::text,
        'member'::text,
        'dependent'::text,
        'guest'::text
      ]
    )
  );

COMMENT ON CONSTRAINT
  family_memberships_role_check
  ON public.family_memberships
  IS 'Roles permitidos para miembros de OrangeFamily.';

COMMIT;
