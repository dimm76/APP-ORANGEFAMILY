# Almacenamiento de OrangePhotos

- Proveedor: Wasabi mediante el cliente S3 ya compartido por OrangeFamily.
- Bucket conocido: `orangedesk` (la configuración efectiva procede del entorno backend).
- Objetos legacy: `family_photos/...`; se referencian sin mover, copiar ni renombrar.
- Nuevos originales: `family_photos/originals/{family_id}/{yyyy}/{mm}/{uuid}.{extension}`.
- Derivados previstos: `family_photos/previews/...`, `family_photos/thumbnails/...` y posters.

PostgreSQL guarda `provider`, `bucket` y `object_key`, nunca una URL permanente. Node valida el prefijo `family_photos/` y entrega URLs firmadas temporales después de autorizar el recurso. Las credenciales permanecen en el backend.

Mover una fotografía o vídeo a la Papelera solo actualiza PostgreSQL y no elimina ningún objeto de Wasabi.

El borrado definitivo sí elimina de Wasabi exclusivamente los objetos registrados para ese elemento en `public.orange_photo_files`, siempre después de validar:

- familia;
- ownership;
- estado `is_trashed = true`;
- prefijo `family_photos/`;
- `bucket` y `object_key` registrados.

El borrado definitivo puede incluir las variantes registradas `original`, `thumbnail`, `preview` y `poster`.

No se eliminan por inferencia de nombre, patrón o carpeta variantes legacy que no estén registradas en `orange_photo_files`.

Si la eliminación de algún objeto de Wasabi falla, no debe eliminarse el registro principal de PostgreSQL como si la operación hubiese finalizado correctamente. El error debe quedar informado para permitir reintento o reconciliación.

Si una subida a Wasabi termina pero falla la transacción SQL, se registra el posible objeto huérfano para reconciliación manual; no se borra automáticamente.

El backend utiliza `ffprobe-static` y `ffmpeg-static` únicamente para obtener metadatos multimedia y crear previews derivados reproducibles. Estas herramientas nunca modifican ni sustituyen el archivo original.
