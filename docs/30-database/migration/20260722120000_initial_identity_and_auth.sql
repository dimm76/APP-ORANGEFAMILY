BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE public.families
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT families_status_check
        CHECK (status IN ('active', 'archived'))
);

CREATE TABLE public.persons
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name text NOT NULL,
    last_name text,
    preferred_name text,
    birth_date date,
    status text NOT NULL DEFAULT 'active',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT persons_status_check
        CHECK (status IN ('active', 'inactive', 'deceased'))
);

CREATE TABLE public.family_memberships
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL,
    person_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'member',
    status text NOT NULL DEFAULT 'active',
    joined_at date,
    left_at date,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT family_memberships_family_id_fkey
        FOREIGN KEY (family_id)
        REFERENCES public.families (id)
        ON DELETE CASCADE,
    CONSTRAINT family_memberships_person_id_fkey
        FOREIGN KEY (person_id)
        REFERENCES public.persons (id)
        ON DELETE RESTRICT,
    CONSTRAINT family_memberships_family_person_unique
        UNIQUE (family_id, person_id),
    CONSTRAINT family_memberships_role_check
        CHECK (role IN ('owner', 'adult', 'member', 'dependent')),
    CONSTRAINT family_memberships_status_check
        CHECK (status IN ('active', 'inactive')),
    CONSTRAINT family_memberships_dates_check
        CHECK (left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at)
);

CREATE TABLE public.auth_users
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id uuid UNIQUE,
    email text NOT NULL,
    password_hash text,
    status text NOT NULL DEFAULT 'pending',
    email_verified boolean NOT NULL DEFAULT false,
    failed_login_count integer NOT NULL DEFAULT 0,
    locked_until timestamp with time zone,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT auth_users_person_id_fkey
        FOREIGN KEY (person_id)
        REFERENCES public.persons (id)
        ON DELETE RESTRICT,
    CONSTRAINT auth_users_status_check
        CHECK (status IN ('pending', 'active', 'disabled', 'locked')),
    CONSTRAINT auth_users_failed_login_count_check
        CHECK (failed_login_count >= 0)
);

CREATE UNIQUE INDEX unique_auth_users_email_normalized
    ON public.auth_users (lower(btrim(email)));

CREATE TABLE public.auth_sessions
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE,
    ip_address inet,
    user_agent text,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT auth_sessions_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.auth_users (id)
        ON DELETE CASCADE
);

CREATE TABLE public.auth_password_reset_tokens
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT auth_password_reset_tokens_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.auth_users (id)
        ON DELETE CASCADE
);

CREATE TABLE public.audit_logs
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT audit_logs_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.auth_users (id)
        ON DELETE SET NULL
);

CREATE INDEX idx_auth_users_person_id
    ON public.auth_users (person_id);

CREATE INDEX idx_auth_users_status
    ON public.auth_users (status);

CREATE INDEX idx_auth_sessions_user_id
    ON public.auth_sessions (user_id);

CREATE INDEX idx_auth_sessions_expires_at
    ON public.auth_sessions (expires_at);

CREATE INDEX idx_auth_sessions_revoked_at
    ON public.auth_sessions (revoked_at);

CREATE INDEX idx_auth_password_reset_tokens_user_id
    ON public.auth_password_reset_tokens (user_id);

CREATE INDEX idx_auth_password_reset_tokens_expires_at
    ON public.auth_password_reset_tokens (expires_at);

CREATE INDEX idx_auth_password_reset_tokens_used_at
    ON public.auth_password_reset_tokens (used_at);

CREATE INDEX idx_audit_logs_user_id
    ON public.audit_logs (user_id);

CREATE INDEX idx_audit_logs_action
    ON public.audit_logs (action);

CREATE INDEX idx_audit_logs_created_at
    ON public.audit_logs (created_at);

CREATE INDEX idx_audit_logs_entity
    ON public.audit_logs (entity_type, entity_id);

CREATE INDEX idx_family_memberships_family_id
    ON public.family_memberships (family_id);

CREATE INDEX idx_family_memberships_person_id
    ON public.family_memberships (person_id);

CREATE INDEX idx_family_memberships_role
    ON public.family_memberships (role);

CREATE TRIGGER trg_families_updated_at
    BEFORE UPDATE ON public.families
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_persons_updated_at
    BEFORE UPDATE ON public.persons
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_family_memberships_updated_at
    BEFORE UPDATE ON public.family_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_auth_users_updated_at
    BEFORE UPDATE ON public.auth_users
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_auth_sessions_updated_at
    BEFORE UPDATE ON public.auth_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMIT;
