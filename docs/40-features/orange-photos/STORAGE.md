# Almacenamiento de OrangePhotos

- Proveedor: Wasabi mediante el cliente S3 ya compartido por OrangeFamily.
- Bucket conocido: `orangedesk` (la configuración efectiva procede del entorno backend).
- Objetos legacy: `family_photos/...`; se leen sin mover, copiar ni renombrar.
- Nuevos originales: `<WASABI_ENV_PREFIX>/orange-photos/originals/{family_id}/{yyyy}/{mm}/{uuid}.{extension}`.
- Nuevos derivados: `<WASABI_ENV_PREFIX>/orange-photos/previews/...` y `<WASABI_ENV_PREFIX>/orange-photos/posters/...`.
- Prefijo local: `app-orangefamily/local`.
- Prefijo de producción: `app-orangefamily/production`.

PostgreSQL guarda `provider`, `bucket` y `object_key`, nunca una URL permanente. Node acepta para lectura el prefijo actual del entorno y el prefijo legacy `family_photos/`, pero solo escribe y lista objetos nuevos dentro del prefijo actual. Las credenciales permanecen en el backend.

## Descargas

La descarga de una sola fotografía o vídeo entrega directamente el original obtenido desde Wasabi y conserva su nombre original. Cuando se seleccionan varios elementos, `POST /api/orange-photos/download` genera un único ZIP en streaming: Node valida previamente la autenticación, la familia, la visibilidad y el acceso a todos los recursos y después encadena secuencialmente sus streams originales hacia la respuesta.

El ZIP admite hasta 500 elementos por operación para proteger recursos y mantener el streaming controlado; no acumula los originales completos en memoria, no prepara el ZIP completo en memoria ni crea copias temporales en disco. Los archivos quedan en la raíz con nombres saneados y no colisionantes.

Fuera de producción, el borrado definitivo elimina el registro PostgreSQL pero omite expresamente el borrado físico de objetos legacy `family_photos/`. En producción sí puede borrar físicamente esos objetos después de las validaciones de ownership existentes.

La selección de archivos se prepara en un modal: permite arrastrar, elegir y acumular hasta 500 fotos o vídeos admitidos. El navegador normaliza exclusivamente los formatos soportados cuando el MIME falta o no es reconocido, utilizando la extensión del nombre, e informa los duplicados, formatos incompatibles y archivos excluidos por el límite. La subida, comprobación de duplicados y creación de la cola no comienzan hasta pulsar `Iniciar subida`.

Mover una fotografía o vídeo a la Papelera solo actualiza PostgreSQL y no elimina ningún objeto de Wasabi.

El borrado definitivo sí elimina de Wasabi exclusivamente los objetos registrados para ese elemento en `public.orange_photo_files`, siempre después de validar:

- familia;
- ownership;
- estado `is_trashed = true`;
- prefijo actual del entorno o prefijo legacy `family_photos/`;
- `bucket` y `object_key` registrados.

El borrado definitivo puede incluir las variantes registradas `original`, `thumbnail`, `preview` y `poster`.

No se eliminan por inferencia de nombre, patrón o carpeta variantes legacy que no estén registradas en `orange_photo_files`.

Si la eliminación de algún objeto de Wasabi falla, no debe eliminarse el registro principal de PostgreSQL como si la operación hubiese finalizado correctamente. El error debe quedar informado para permitir reintento o reconciliación.

Si una subida a Wasabi termina pero falla la transacción SQL, Node intenta borrar el objeto transferido y registra cualquier fallo de esa limpieza para reconciliación manual.

El backend utiliza `ffprobe-static` y `ffmpeg-static` únicamente para obtener metadatos multimedia y crear previews derivados reproducibles. Estas herramientas nunca modifican ni sustituyen el archivo original.

## Vídeo nuevo

1. Se almacena el original.
2. `ffprobe` obtiene duración y dimensiones.
3. El poster JPEG se genera antes de responder.
4. El registro se crea con original y poster.
5. El preview MP4 se genera de forma aplazada.
6. Si el proceso aplazado falla, el reconciliador lo completa.

## Vídeo existente

El reconciliador completa únicamente:

- metadatos ausentes;
- poster cuando no existe poster ni thumbnail;
- preview cuando no existe.

Nunca duplica variantes ni modifica originales.

## Fecha de captura

Prioridad para imágenes:

1. fecha manual;
2. EXIF `DateTimeOriginal` o `CreateDate`;
3. fecha de modificación proporcionada por el dispositivo;
4. fecha de subida.

Prioridad para vídeos:

1. fecha manual;
2. `creation_time` embebido en el contenedor;
3. fecha de modificación proporcionada por el dispositivo;
4. fecha de subida.

El navegador no proporciona la fecha de creación del sistema de archivos. `File.lastModified` corresponde normalmente a la fecha de modificación. En esta fase no se infiere ninguna fecha a partir del nombre del archivo.

## Límites y modos de subida

Todos los originales nuevos de OrangePhotos web utilizan multipart directo del
navegador a Wasabi, tanto para imágenes como para vídeos admitidos. Node autentica
y autoriza al usuario, crea la sesión, firma temporalmente cada parte, comprueba
el resultado y registra el objeto final. Las credenciales permanecen exclusivamente
en backend y las URLs firmadas no se persisten.

- Wasabi conserva un único objeto original final.
- Tamaño de parte: 25 MB.
- Máximo de partes simultáneas por archivo: 2; en web se utiliza 1 para archivos de 1 GB o más.
- Máximo de archivos transfiriéndose simultáneamente: 3.
- Máximo de archivos por selección: 500.
- Imágenes: máximo 30 MB.
- Vídeos: máximo 10 GB.

La web divide los archivos grandes en partes de 25 MB. IndexedDB conserva la cola
y los archivos de hasta 100 MB cuando el navegador permite clonar el `File` o
`Blob`; para tamaños superiores no intenta persistir localmente el archivo
completo. La sesión remota y las partes terminadas permanecen disponibles para
reanudar, pero después de cerrar o recargar el navegador el usuario puede tener
que seleccionar de nuevo el mismo archivo. OrangeFamily consulta las partes ya
presentes en Wasabi y transfiere únicamente las que faltan. Wake Lock se solicita
de forma opcional durante subidas de 1 GB o más, pero, igual que PWA y Background
Sync, no garantiza la ejecución en segundo plano ni con el navegador cerrado.

La futura aplicación Android utilizará la misma API multipart. Los endpoints de
subida simple y `direct_backend` permanecen temporalmente por compatibilidad,
pero OrangePhotos web ya no los selecciona.

## Duplicados

Antes de subir se busca una posible coincidencia por nombre normalizado y tamaño
exacto dentro de la misma familia. Es una advertencia y el usuario puede cancelar,
abrir el elemento existente o continuar expresamente.

El duplicado exacto se determina mediante SHA-256 sobre el original. Se bloquea
por defecto, incluso cuando el elemento existente está en la papelera. El usuario
puede forzar expresamente una nueva copia; por ello el checksum tiene un índice no
único.

Las coincidencias preventivas por nombre y tamaño y los duplicados exactos se mantienen como decisiones pendientes, no como fallos de subida, aunque se detecten al iniciar o completar una sesión multipart restaurada. El detalle individual devuelve URLs firmadas de miniatura y visualización con las mismas prioridades que el listado, permitiendo abrir elementos existentes aunque su periodo no esté cargado.

## Errores y limpieza

OrangePhotos devuelve códigos estables sin exponer errores internos:

```text
EMPTY_FILE, INVALID_MULTIPART, INVALID_METADATA, UNSUPPORTED_FILE_TYPE,
FILE_TOO_LARGE, INVALID_POSTER, POSSIBLE_DUPLICATE, DUPLICATE_FILE,
UPLOAD_NOT_FOUND, UPLOAD_NOT_OWNED, UPLOAD_EXPIRED, UPLOAD_INVALID_STATUS,
UPLOAD_PART_INVALID, UPLOAD_INTERRUPTED, UPLOAD_ABORT_FAILED,
UPLOAD_CLIENT_KEY_CONFLICT, UPLOAD_FILE_MISSING, UPLOAD_PERSISTENCE_FAILED,
STORAGE_INIT_FAILED, STORAGE_SIGN_FAILED, STORAGE_UPLOAD_FAILED,
STORAGE_COMPLETE_FAILED, STORAGE_VERIFY_FAILED, HASH_CALCULATION_FAILED,
DATABASE_REGISTRATION_FAILED, VIDEO_METADATA_FAILED, VIDEO_POSTER_FAILED,
VIDEO_PROCESSING_FAILED, INTERNAL_ERROR
```

Si falla la verificación, el registro PostgreSQL o la detección de un duplicado
exacto no forzado, Node intenta eliminar el objeto nuevo. Los fallos posteriores
de metadatos, poster o preview mantienen el original registrado y se comunican
como advertencias. El procesamiento aplazado y el reconciliador continúan usando
el flujo existente de `processStoredOrangePhotoVideo()`.

El propietario puede solicitar desde el visor **Generar miniatura** cuando un vídeo conserva su original pero no dispone de variante `poster`, y **Recrear miniatura** cuando ya existe. La recreación sustituye exclusivamente la variante `poster` de forma segura y transaccional: el original no se modifica, el póster anterior se conserva si la operación falla antes del commit y su objeto se elimina de Wasabi únicamente después del commit. Esta operación no permite sustituir las variantes `original`, `preview` ni `thumbnail`.

## Biblioteca, compartición y selección

La biblioteca permite filtrar por tipo de contenido (todos, fotos o vídeos) y por alcance: todas, propias, compartidas conmigo o compartidas por mí. En este último alcance puede limitarse la vista a elementos compartidos con toda la familia o con personas concretas. La vista lateral `Compartidas conmigo` excluye siempre los elementos propios.

Las tarjetas propias compartidas muestran un icono naranja; las recibidas muestran el mismo icono en azul. El título accesible indica si se comparte con toda la familia, con personas concretas o quién es el propietario que la compartió.

Durante el modo de selección, `Shift` más clic selecciona el intervalo lineal desde el último elemento ancla. `Ctrl+A` o `Cmd+A` selecciona únicamente los elementos cargados, salvo que el foco esté en un campo editable. `Escape` limpia la selección y su ancla.

## Álbumes

Los álbumes pueden crearse tanto desde el botón global `+` como desde la cabecera de la vista de álbumes. El propietario puede cambiar su nombre, compartirlos con toda la familia o con miembros concretos, y elegir manualmente como portada una imagen que pertenezca al propio álbum.

Al añadir la primera imagen a un álbum que todavía no tiene portada, Node la asigna automáticamente sin reemplazar posteriormente una portada existente. Archivar un álbum lo retira del listado, pero conserva intactas sus fotos en la biblioteca y no elimina manualmente sus relaciones desde el frontend.

Compartir un álbum concede acceso efectivo y reversible a todas las fotos y vídeos que contiene, sin cambiar `orange_photos.visibility` ni crear filas en `orange_photo_shares`. Para el destinatario, esos elementos aparecen tanto en **Todas las fotos** como en **Compartidas conmigo**; al dejar de compartir el álbum o retirar un elemento, desaparece ese acceso salvo que exista otra compartición directa o mediante otro álbum. Las tarjetas propias compartidas por álbum usan el icono naranja y las recibidas el azul.

El permiso del álbum puede ser **Solo ver** o **Puede añadir fotos y vídeos**. Los colaboradores únicamente pueden añadir contenido propio y retirar relaciones que ellos mismos hayan creado; el propietario conserva la gestión del álbum y puede retirar cualquier elemento. Esta fase no ofrece **Guardar copia en mi biblioteca** y no duplica objetos en Wasabi.

La migración `20260726130000_orange_photo_album_contributions.sql` añade `orange_photo_albums.allow_contributions` para álbumes familiares y `orange_photo_album_shares.can_contribute` para destinatarios concretos. Debe aplicarse antes de desplegar el backend que consulta estos campos.

Cada álbum dispone de una cabecera interna centrada con título, estado de compartición y contador. Sus acciones de compartir, añadir contenido, actividad y menú de opciones se muestran en el host global derecho de la barra superior, con prioridad para los modos de papelera, selección múltiple y elección de portada. El alta de contenido abre la biblioteca global en modo selección, conserva identificados los elementos ya incluidos y vuelve al álbum al confirmar. La elección de portada solo admite imágenes pertenecientes al álbum y se activa mediante la ruta `?selectCover=1`. El modal de compartición es común al listado y a la cabecera, agrupa visualmente visibilidad y permisos, y explica dinámicamente si otras personas pueden añadir fotos y vídeos.

Los iconos sobre fotografías y portadas de álbum indican mediante tooltip si el contenido fue compartido con la familia, con miembros concretos, por otra persona o mediante un álbum. La actividad persistida, comentarios, likes, notificaciones, compartir mediante enlace, presentación y descarga completa del álbum quedan aplazados.

## Gestión de la cola web

La selección previa permite retirar archivos antes de iniciar la subida. En la cola persistente, una subida activa puede cancelarse y retirarse: el navegador aborta las transferencias en curso y, cuando existe una sesión multipart, solicita su aborto mediante `DELETE /api/orange-photos/uploads/:uploadId` antes de eliminar la entrada local.

Las filas completadas y fallidas pueden retirarse individualmente. La acción **Limpiar** elimina exclusivamente el historial terminal (`completed`, `cancelled`, `error`, `missing_file` y `duplicate_pending`) y conserva los trabajos activos o pendientes. Retirar una fila completada o limpiar el historial no elimina la fotografía ya creada ni su objeto remoto.

Los fallos recuperables permiten reintento individual y global. El reintento individual actúa solo sobre la fila elegida; **Reintentar todo** procesa los errores recuperables sin alterar completados ni errores definitivos.

## Trazabilidad

PostgreSQL es la fuente oficial de verdad y `orange_photo_events` conserva las
acciones significativas del ciclo de vida. Wasabi conserva el objeto y Room actúa
solo como memoria operativa reconstruible del agente Android. El origen Android
se distingue mediante el tipo de cliente y un UUID aleatorio de instalación.

Una descarga se registra únicamente cuando finaliza la respuesta, pero no confirma
que el archivo siga existiendo posteriormente en el disco local o en el móvil.
Las visualizaciones, previews, thumbnails, URLs firmadas y accesos públicos no se
registran en esta fase.

El propietario puede consultar este historial bajo demanda desde el panel
`Información` del lightbox. El historial permanece protegido por la API y no se
muestra a otros miembros, incluido el administrador familiar cuando no sea el
propietario de la foto. La consulta no registra eventos de visualización.
