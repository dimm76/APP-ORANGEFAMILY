# Almacenamiento de OrangePhotos

- Proveedor: Wasabi mediante el cliente S3 ya compartido por OrangeFamily.
- Bucket conocido: `orangedesk` (la configuración efectiva procede del entorno backend).
- Objetos legacy: `family_photos/...`; se referencian sin mover, copiar ni renombrar.
- Nuevos originales: `family_photos/originals/{family_id}/{yyyy}/{mm}/{uuid}.{extension}`.
- Derivados previstos: `family_photos/previews/...`, `family_photos/thumbnails/...` y posters.

PostgreSQL guarda `provider`, `bucket` y `object_key`, nunca una URL permanente. Node valida el prefijo `family_photos/` y entrega URLs firmadas temporales después de autorizar el recurso. Las credenciales permanecen en el backend.

Mover a papelera solo actualiza PostgreSQL. OrangePhotos no elimina objetos de Wasabi. Si la subida a Wasabi termina pero falla la transacción SQL, se registra el posible objeto huérfano para reconciliación manual; no se borra automáticamente.
