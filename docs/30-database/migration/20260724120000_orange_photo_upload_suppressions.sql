BEGIN;

CREATE TABLE public.orange_photo_upload_suppressions (
    family_id uuid NOT NULL,
    owner_user_id uuid NOT NULL,
    checksum_sha256 text NOT NULL,
    deleted_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orange_photo_upload_suppressions_pkey
        PRIMARY KEY (family_id, owner_user_id, checksum_sha256),
    CONSTRAINT orange_photo_upload_suppressions_family_fkey
        FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photo_upload_suppressions_owner_fkey
        FOREIGN KEY (owner_user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE,
    CONSTRAINT orange_photo_upload_suppressions_checksum_lowercase_check
        CHECK (checksum_sha256 = lower(checksum_sha256)),
    CONSTRAINT orange_photo_upload_suppressions_checksum_format_check
        CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
);

COMMIT;
