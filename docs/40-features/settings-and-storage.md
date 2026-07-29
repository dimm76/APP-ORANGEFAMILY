# Ajustes y almacenamiento

## Menú de Ajustes

Las rutas de administración utilizan un menú lateral propio:

- `/app/settings/family`: familiares, accesos y permisos;
- `/app/settings/attachments`: biblioteca global de Attachments;
- `/app/settings/storage`: uso de almacenamiento.

El menú incluye una acción `Menú principal` que vuelve a `/`.

El acceso visual a Ajustes se muestra exclusivamente al `owner`. La
seguridad real continúa aplicándose en Node y no depende del frontend.

## Uso de almacenamiento

La ruta autenticada y exclusiva del `owner` es:

```text
GET /api/settings/storage-usage
```

PostgreSQL es la fuente habitual para calcular el uso mostrado.

No se ejecuta `ListObjects` contra Wasabi al abrir la pantalla.

### Attachments

Se suman los registros de `public.attachments` que pertenecen a la familia
autenticada y cumplen:

- `status = 'active'`;
- `deleted_at IS NULL`.

La atribución por usuario utiliza `attachments.created_by`.

### OrangePhotos

Se suman todas las filas registradas en `public.orange_photo_files`,
incluidas las variantes:

- `original`;
- `thumbnail`;
- `preview`;
- `poster`.

Los archivos se clasifican como imágenes o vídeos mediante
`orange_photos.media_type`.

La atribución por usuario utiliza `orange_photos.owner_user_id`.
Compartir un elemento o incluirlo en un álbum no cambia su propietario y
no duplica su almacenamiento.

### Papelera

Los elementos de OrangePhotos enviados a la papelera mantienen sus objetos
en Wasabi.

`trash_bytes` y `trash_items` son subconjuntos informativos del total de
OrangePhotos. No se suman nuevamente a `total_bytes`.

Attachments no dispone actualmente de una papelera equivalente.

### Integridad

Cuando una fila física de almacenamiento no tiene `size_bytes`, la API
incrementa `integrity.files_without_size`.

En ese caso la interfaz advierte que los totales pueden ser inferiores al
espacio físico real.

## Capacidad y cuota

OrangeFamily no define actualmente una cuota familiar ni una capacidad
máxima de Wasabi.

La interfaz muestra almacenamiento utilizado. No muestra almacenamiento
restante ni simula una capacidad inexistente.

Una futura reconciliación con Wasabi será una funcionalidad independiente
y no forma parte de esta pantalla.
