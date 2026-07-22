# Migración legacy futura

No se ejecuta ninguna importación en esta fase. El proceso futuro será idempotente, auditable y no destructivo:

1. Exportar attachments de WordPress.
2. Exportar `postmeta`.
3. Exportar `album_fotos`.
4. Exportar `etiqueta_fotos`.
5. Resolver cada propietario contra usuarios OrangeFamily.
6. Resolver la compartición familiar.
7. Convertir `dmkt_oculto_{user_id}` en `orange_photo_user_settings`.
8. Relacionar attachments con sus `object_key` existentes bajo `family_photos/`.
9. Importar PostgreSQL sin copiar, mover ni volver a subir objetos.
10. Validar conteos, relaciones, permisos y disponibilidad de archivos.
11. No borrar datos ni objetos hasta completar y aprobar la validación.

La correlación estable se guardará en `legacy_source`, `legacy_wp_attachment_id` y `legacy_imported_at`. Antes de crear el importador se definirá el mapeo de usuarios ambiguos, el tratamiento de huérfanos y un informe de reconciliación. No se consultará WordPress desde la aplicación en tiempo de ejecución.
