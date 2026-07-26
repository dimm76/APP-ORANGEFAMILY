BEGIN;

CREATE TABLE public.orange_photo_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id uuid NOT NULL,
    photo_id uuid,
    actor_user_id uuid,
    event_type text NOT NULL,
    client_type text NOT NULL DEFAULT 'web',
    installation_id text,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT orange_photo_events_family_fkey FOREIGN KEY (family_id) REFERENCES public.families(id) ON DELETE RESTRICT,
    CONSTRAINT orange_photo_events_photo_fkey FOREIGN KEY (photo_id) REFERENCES public.orange_photos(id) ON DELETE SET NULL,
    CONSTRAINT orange_photo_events_actor_fkey FOREIGN KEY (actor_user_id) REFERENCES public.auth_users(id) ON DELETE SET NULL,
    CONSTRAINT orange_photo_events_type_check CHECK (event_type IN ('uploaded','duplicate_resolved','upload_suppressed','restore_available_detected','downloaded','bulk_downloaded','shared','unshared','moved_to_trash','restored','purged','metadata_updated','added_to_album','removed_from_album')),
    CONSTRAINT orange_photo_events_client_check CHECK (client_type IN ('web','android_sync','desktop','public','system','legacy')),
    CONSTRAINT orange_photo_events_installation_check CHECK (installation_id IS NULL OR length(installation_id) BETWEEN 1 AND 200),
    CONSTRAINT orange_photo_events_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX idx_orange_photo_events_photo_date ON public.orange_photo_events(photo_id, occurred_at DESC) WHERE photo_id IS NOT NULL;
CREATE INDEX idx_orange_photo_events_family_date ON public.orange_photo_events(family_id, occurred_at DESC);
CREATE INDEX idx_orange_photo_events_actor_date ON public.orange_photo_events(actor_user_id, occurred_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_orange_photo_events_type_date ON public.orange_photo_events(event_type, occurred_at DESC);

COMMIT;
