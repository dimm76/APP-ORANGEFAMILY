# OrangePhotos

## Estado final de invitados externos — Fase 1

Los invitados externos son `auth_users` normales sin `family_membership`. El acceso se concede exclusivamente mediante grants por álbum. Las invitaciones se gestionan desde Compartir álbum, usan tokens hasheados, caducan a los siete días, requieren coincidencia exacta de email y pueden revocarse.

La Fase 1 incluye landing de invitado, grid, viewer, descarga autenticada y paginación. No incluye subida de fotos ni comentarios.

Migración pendiente: `docs/30-database/migration/20260803140000_orange_photo_album_external_guests.sql`.

No ejecutar la migración hasta la revisión final y el merge coordinado.

## Invitados externos — Fase 1

El acceso público continúa siendo de lectura y descarga. Los miembros familiares se autorizan mediante `family_memberships`; los invitados externos son cuentas de autenticación normales sin membresía familiar y reciben un grant explícito por álbum. No existe `role='guest'` en `family_memberships`.

Las invitaciones usan tokens aleatorios almacenados únicamente como SHA-256, caducan a los siete días y pueden revocarse. Los permisos `can_view`, `can_contribute` y `can_comment` son independientes, aunque ver siempre queda activo cuando se concede otra capacidad.

La Fase 1 deja pendiente la creación automática de cuentas, envío de correo, subida de fotos, comentarios, autoría de aportaciones y política de eliminación. Las rutas de invitación y acceso invitado deben permanecer protegidas por Node y ownership/grants; no se devuelven `token_hash`, `storage_key` ni datos de familia.

OrangePhotos es la biblioteca privada de fotografías y vídeos de OrangeFamily. Cada elemento pertenece a una familia y a un usuario propietario; admite álbumes, etiquetas, papelera reversible y visibilidad `private`, `family` o `selected`.

## Entidades

- `orange_photos`: metadatos, propietario, privacidad, EXIF saneado, localización y estado.
- `orange_photo_files`: original y variantes físicas (`preview`, `thumbnail`, `poster`).
- `orange_photo_albums` y `orange_photo_album_items`: álbumes jerárquicos y relación N:M.
- `orange_photo_shares` y `orange_photo_album_shares`: destinatarios concretos.
- `orange_photo_user_settings`: ocultación y favorito particulares.
- `orange_photo_library_items`: pertenencia persistente de una fotografía a la biblioteca personal de uno o varios usuarios. No sustituye a `orange_photos.owner_user_id`, que identifica al propietario/origen original.
- `orange_photo_tags` y `orange_photo_tag_items`: etiquetas familiares.

## Pertenencia a biblioteca

OrangePhotos diferencia entre propiedad original, acceso compartido y pertenencia a biblioteca.

`orange_photos.owner_user_id` identifica de forma estable al usuario propietario/origen original de la fotografía.

`orange_photo_library_items` representa las bibliotecas personales: una misma fotografía puede estar incorporada a las bibliotecas de varios usuarios sin duplicar `orange_photos`, `orange_photo_files` ni los objetos almacenados en Wasabi.

La migración inicial crea una pertenencia únicamente para el propietario original de cada fotografía existente. Las nuevas fotografías crean de forma transaccional una pertenencia inicial para su propietario original en `orange_photo_library_items`. La tabla se introduce de forma aditiva y todavía no modifica las consultas, permisos, papelera, comparticiones, álbumes, deduplicación ni el agente Android.

## Permisos

Node resuelve la familia autenticada; el cliente nunca elige `family_id`. El propietario siempre accede. `family` permite miembros activos; `selected` exige una compartición. La papelera solo es visible explícitamente para el propietario. Las mutaciones de metadatos, papelera y compartición requieren propiedad. Registrar objetos existentes está limitado al rol familiar `owner`.

## API

Fotos: `GET/POST /api/orange-photos`, `GET/PATCH /api/orange-photos/:id`, `POST .../trash`, `POST .../restore`, `GET .../url`, `GET .../original-url`, `POST .../share`.

Álbumes: `GET/POST /api/orange-photo-albums`, `PATCH /:id`, `POST /:id/photos`, `DELETE /:id/photos/:photoId`, `POST /:id/share`.

Etiquetas: `GET/POST /api/orange-photo-tags`. Miembros seleccionables: `GET /api/orange-photo-members`.

## Filtros y enlaces públicos

La biblioteca admite `access_sources=owned,direct,album`, `owner_user_ids` y `share_states=private,family,selected,public_link`. Los filtros múltiples usan `access_sources_mode` y `owner_user_ids_mode`, con semántica `include` o `exclude`; una lista vacía no restringe en ninguno de los modos. Node valida los propietarios contra usuarios y membresías activas de la familia. La clasificación es exclusiva: `owned` tiene prioridad; para elementos ajenos, `direct` incluye visibilidad familiar o selección directa y tiene prioridad sobre `album`, reservado al acceso obtenido únicamente mediante un álbum compartido.

Los modos y selecciones visuales se persisten por usuario y navegador. «Fotos de» no muestra al usuario actual y se reserva para distinguir propietarios del contenido recibido; los elementos propios se controlan mediante «Origen → Mis elementos».

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
