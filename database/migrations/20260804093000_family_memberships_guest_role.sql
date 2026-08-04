BEGIN;

DO $migration$
DECLARE
  role_constraint record;
BEGIN
  FOR role_constraint IN
    SELECT constraint_record.conname
    FROM pg_constraint constraint_record
    JOIN pg_class table_record ON table_record.oid = constraint_record.conrelid
    JOIN pg_namespace namespace_record ON namespace_record.oid = table_record.relnamespace
    WHERE namespace_record.nspname = 'public'
      AND table_record.relname = 'family_memberships'
      AND constraint_record.contype = 'c'
      AND pg_get_constraintdef(constraint_record.oid) ~* '\mrole\M'
  LOOP
    EXECUTE format('ALTER TABLE public.family_memberships DROP CONSTRAINT %I', role_constraint.conname);
  END LOOP;
END
$migration$;

ALTER TABLE public.family_memberships
  ADD CONSTRAINT family_memberships_role_check
  CHECK (role IN ('owner', 'member', 'guest'));

COMMENT ON CONSTRAINT family_memberships_role_check
  ON public.family_memberships
  IS 'Roles permitidos para miembros de OrangeFamily.';

COMMIT;
