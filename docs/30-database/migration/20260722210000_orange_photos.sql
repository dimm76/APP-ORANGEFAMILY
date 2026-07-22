BEGIN;

CREATE TABLE public.orange_photos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL, owner_user_id uuid NOT NULL,
    media_type text NOT NULL, title text, description text, original_filename text NOT NULL, mime_type text NOT NULL, extension text,
    captured_at timestamptz, captured_at_source text NOT NULL DEFAULT 'unknown', timezone text,
    width integer, height integer, duration_seconds numeric(12,3), orientation integer,
    camera_make text, camera_model text, lens_model text,
    latitude double precision, longitude double precision, altitude_meters double precision,
    location_name text, location_country text, location_region text, location_locality text, location_source text,
    exif_json jsonb NOT NULL DEFAULT '{}'::jsonb, visibility text NOT NULL DEFAULT 'private',
    is_favorite boolean NOT NULL DEFAULT false, is_trashed boolean NOT NULL DEFAULT false, trashed_at timestamptz,
    legacy_wp_attachment_id bigint, legacy_source text, legacy_imported_at timestamptz,
    created_by uuid, updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orange_photos_family_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photos_owner_fkey FOREIGN KEY (owner_user_id) REFERENCES public.auth_users(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT orange_photos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT orange_photos_media_type_check CHECK (media_type IN ('image','video')),
    CONSTRAINT orange_photos_captured_source_check CHECK (captured_at_source IN ('exif','file_mtime','upload_date','manual','unknown')),
    CONSTRAINT orange_photos_location_source_check CHECK (location_source IS NULL OR location_source IN ('exif','manual','geocoded')),
    CONSTRAINT orange_photos_visibility_check CHECK (visibility IN ('private','family','selected')),
    CONSTRAINT orange_photos_width_check CHECK (width IS NULL OR width > 0),
    CONSTRAINT orange_photos_height_check CHECK (height IS NULL OR height > 0),
    CONSTRAINT orange_photos_duration_check CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
    CONSTRAINT orange_photos_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT orange_photos_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    CONSTRAINT orange_photos_trash_check CHECK (is_trashed OR trashed_at IS NULL)
);
CREATE UNIQUE INDEX uq_orange_photos_legacy ON public.orange_photos(legacy_source,legacy_wp_attachment_id) WHERE legacy_wp_attachment_id IS NOT NULL;
CREATE INDEX idx_orange_photos_family ON public.orange_photos(family_id);
CREATE INDEX idx_orange_photos_family_owner ON public.orange_photos(family_id,owner_user_id);
CREATE INDEX idx_orange_photos_family_captured ON public.orange_photos(family_id,captured_at DESC);
CREATE INDEX idx_orange_photos_family_visibility ON public.orange_photos(family_id,visibility);
CREATE INDEX idx_orange_photos_family_trashed ON public.orange_photos(family_id,is_trashed);
CREATE INDEX idx_orange_photos_family_media ON public.orange_photos(family_id,media_type);
CREATE INDEX idx_orange_photos_active ON public.orange_photos(family_id,captured_at DESC NULLS LAST,created_at DESC) WHERE is_trashed=false;

CREATE TABLE public.orange_photo_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL, photo_id uuid NOT NULL, variant text NOT NULL,
    provider text NOT NULL DEFAULT 'wasabi', bucket text NOT NULL, object_key text NOT NULL, mime_type text NOT NULL,
    width integer, height integer, size_bytes bigint, checksum_sha256 text, etag text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orange_photo_files_family_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photo_files_photo_fkey FOREIGN KEY (photo_id) REFERENCES public.orange_photos(id) ON DELETE CASCADE,
    CONSTRAINT orange_photo_files_variant_check CHECK (variant IN ('original','preview','thumbnail','poster')),
    CONSTRAINT orange_photo_files_size_check CHECK (size_bytes IS NULL OR size_bytes >= 0),
    CONSTRAINT orange_photo_files_width_check CHECK (width IS NULL OR width > 0),
    CONSTRAINT orange_photo_files_height_check CHECK (height IS NULL OR height > 0),
    CONSTRAINT orange_photo_files_photo_variant_unique UNIQUE(photo_id,variant),
    CONSTRAINT orange_photo_files_object_unique UNIQUE(provider,bucket,object_key)
);
CREATE INDEX idx_orange_photo_files_family ON public.orange_photo_files(family_id);
CREATE INDEX idx_orange_photo_files_photo ON public.orange_photo_files(photo_id);
CREATE INDEX idx_orange_photo_files_object ON public.orange_photo_files(bucket,object_key);

CREATE TABLE public.orange_photo_albums (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL, owner_user_id uuid NOT NULL, parent_id uuid,
    title text NOT NULL, description text, cover_photo_id uuid, visibility text NOT NULL DEFAULT 'private',
    sort_order integer NOT NULL DEFAULT 0, is_archived boolean NOT NULL DEFAULT false, created_by uuid, updated_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orange_photo_albums_family_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photo_albums_owner_fkey FOREIGN KEY (owner_user_id) REFERENCES public.auth_users(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photo_albums_parent_fkey FOREIGN KEY (parent_id) REFERENCES public.orange_photo_albums(id) ON DELETE SET NULL,
    CONSTRAINT orange_photo_albums_cover_fkey FOREIGN KEY (cover_photo_id) REFERENCES public.orange_photos(id) ON DELETE SET NULL,
    CONSTRAINT orange_photo_albums_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT orange_photo_albums_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT orange_photo_albums_visibility_check CHECK (visibility IN ('private','family','selected')),
    CONSTRAINT orange_photo_albums_title_check CHECK (btrim(title) <> ''),
    CONSTRAINT orange_photo_albums_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX uq_orange_photo_albums_sibling_title ON public.orange_photo_albums(family_id,COALESCE(parent_id,'00000000-0000-0000-0000-000000000000'::uuid),lower(btrim(title)));
CREATE INDEX idx_orange_photo_albums_family ON public.orange_photo_albums(family_id);
CREATE INDEX idx_orange_photo_albums_family_parent ON public.orange_photo_albums(family_id,parent_id);
CREATE INDEX idx_orange_photo_albums_family_owner ON public.orange_photo_albums(family_id,owner_user_id);
CREATE INDEX idx_orange_photo_albums_family_archived ON public.orange_photo_albums(family_id,is_archived);

CREATE TABLE public.orange_photo_album_items (
    album_id uuid NOT NULL, photo_id uuid NOT NULL, sort_order integer NOT NULL DEFAULT 0, added_by uuid, added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY(album_id,photo_id),
    FOREIGN KEY (album_id) REFERENCES public.orange_photo_albums(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES public.orange_photos(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES public.auth_users(id) ON DELETE SET NULL
);
CREATE INDEX idx_orange_photo_album_items_photo ON public.orange_photo_album_items(photo_id);
CREATE INDEX idx_orange_photo_album_items_order ON public.orange_photo_album_items(album_id,sort_order);

CREATE TABLE public.orange_photo_shares (photo_id uuid NOT NULL, user_id uuid NOT NULL, shared_by uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(photo_id,user_id), FOREIGN KEY(photo_id) REFERENCES public.orange_photos(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE, FOREIGN KEY(shared_by) REFERENCES public.auth_users(id) ON DELETE SET NULL);
CREATE TABLE public.orange_photo_album_shares (album_id uuid NOT NULL, user_id uuid NOT NULL, shared_by uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(album_id,user_id), FOREIGN KEY(album_id) REFERENCES public.orange_photo_albums(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE, FOREIGN KEY(shared_by) REFERENCES public.auth_users(id) ON DELETE SET NULL);
CREATE TABLE public.orange_photo_user_settings (photo_id uuid NOT NULL, user_id uuid NOT NULL, is_hidden boolean NOT NULL DEFAULT false, is_favorite boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(photo_id,user_id), FOREIGN KEY(photo_id) REFERENCES public.orange_photos(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES public.auth_users(id) ON DELETE CASCADE);

CREATE TABLE public.orange_photo_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), family_id uuid NOT NULL, name text NOT NULL, slug text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photo_tags_name_check CHECK (btrim(name) <> ''), UNIQUE(family_id,slug)
);
CREATE INDEX idx_orange_photo_tags_family ON public.orange_photo_tags(family_id);
CREATE TABLE public.orange_photo_tag_items (photo_id uuid NOT NULL, tag_id uuid NOT NULL, PRIMARY KEY(photo_id,tag_id), FOREIGN KEY(photo_id) REFERENCES public.orange_photos(id) ON DELETE CASCADE, FOREIGN KEY(tag_id) REFERENCES public.orange_photo_tags(id) ON DELETE CASCADE);
CREATE INDEX idx_orange_photo_tag_items_tag ON public.orange_photo_tag_items(tag_id);

CREATE TRIGGER trg_orange_photos_updated_at BEFORE UPDATE ON public.orange_photos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orange_photo_files_updated_at BEFORE UPDATE ON public.orange_photo_files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orange_photo_albums_updated_at BEFORE UPDATE ON public.orange_photo_albums FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orange_photo_user_settings_updated_at BEFORE UPDATE ON public.orange_photo_user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
