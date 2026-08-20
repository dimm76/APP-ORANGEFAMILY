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

- `orange_photos`: asset físico compartido y procedencia original. `owner_user_id` identifica al usuario que originó/subió el asset y se conserva como provenance; los archivos físicos y derivados se almacenan una sola vez.
- `orange_photo_files`: original y variantes físicas (`preview`, `thumbnail`, `poster`).
- `orange_photo_albums` y `orange_photo_album_items`: álbumes jerárquicos y relación N:M. Cada item conserva `source_user_id` para identificar qué copia lógica aporta el contenido al álbum.
- `orange_photo_shares` y `orange_photo_album_shares`: destinatarios concretos. Las comparticiones directas de fotografías quedan acotadas por `(photo_id, owner_user_id)` para que cada propietario lógico gestione su propia compartición.
- `orange_photo_user_settings`: ocultación y favorito particulares.
- `orange_photo_library_items`: copia lógica propia de cada usuario sobre un mismo asset físico. Contiene el ownership operativo y el estado mutable personal de la copia: metadatos editables, privacidad, enlace público y papelera.
- `orange_photo_events`: trazabilidad del asset físico acotada por `copy_owner_user_id`, de forma que cada propietario lógico consulta el historial correspondiente a su propia copia.
- `orange_photo_tags` y `orange_photo_tag_items`: etiquetas familiares.

## Pertenencia a biblioteca

OrangePhotos separa el asset físico de las copias lógicas que pertenecen a cada usuario.

`orange_photos` representa el asset físico compartido. `orange_photos.owner_user_id` es inmutable desde el punto de vista funcional y conserva la procedencia/origen original del archivo; ya no determina por sí solo quién puede gestionar una copia.

`orange_photo_library_items` representa una copia lógica propia. Una misma fotografía o vídeo puede pertenecer simultáneamente a varios usuarios sin duplicar `orange_photos`, `orange_photo_files` ni los objetos almacenados en Wasabi.

Cada copia lógica puede gestionar de forma independiente sus metadatos editables, fecha y hora, título, descripción, ubicación, favorito, privacidad, compartición directa, enlace público, pertenencia a álbumes, papelera, restauración, eliminación e historial.

Las respuestas autenticadas distinguen:

- `is_original_owner`: el usuario actual es quien originó/subió el asset físico.
- `is_owner`: la copia lógica efectiva pertenece al usuario actual.
- `is_in_library`: existe una copia lógica propia en `orange_photo_library_items`.
- `copy_owner_user_id`: propietario de la copia lógica efectiva que se está mostrando.
- `access_source`: origen por el que se ha resuelto la fotografía.

`access_source` admite:

- `owned`: copia propia cuyo usuario coincide con el propietario/origen original.
- `library`: copia lógica propia adquirida mediante «Añadir a mi biblioteca».
- `direct`: fotografía recibida mediante compartición directa de otra copia lógica.
- `album`: fotografía recibida mediante un álbum compartido.

La prioridad de resolución autenticada es `owned → library → direct → album`.

Cuando un usuario recibe una fotografía pero todavía no la ha incorporado a su biblioteca, visualiza la copia lógica del usuario que la comparte. Los metadatos visibles proceden de esa copia fuente, no de los campos legacy de `orange_photos`.

`POST /api/orange-photos/:id/library` convierte una fotografía recibida en una copia lógica propia sin duplicar el archivo físico. La nueva copia toma como punto de partida los metadatos efectivos de la copia recibida, comienza activa y privada y no hereda enlaces públicos ni comparticiones directas.

Si el usuario ya tenía una copia lógica en papelera, «Añadir a mi biblioteca» restaura esa copia existente en lugar de crear otra. Se conservan sus metadatos personales, vuelve a estado privado y se eliminan sus enlaces públicos y comparticiones directas anteriores.

La interfaz web no ofrece «Quitar de mi biblioteca» como operación paralela. Una copia lógica propia utiliza el flujo normal de cualquier fotografía propia: «Mover a la papelera», «Restaurar» y «Eliminar definitivamente». El endpoint `DELETE /api/orange-photos/:id/library` se conserva únicamente por compatibilidad; para una copia adquirida aplica el estado de papelera lógico y no elimina el asset físico.

La papelera es personal. Enviar una copia lógica a la papelera no afecta a las copias de otros usuarios.

La eliminación definitiva elimina únicamente la copia lógica del usuario que ejecuta la operación. `orange_photos`, `orange_photo_files` y los objetos físicos de Wasabi solo se eliminan cuando desaparece la última copia lógica del asset.

Las comparticiones directas pertenecen a cada copia lógica. `orange_photo_shares.owner_user_id` identifica al propietario lógico que comparte y su clave efectiva queda acotada por `(photo_id, owner_user_id, user_id)`.

Los elementos de álbum conservan `source_user_id`. El contenido del álbum se resuelve contra esa copia lógica concreta; si esa copia deja de estar activa, deja de aportar contenido al álbum.

Los eventos de fotografía utilizan `copy_owner_user_id` para separar la trazabilidad de cada copia lógica aunque varias copias compartan el mismo `photo_id`.

Los archivos físicos, previews, thumbnails, playback y posters siguen compartiéndose entre las copias lógicas. No se multiplican por cada usuario.

La generación o regeneración manual del poster de un vídeo queda reservada al propietario/origen original porque modifica un derivado físico compartido por todas las copias.

Las estadísticas de almacenamiento contabilizan los bytes físicos una única vez. La atribución física por usuario continúa utilizando `orange_photos.owner_user_id`. Un asset solo cuenta como almacenamiento físicamente en papelera cuando existe al menos una copia lógica y no queda ninguna copia lógica activa.

Android continúa consumiendo la misma API Node; este cutover no introduce una API específica para Android.

## Permisos

Node resuelve siempre la familia y el usuario autenticados; el frontend nunca decide `family_id`, ownership ni permisos.

Para fotografías, las mutaciones funcionales se autorizan mediante ownership lógico (`is_owner` / copia de `orange_photo_library_items`), no mediante `orange_photos.owner_user_id`.

Cada propietario lógico puede editar sus metadatos personales, favorito, compartición, enlace público, álbumes, papelera, restauración, eliminación de su copia e historial.

`orange_photos.owner_user_id` se utiliza como procedencia/origen original y para operaciones físicas que necesariamente afectan a todas las copias, como la regeneración manual del poster de vídeo.

El borrado físico del asset solo puede producirse al eliminar la última copia lógica.

Los permisos de álbum continúan siendo independientes y se resuelven mediante ownership, grants y permisos de contribución del álbum.

Registrar objetos existentes continúa limitado al rol familiar `owner`.

## API

Fotos: `GET/POST /api/orange-photos`, `GET/PATCH /api/orange-photos/:id`, `POST .../trash`, `POST .../restore`, `GET .../url`, `GET .../original-url`, `POST .../share`.

Álbumes: `GET/POST /api/orange-photo-albums`, `PATCH /:id`, `POST /:id/photos`, `DELETE /:id/photos/:photoId`, `POST /:id/share`.

Etiquetas: `GET/POST /api/orange-photo-tags`. Miembros seleccionables: `GET /api/orange-photo-members`.

## Filtros y enlaces públicos

La biblioteca admite `access_sources=owned,library,direct,album`, `owner_user_ids` y `share_states=private,family,selected,public_link`. Los filtros múltiples usan `access_sources_mode` y `owner_user_ids_mode`, con semántica `include` o `exclude`; una lista vacía no restringe en ninguno de los modos. `owned` identifica la copia lógica propia del usuario que además originó el asset; `library` identifica una copia lógica propia adquirida posteriormente; `direct` y `album` identifican contenido recibido que todavía se resuelve desde una copia lógica ajena. La prioridad exclusiva es `owned → library → direct → album`. `owner_user_ids` continúa utilizando `orange_photos.owner_user_id` para filtrar por procedencia/origen original, no para decidir ownership operativo.

Los modos y selecciones visuales se persisten por usuario y navegador. «Fotos de» no muestra al usuario actual y se reserva para distinguir propietarios del contenido recibido; los elementos propios se controlan mediante «Origen → Mis elementos».

El enlace público es independiente de `visibility`. En fotografías pertenece a cada copia lógica y cada propietario lógico puede crear, regenerar o revocar el enlace de su propia copia. En álbumes continúa perteneciendo al propietario del álbum. Las operaciones utilizan `POST/DELETE /api/orange-photos/:id/public-link` y `POST/DELETE /api/orange-photo-albums/:id/public-link`. Regenerar invalida inmediatamente el token anterior y revocar responde públicamente como recurso inexistente.

Las APIs públicas parten de `/api/public/orangephotos/photo/:token` y `/api/public/orangephotos/album/:token`, con URL temporal, descarga individual, listado de álbum y ZIP. El listado limita `per_page` a 100 y el ZIP a 500 elementos. Node valida token activo, papelera y pertenencia al álbum, sin exponer familia, propietario interno, correo, claves de almacenamiento, checksum, EXIF completo ni permisos.

Las páginas `/public/orangephotos/photo/:token` y `/public/orangephotos/album/:token` muestran la misma vista reducida con o sin sesión. Reutilizan grid, visor y panel de lectura; no ofrecen edición, subida pública ni colaboración anónima. Requieren aplicar manualmente `20260803100000_orange_photos_public_links.sql`.

## Frontend

`OrangePhotosPage` coordina filtros, galería cronológica, selección, álbumes, paginación, subida, visor, detalles y compartición. Los componentes están en `src/features/orange-photos/` y consumen únicamente la API Node.

La Wiki admite los nodos Tiptap `orangePhotoAlbum` (`albumId`, `height`) y `orangePhotoVideo` (`photoId`, `aspectRatio`). El contenido persiste exclusivamente los identificadores, nunca URLs firmadas, y resuelve cada recurso mediante la API autenticada de Orange Photos, que vuelve a comprobar sus permisos. El HTML de respaldo conserva un `div` de referencia. Los tamaños de álbum son `compact` (280 px), `normal` (420 px) y `large` (600 px).

## Agente Android

El [agente Android privado de sincronización](ANDROID_SYNC_AGENT.md) está en desarrollo. Actualmente solo se ha creado el proyecto base; la sincronización automática todavía no está implementada.

## Limitaciones actuales

No se generan derivados de forma asíncrona: la UI usa thumbnail, preview y finalmente original. Sin dependencias nuevas, se extraen dimensiones básicas de JPEG/PNG/WEBP. OrangePhotos intenta extraer EXIF de HEIC mediante `exifr`, sin garantizar compatibilidad con todos los archivos; si la extracción falla o no contiene una fecha válida, mantiene el fallback a `file_mtime` y después a la fecha de subida. El EXIF completo y los metadatos de vídeo requieren un procesador futuro. No hay enlaces públicos, geocodificación, reconocimiento, deduplicación, borrado definitivo ni importación legacy.
