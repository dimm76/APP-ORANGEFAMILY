BEGIN;

CREATE TABLE public.auth_activation_tokens
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT auth_activation_tokens_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.auth_users (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_auth_activation_tokens_user_id
    ON public.auth_activation_tokens (user_id);

CREATE INDEX idx_auth_activation_tokens_expires_at
    ON public.auth_activation_tokens (expires_at);

CREATE INDEX idx_auth_activation_tokens_used_at
    ON public.auth_activation_tokens (used_at);

COMMIT;
