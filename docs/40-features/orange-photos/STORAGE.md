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

El ZIP no acumula los originales completos en memoria ni crea copias temporales en disco. Los archivos quedan en la raíz con nombres saneados y no colisionantes. No existe un máximo numérico artificial de elementos; la petición queda limitada por el parser local del endpoint y por los límites normales de la infraestructura.

Fuera de producción, el borrado definitivo elimina el registro PostgreSQL pero omite expresamente el borrado físico de objetos legacy `family_photos/`. En producción sí puede borrar físicamente esos objetos después de las validaciones de ownership existentes.

La selección de archivos se prepara en un modal: permite arrastrar, elegir y acumular hasta 100 fotos o vídeos admitidos. La subida, comprobación de duplicados y creación de la cola no comienzan hasta pulsar `Iniciar subida`.

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

- Imágenes: máximo 30 MB mediante la subida simple a la API Node.
- Vídeo simple: hasta 500 MB mediante la subida actual a la API Node.
- Vídeo grande: más de 500 MB y hasta 10 GB mediante stream binario del navegador a Node.
- Parte multipart interna desde Node a Wasabi: 25 MB.
- Concurrencia de la transferencia interna: 1.

En el flujo activo el navegador nunca accede directamente a Wasabi, por lo que
no se necesita permitir `PUT` por CORS ni exponer `ETag`. Node recibe el cuerpo
sin cargarlo completo en memoria, calcula SHA-256 incrementalmente y lo escribe
en un directorio temporal. Después obtiene metadatos y poster y transfiere el
archivo temporal a Wasabi mediante multipart interno.

Este flujo requiere espacio temporal suficiente en el servidor y tarda más que
una transferencia directa porque todos los bytes pasan por Node. El multipart
directo anterior, sus endpoints y `orange_photo_uploads` se conservan, pero el
frontend no los utiliza mientras `direct_backend` sea el modo activo.

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
