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
- Máximo de partes simultáneas por archivo: 2.
- Máximo de archivos transfiriéndose simultáneamente: 3.
- Máximo de archivos por selección: 500.
- Imágenes: máximo 30 MB.
- Vídeos: máximo 10 GB.

IndexedDB conserva la cola y los archivos cuando el navegador permite clonar el
`File` o `Blob`. Al reanudar, OrangeFamily consulta las partes ya presentes en
Wasabi y transfiere únicamente las que faltan. Cerrar o suspender el navegador
puede detener la ejecución; al volver, el usuario puede continuar sin repetir
las partes confirmadas. La PWA y Background Sync son una ayuda complementaria,
no una garantía de ejecución con el navegador cerrado.

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

## Biblioteca, compartición y selección

La biblioteca permite filtrar por tipo de contenido (todos, fotos o vídeos) y por alcance: todas, propias, compartidas conmigo o compartidas por mí. En este último alcance puede limitarse la vista a elementos compartidos con toda la familia o con personas concretas. La vista lateral `Compartidas conmigo` excluye siempre los elementos propios.

Las tarjetas propias compartidas muestran un icono naranja; las recibidas muestran el mismo icono en azul. El título accesible indica si se comparte con toda la familia, con personas concretas o quién es el propietario que la compartió.

Durante el modo de selección, `Shift` más clic selecciona el intervalo lineal desde el último elemento ancla. `Ctrl+A` o `Cmd+A` selecciona únicamente los elementos cargados, salvo que el foco esté en un campo editable. `Escape` limpia la selección y su ancla.

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
