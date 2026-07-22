BEGIN;

CREATE TABLE public.attachments
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL,
    storage_provider text NOT NULL DEFAULT 'wasabi',
    bucket text NOT NULL,
    storage_key text NOT NULL,
    original_filename text,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    width integer,
    height integer,
    checksum text,
    status text NOT NULL DEFAULT 'active',
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    deleted_at timestamp with time zone,

    CONSTRAINT attachments_family_id_fkey
        FOREIGN KEY (family_id)
        REFERENCES public.families (id)
        ON DELETE RESTRICT,

    CONSTRAINT attachments_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id)
        ON DELETE SET NULL,

    CONSTRAINT attachments_storage_unique
        UNIQUE (bucket, storage_key),

    CONSTRAINT attachments_status_check
        CHECK (status IN ('active', 'orphaned', 'deleted')),

    CONSTRAINT attachments_size_bytes_check
        CHECK (size_bytes >= 0)
);

CREATE TABLE public.attachment_links
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    attachment_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    field_key text NOT NULL DEFAULT 'content',
    usage_type text NOT NULL DEFAULT 'embedded_image',
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT attachment_links_attachment_id_fkey
        FOREIGN KEY (attachment_id)
        REFERENCES public.attachments (id)
        ON DELETE CASCADE,

    CONSTRAINT attachment_links_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES public.auth_users (id)
        ON DELETE SET NULL,

    CONSTRAINT attachment_links_unique_usage
        UNIQUE (
            attachment_id,
            entity_type,
            entity_id,
            field_key,
            usage_type
        )
);

CREATE INDEX idx_attachments_family_id
    ON public.attachments (family_id);

CREATE INDEX idx_attachments_status
    ON public.attachments (status);

CREATE INDEX idx_attachments_created_at
    ON public.attachments (created_at DESC);

CREATE INDEX idx_attachment_links_attachment_id
    ON public.attachment_links (attachment_id);

CREATE INDEX idx_attachment_links_entity
    ON public.attachment_links (entity_type, entity_id);

CREATE TRIGGER trg_attachments_updated_at
    BEFORE UPDATE ON public.attachments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

COMMIT;