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

## Frontend

`OrangePhotosPage` coordina filtros, galería cronológica, selección, álbumes, paginación, subida, visor, detalles y compartición. Los componentes están en `src/features/orange-photos/` y consumen únicamente la API Node.

## Limitaciones actuales

No se generan derivados de forma asíncrona: la UI usa thumbnail, preview y finalmente original. Sin dependencias nuevas, se extraen dimensiones básicas de JPEG/PNG/WEBP. OrangePhotos intenta extraer EXIF de HEIC mediante `exifr`, sin garantizar compatibilidad con todos los archivos; si la extracción falla o no contiene una fecha válida, mantiene el fallback a `file_mtime` y después a la fecha de subida. El EXIF completo y los metadatos de vídeo requieren un procesador futuro. No hay enlaces públicos, geocodificación, reconocimiento, deduplicación, borrado definitivo ni importación legacy.
