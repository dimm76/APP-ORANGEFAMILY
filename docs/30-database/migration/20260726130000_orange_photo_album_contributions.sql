ALTER TABLE public.orange_photo_albums
ADD COLUMN allow_contributions boolean NOT NULL DEFAULT false;

ALTER TABLE public.orange_photo_album_shares
ADD COLUMN can_contribute boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orange_photo_albums.allow_contributions IS
'Permite que cualquier miembro de la familia añada contenido cuando visibility=family.';

COMMENT ON COLUMN public.orange_photo_album_shares.can_contribute IS
'Permite al destinatario concreto añadir contenido al álbum compartido.';
