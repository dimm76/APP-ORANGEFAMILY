BEGIN;

CREATE TABLE public.application_releases
(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform text NOT NULL,
    version_code integer NOT NULL,
    version_name text NOT NULL,
    file_name text NOT NULL,
    download_url text NOT NULL,
    release_notes text,
    published_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),

    CONSTRAINT application_releases_platform_unique
        UNIQUE (platform),

    CONSTRAINT application_releases_platform_check
        CHECK (platform IN ('android')),

    CONSTRAINT application_releases_version_code_check
        CHECK (version_code > 0),

    CONSTRAINT application_releases_version_name_check
        CHECK (
            version_name = btrim(version_name)
            AND char_length(version_name) BETWEEN 1 AND 50
        ),

    CONSTRAINT application_releases_file_name_check
        CHECK (
            file_name = btrim(file_name)
            AND char_length(file_name) BETWEEN 5 AND 255
            AND lower(file_name) LIKE '%.apk'
        ),

    CONSTRAINT application_releases_download_url_check
        CHECK (
            download_url = btrim(download_url)
            AND char_length(download_url) BETWEEN 9 AND 2048
            AND download_url ~ '^https://[^[:space:]]+$'
        ),

    CONSTRAINT application_releases_release_notes_check
        CHECK (
            release_notes IS NULL
            OR char_length(release_notes) <= 5000
        ),

    CONSTRAINT application_releases_updated_by_fkey
        FOREIGN KEY (updated_by)
        REFERENCES public.auth_users (id)
        ON DELETE SET NULL
);

CREATE TRIGGER trg_application_releases_updated_at
    BEFORE UPDATE ON public.application_releases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

GRANT USAGE
ON SCHEMA public
TO orangefamily_app_user;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.application_releases
TO orangefamily_app_user;

COMMIT;
