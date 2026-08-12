# Orange Photos — Derivados multimedia

## Propósito

Orange Photos conserva siempre el archivo original como fuente canónica y puede generar archivos derivados optimizados para visualización, navegación y reproducción.

Los derivados permiten:

* reducir transferencia de datos;
* mejorar el tiempo de carga;
* reducir consumo de memoria;
* optimizar la experiencia móvil;
* reutilizar exactamente la misma infraestructura desde web y Android;
* conservar el original sin modificaciones.

La generación de derivados pertenece exclusivamente al backend Node.

Ningún cliente web o Android debe generar, registrar o almacenar directamente derivados en Wasabi.

---

# Principios

## Original inmutable

El archivo `original`:

* es el archivo recibido durante la subida;
* se conserva sin modificación;
* mantiene su propio checksum SHA-256;
* es la referencia utilizada para deduplicación;
* continúa disponible para descarga en calidad original.

Los derivados nunca sustituyen al original.

---

## API compartida

Web y Android utilizan la misma API Node.

No existen:

* derivados específicos de Android;
* derivados específicos de la web;
* endpoints con lógica de negocio exclusiva para Android.

Los clientes solicitan recursos o variantes y Node valida:

* autenticación;
* autorización;
* ownership;
* acceso al recurso;
* variante disponible.

---

# Relación entre archivos

La relación canónica entre una fotografía o vídeo y sus archivos físicos se establece mediante:

```text
orange_photos.id
        ↓
orange_photo_files.photo_id
        +
orange_photo_files.variant
```

La identidad de una variante es:

```text
photo_id + variant
```

Los nombres físicos almacenados en Wasabi son auxiliares.

Nunca deben utilizarse para:

* determinar relaciones;
* deduplicar;
* localizar derivados;
* decidir qué objetos eliminar.

---

# Checksums

Cada archivo físico conserva su propio checksum SHA-256.

Ejemplo:

```text
original
  checksum = hash de los bytes originales

thumbnail
  checksum = hash de los bytes del thumbnail

preview
  checksum = hash de los bytes del preview
```

Los checksums de los derivados son independientes del checksum del original.

La comprobación de duplicados de Orange Photos continúa utilizando exclusivamente el checksum del original dentro del ámbito correspondiente de familia y propietario.

Los hashes de derivados no participan en la deduplicación funcional.

---

# Variantes de fotografías

## original

Archivo fuente recibido durante la subida.

Características:

* sin modificar;
* resolución original;
* formato original;
* checksum SHA-256 propio.

Uso:

* conservación;
* descarga en calidad original;
* operaciones que requieran el archivo fuente.

---

## thumbnail

Versión ligera destinada a:

* timeline;
* cuadrículas;
* listado de álbumes;
* portadas;
* vistas Android;
* navegación rápida.

Características:

```text
lado máximo: 480 px
```

Reglas:

* conservar proporción;
* nunca ampliar una imagen menor de 480 px;
* aplicar correctamente la orientación visual;
* eliminar metadatos EXIF;
* conservar transparencia cuando el formato lo permita.

Formato:

```text
JPEG → JPEG
HEIC → JPEG
PNG  → PNG
WebP → WebP
```

---

## preview

Versión optimizada destinada a:

* lightbox;
* visor ordinario;
* consulta móvil;
* consulta web cuando no sea necesario cargar el original.

Características:

```text
lado máximo: 1920 px
```

Reglas:

* conservar proporción;
* nunca ampliar una imagen menor de 1920 px;
* aplicar correctamente la orientación visual;
* eliminar metadatos EXIF;
* conservar transparencia cuando el formato lo permita.

Formato:

```text
JPEG → JPEG
HEIC → JPEG
PNG  → PNG
WebP → WebP
```

---

# Variantes de vídeo

## original

Vídeo fuente recibido durante la subida.

Se conserva sin modificar.

---

## poster

Imagen estática representativa del vídeo.

Estado actual:

* ya implementado;
* JPEG;
* lado máximo aproximado de 1280 px.

Uso:

* estado inicial del visor;
* portada estática;
* fallback visual.

---

## thumbnail

Imagen ligera derivada del vídeo destinada a:

* timelines;
* cuadrículas;
* álbumes;
* navegación Android.

Objetivo:

```text
lado máximo: 480 px
```

Para vídeos históricos que ya dispongan de `poster`, el thumbnail debe generarse preferentemente a partir del poster existente.

No debe descargarse ni transcodificarse el vídeo original únicamente para crear el thumbnail cuando exista un poster válido.

---

## preview

Clip corto de previsualización.

Estado actual:

```text
duración: 3 segundos
resolución máxima aproximada: 720 px
codec: H.264
audio: eliminado
faststart: activado
```

Uso:

* previsualización voluntaria;
* visor;
* interacción específica.

No debe reproducirse automáticamente en todos los elementos del timeline móvil.

---

## playback

Variante completa optimizada para reproducción ordinaria y streaming progresivo.

Estado: implementado para nuevas subidas de vídeos.

Características:

* MP4;
* H.264;
* AAC;
* caja máxima horizontal: 1920 × 1080;
* caja máxima vertical: 1080 × 1920;
* conservar la proporción;
* no ampliar vídeos menores;
* dimensiones finales pares;
* máximo 30 fps;
* CRF 23 y preset `veryfast`;
* pixel format `yuv420p`;
* audio AAC 128 kbps cuando exista;
* duración completa;
* `faststart`;
* compatibilidad web y Android.

Uso: reproducción ordinaria web y Android, streaming progresivo y evitar cargar
el original para el visionado normal.

El `original` seguirá conservándose independientemente de `playback`.

---

### Pipeline de vídeo

Vídeo nuevo: original → poster → thumbnail → preview → playback.

El poster puede generarse durante la subida. Preview y playback se generan de
forma diferida tras registrar el original; la respuesta no espera al playback.
Un fallo de playback no invalida el original y los derivados ausentes pueden
reconstruirse mediante reconciliación. `photo_id + variant` identifica cada
derivado.

Los originales y derivados temporales de vídeo se procesan en almacenamiento en
disco, sin utilizar el tmpfs del sistema para vídeos completos. La ruta por
defecto es `backend/tmp/orange-photos-video-work/` y puede sobrescribirse con
`ORANGE_PHOTOS_VIDEO_WORK_DIR`. El mismo workspace se utiliza para nuevas
subidas y reconciliación; el original continúa en Wasabi y se conserva
inmutable. Los workspaces se eliminan al finalizar normalmente la operación.

### Estrategia de reproducción

* timeline/grid: `thumbnail`;
* estado inicial de vídeo: `poster`;
* preview corto: `preview`;
* reproducción normal: `playback`;
* descarga original: `original`.

Android y web consumirán la misma variante `playback`; no existe una variante
específica para Android.

## Cola de procesamiento de vídeo

La política de subida del usuario se aplica antes de la cola.

Políticas Android: `WIFI_ONLY`, `MOBILE_UP_TO_800_MB` y `ANY_NETWORK`.
Una vez aceptada la subida, el original se almacena y registra, el vídeo queda
disponible independientemente del playback y los derivados pesados se encolan.

La prioridad es 100 para vídeo nuevo y 10 para reconciliación histórica. La
concurrencia de procesamiento pesado es 1 mediante advisory lock. El histórico
no bloquea a los nuevos vídeos más allá del vídeo histórico que ya estuviera en
proceso, y FFmpeg no se interrumpe a mitad de archivo.

Si un mismo vídeo vuelve a encolarse, prevalecen el origen, la prioridad y las
opciones del trabajo de mayor prioridad; una reconciliación histórica nunca
degrada un trabajo de vídeo nuevo.

La concurrencia 1 protege el pipeline automático de procesamiento de
derivados/playback. Las operaciones manuales específicas de mantenimiento,
como la sustitución explícita de un póster, mantienen su flujo existente.

Las fotografías no utilizan esta cola. El workspace continúa siendo
`backend/tmp/orange-photos-video-work/` y el original permanece inmutable en
Wasabi. La tabla `orange_photo_video_jobs` es el estado operativo persistente y
permite recuperar jobs tras reinicios. El backfill histórico es una operación
extraordinaria; una vez completados los derivados históricos, el funcionamiento
ordinario contendrá fundamentalmente vídeos nuevos.

# Estructura en Wasabi

Los objetos se almacenan bajo el prefijo propio de Orange Photos y separados por variante.

Estructura conceptual:

```text
orange-photos/
├── originals/
├── thumbnails/
├── previews/
├── posters/
└── playbacks/
```

La estructura física puede incluir:

* familia;
* año;
* mes;
* identificadores únicos.

Los derivados pueden incluir `photo_id` y el nombre de la variante dentro del nombre físico para facilitar diagnóstico.

Ejemplo conceptual:

```text
<photo_id>_thumbnail_<uuid>.jpg
<photo_id>_preview_<uuid>.jpg
```

Esta nomenclatura es únicamente informativa.

PostgreSQL continúa siendo la fuente de verdad.

---

# Registro en PostgreSQL

Cada objeto almacenado debe disponer de un registro en:

```text
orange_photo_files
```

Incluyendo, cuando corresponda:

* `family_id`;
* `photo_id`;
* `variant`;
* `provider`;
* `bucket`;
* `object_key`;
* `mime_type`;
* `width`;
* `height`;
* `size_bytes`;
* `checksum_sha256`;
* `etag`.

Debe existir como máximo una variante activa de cada tipo para un mismo `photo_id`, según las restricciones actuales del modelo.

---

# Generación

La generación de derivados pertenece a Node.

Flujo general:

```text
cliente
  ↓
original
  ↓
Node
  ↓
PostgreSQL + Wasabi
  ↓
derivados
```

El origen de la subida no altera este comportamiento.

Debe funcionar igual para:

* subida web;
* subida Android;
* procesos de reconstrucción;
* futuras integraciones.

Los clientes no deben implementar algoritmos propios de generación.

---

# Procesamiento de nuevas imágenes

Una vez registrada correctamente una nueva imagen, Node podrá generar:

```text
thumbnail
preview
```

La creación de derivados no debe poner en riesgo la conservación del original.

Si falla el procesamiento:

* el original debe permanecer registrado;
* el fallo debe poder reintentarse;
* no deben generarse registros PostgreSQL de derivados inexistentes;
* cualquier objeto físico subido pero no registrado debe identificarse como posible huérfano.

---

# Reconstrucción histórica

Las fotografías existentes sin derivados se procesarán mediante un proceso batch específico.

El proceso deberá ser:

* reanudable;
* idempotente;
* ejecutable por lotes;
* capaz de omitir variantes existentes;
* capaz de continuar cuando falla un elemento;
* compatible con dry-run;
* limitado en concurrencia.

No se utilizará una migración SQL para transformar físicamente archivos multimedia.

---

# Idempotencia

La generación debe comprobar las variantes ya registradas.

Si existen:

```text
photo_id + thumbnail
photo_id + preview
```

no deben volver a generarse salvo una operación explícita futura de regeneración.

La ejecución repetida de procesos de reconciliación no debe duplicar variantes.

---

# Fallos y objetos huérfanos

La creación física en Wasabi y el registro en PostgreSQL no forman una transacción distribuida.

Puede producirse el caso:

```text
subida Wasabi correcta
+
registro PostgreSQL fallido
```

En ese escenario:

* realizar rollback de PostgreSQL;
* conservar información sobre las claves físicas afectadas;
* marcarlas como posibles objetos huérfanos;
* no asumir que la operación se completó correctamente.

No eliminar automáticamente un objeto potencialmente válido durante una operación incierta.

---

# Borrado definitivo

El borrado definitivo pertenece a Node.

Nunca debe basarse en:

* nombres de archivos;
* prefijos inferidos;
* sustituciones como `_thumbnail`;
* supuestos sobre las variantes existentes.

Node debe consultar todos los registros de:

```text
orange_photo_files
```

asociados al `photo_id`.

Después debe eliminar los objetos físicos registrados.

Esto debe cubrir automáticamente:

```text
original
thumbnail
preview
poster
playback
cualquier variante futura registrada
```

De esta forma la misma lógica funciona para llamadas procedentes de:

* web;
* Android;
* futuros clientes.

Mover a papelera no elimina objetos físicos.

Solo el purge definitivo elimina archivos de Wasabi.

---

# Uso de variantes por los clientes

## Timeline y cuadrículas

Preferencia:

```text
thumbnail
```

No debe descargarse automáticamente el original cuando exista un thumbnail válido.

---

## Lightbox y visor ordinario

Preferencia:

```text
preview
```

El original debe reservarse para:

* descarga explícita;
* necesidad de calidad máxima;
* operaciones futuras que lo requieran.

---

## Vídeo en timeline

Preferencia:

```text
thumbnail
```

No utilizar automáticamente:

```text
original
preview de vídeo
```

durante el scroll normal.

---

# Compatibilidad durante la transición

Existirán temporalmente elementos históricos sin derivados.

Durante ese periodo:

* la web puede mantener fallbacks controlados al recurso actualmente disponible;
* Android debe evitar descargar automáticamente originales grandes únicamente para representar grids;
* los procesos de reconstrucción irán completando progresivamente las variantes.

La ausencia de un derivado no debe interpretarse como ausencia del elemento original.

---

### Reconstrucción histórica de vídeo

El reconciliador existente `backend/scripts/reconcile-orange-photos-videos.js`
puede completar de forma idempotente metadatos, poster, thumbnail, preview y
playback. Playback existente nunca se regenera; solo se crea cuando falta.

El modo por defecto es dry-run mediante `ORANGE_PHOTOS_VIDEO_DRY_RUN` y admite
`ORANGE_PHOTOS_VIDEO_LIMIT` y `ORANGE_PHOTOS_VIDEO_CONCURRENCY`, con concurrencia
máxima 4. Un fallo individual no detiene el lote y se genera un informe JSON.
La conversión física no se realiza mediante migración SQL.

# Descargas

Las descargas deben distinguir explícitamente entre calidad original y optimizada.

Intenciones previstas:

```text
Descargar original
Descargar copia optimizada
```

## Original

Entrega:

```text
original
```

Debe conservar:

* nombre original cuando corresponda;
* calidad original.

---

## Copia optimizada

Para fotografías:

```text
preview
```

Para vídeos:

```text
playback
```

`playback` es la copia optimizada; `original` sigue siendo la descarga en
calidad original. La UI todavía no expone necesariamente ambas opciones; esta
sección define el contrato de variante, no el estado de la UI.

---

## Preferencias de cliente

Una futura configuración podrá permitir:

```text
Preguntar siempre
Optimizada
Original
```

La preferencia no debe hacer que una acción denominada explícitamente “Descargar original” entregue silenciosamente un derivado.

---

# Web

La optimización de la aplicación web no es requisito para introducir la infraestructura de derivados.

La web podrá adoptar progresivamente:

```text
timeline → thumbnail
lightbox → preview
descarga → original
```

No es necesario modificar toda la interfaz web durante la primera fase.

---

# Android

La futura vista Nube de Android utilizará la misma API Node.

Uso previsto:

```text
timeline → thumbnail
álbumes → thumbnail
visor → preview
descarga original → original

Vídeos:

timeline/grid → thumbnail
estado inicial → poster
preview corto → preview
reproducción ordinaria → playback
descarga original → original
```

Android y web comparten `playback`; no existe playback específico para Android.

El motor actual de archivos locales y sincronización Android permanece independiente.

La introducción de derivados no debe modificar la lógica actual de:

* MediaStore;
* Room;
* WorkManager;
* detección local;
* modos de sincronización;
* identificación de elementos subidos.

---

## Contrato API de variantes

La API expone las variantes mediante URLs firmadas por el mismo mecanismo para
web y Android.

Imágenes:

```text
thumbnail_url
preview_url
original_url
```

Vídeos:

```text
thumbnail_url
poster_url
video_preview_url
video_playback_url
original_url
```

`video_preview_url` es el clip corto de 3 segundos. `video_playback_url` es el
vídeo completo optimizado. Si no existe playback, `video_playback_url` es
`null`, sin fallback automático a `original_url`; `original_url` sigue siendo
el original. Playback está implementado para nuevas subidas y el reconciliador
puede generarlo para históricos.

# Alcance inicial

Primera implantación:

1. soporte de almacenamiento para `thumbnail`;
2. procesador común de imágenes;
3. `thumbnail` de 480 px;
4. `preview` de 1920 px;
5. hashes independientes;
6. registro en `orange_photo_files`;
7. generación automática para nuevas imágenes;
8. reconstrucción histórica;
9. thumbnails de vídeo desde posters existentes;
10. exposición eficiente mediante API;
11. consumo desde Android Nube.

Fuera de esta primera implantación:

* transcodificación completa histórica de todos los vídeos;
* ejecutar el backfill histórico en producción;
* consumo web y Android;
* streaming y visor Android;
* rediseño completo de la web;
* sincronización bidireccional;
* mezcla del repositorio local Android y la biblioteca remota.

---

# Decisiones consolidadas

Se consideran decisiones de arquitectura de Orange Photos:

* el original es inmutable;
* Node es responsable de derivados;
* web y Android comparten exactamente la misma API;
* PostgreSQL es la fuente de verdad;
* Wasabi es almacenamiento físico;
* `photo_id + variant` define la relación entre archivos;
* cada archivo tiene su propio SHA-256;
* la deduplicación utiliza el hash del original;
* los nombres físicos no tienen significado funcional;
* el purge elimina todos los objetos registrados;
* timeline utiliza thumbnails;
* visor ordinario utiliza previews;
* la descarga original continúa disponible;
* los derivados deben poder reconstruirse;
* las nuevas variantes futuras deben integrarse sin modificar la lógica de los clientes.
