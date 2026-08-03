# OrangePhotos

OrangePhotos es la biblioteca privada de fotografías y vídeos de OrangeFamily. Cada elemento pertenece a una familia y a un usuario propietario; admite álbumes, etiquetas, papelera reversible y visibilidad `private`, `family` o `selected`.

## Entidades

- `orange_photos`: metadatos, propietario, privacidad, EXIF saneado, localización y estado.
- `orange_photo_files`: original y variantes físicas (`preview`, `thumbnail`, `poster`).
- `orange_photo_albums` y `orange_photo_album_items`: álbumes jerárquicos y relación N:M.
- `orange_photo_shares` y `orange_photo_album_shares`: destinatarios concretos.
- `orange_photo_user_settings`: ocultación y favorito particulares.
- `orange_photo_tags` y `orange_photo_tag_items`: etiquetas familiares.

## Permisos

Node resuelve la familia autenticada; el cliente nunca elige `family_id`. El propietario siempre accede. `family` permite miembros activos; `selected` exige una compartición. La papelera solo es visible explícitamente para el propietario. Las mutaciones de metadatos, papelera y compartición requieren propiedad. Registrar objetos existentes está limitado al rol familiar `owner`.

## API

Fotos: `GET/POST /api/orange-photos`, `GET/PATCH /api/orange-photos/:id`, `POST .../trash`, `POST .../restore`, `GET .../url`, `GET .../original-url`, `POST .../share`.

Álbumes: `GET/POST /api/orange-photo-albums`, `PATCH /:id`, `POST /:id/photos`, `DELETE /:id/photos/:photoId`, `POST /:id/share`.

Etiquetas: `GET/POST /api/orange-photo-tags`. Miembros seleccionables: `GET /api/orange-photo-members`.

## Filtros y enlaces públicos

La biblioteca admite `access_sources=owned,direct,album`, `owner_user_ids` y `share_states=private,family,selected,public_link`. Node valida los propietarios contra usuarios y membresías activas de la familia. La clasificación es exclusiva: `owned` tiene prioridad; para elementos ajenos, `direct` incluye visibilidad familiar o selección directa y tiene prioridad sobre `album`, reservado al acceso obtenido únicamente mediante un álbum compartido.

El enlace público es independiente de `visibility`. Solo el propietario puede crearlo, copiarlo, regenerarlo o revocarlo mediante `POST/DELETE /api/orange-photos/:id/public-link` y `POST/DELETE /api/orange-photo-albums/:id/public-link`. Regenerar invalida inmediatamente el token anterior y revocar responde públicamente como recurso inexistente.

Las APIs públicas parten de `/api/public/orangephotos/photo/:token` y `/api/public/orangephotos/album/:token`, con URL temporal, descarga individual, listado de álbum y ZIP. El listado limita `per_page` a 100 y el ZIP a 500 elementos. Node valida token activo, papelera y pertenencia al álbum, sin exponer familia, propietario interno, correo, claves de almacenamiento, checksum, EXIF completo ni permisos.

Las páginas `/public/orangephotos/photo/:token` y `/public/orangephotos/album/:token` muestran la misma vista reducida con o sin sesión. Reutilizan grid, visor y panel de lectura; no ofrecen edición, subida pública ni colaboración anónima. Requieren aplicar manualmente `20260803100000_orange_photos_public_links.sql`.

## Frontend

`OrangePhotosPage` coordina filtros, galería cronológica, selección, álbumes, paginación, subida, visor, detalles y compartición. Los componentes están en `src/features/orange-photos/` y consumen únicamente la API Node.

La Wiki admite los nodos Tiptap `orangePhotoAlbum` (`albumId`, `height`) y `orangePhotoVideo` (`photoId`, `aspectRatio`). El contenido persiste exclusivamente los identificadores, nunca URLs firmadas, y resuelve cada recurso mediante la API autenticada de Orange Photos, que vuelve a comprobar sus permisos. El HTML de respaldo conserva un `div` de referencia. Los tamaños de álbum son `compact` (280 px), `normal` (420 px) y `large` (600 px).

## Agente Android

El [agente Android privado de sincronización](ANDROID_SYNC_AGENT.md) está en desarrollo. Actualmente solo se ha creado el proyecto base; la sincronización automática todavía no está implementada.

## Limitaciones actuales

No se generan derivados de forma asíncrona: la UI usa thumbnail, preview y finalmente original. Sin dependencias nuevas, se extraen dimensiones básicas de JPEG/PNG/WEBP. OrangePhotos intenta extraer EXIF de HEIC mediante `exifr`, sin garantizar compatibilidad con todos los archivos; si la extracción falla o no contiene una fecha válida, mantiene el fallback a `file_mtime` y después a la fecha de subida. El EXIF completo y los metadatos de vídeo requieren un procesador futuro. No hay enlaces públicos, geocodificación, reconocimiento, deduplicación, borrado definitivo ni importación legacy.
