BEGIN;

CREATE TABLE public.wiki_pages
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL,
    parent_id uuid,
    title text NOT NULL,
    slug text,
    content_json jsonb,
    content_html text,
    search_text text,
    excerpt text,
    status text NOT NULL DEFAULT 'draft',
    visibility text NOT NULL DEFAULT 'internal',
    document_type text NOT NULL DEFAULT 'document',
    menu_order integer NOT NULL DEFAULT 0,
    is_archived boolean NOT NULL DEFAULT false,
    public_enabled boolean NOT NULL DEFAULT false,
    public_token text,
    public_published_at timestamptz,
    public_expires_at timestamptz,
    public_revoked_at timestamptz,
    created_by uuid,
    updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz,
    CONSTRAINT wiki_pages_family_id_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT wiki_pages_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
    CONSTRAINT wiki_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT wiki_pages_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT wiki_pages_status_check CHECK (status IN ('draft','publish','archived')),
    CONSTRAINT wiki_pages_visibility_check CHECK (visibility IN ('internal','public_link')),
    CONSTRAINT wiki_pages_document_type_check CHECK (document_type IN ('document','note','procedure','guide','report','memory')),
    CONSTRAINT wiki_pages_family_slug_unique UNIQUE (family_id, slug),
    CONSTRAINT wiki_pages_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_wiki_pages_family_id ON public.wiki_pages(family_id);
CREATE INDEX idx_wiki_pages_family_parent ON public.wiki_pages(family_id,parent_id);
CREATE INDEX idx_wiki_pages_family_status ON public.wiki_pages(family_id,status);
CREATE INDEX idx_wiki_pages_family_archived ON public.wiki_pages(family_id,is_archived);
CREATE INDEX idx_wiki_pages_family_updated ON public.wiki_pages(family_id,updated_at DESC);
CREATE INDEX idx_wiki_pages_public_token ON public.wiki_pages(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX idx_wiki_pages_search_text ON public.wiki_pages USING gin(to_tsvector('simple',COALESCE(search_text,'')));

CREATE TRIGGER trg_wiki_pages_updated_at BEFORE UPDATE ON public.wiki_pages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
