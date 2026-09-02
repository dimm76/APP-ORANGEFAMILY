Crear el archivo con este contenido completo:

# Estado de implementación de Orange Photos

## Propósito

Orange Photos es el sistema privado de OrangeFamily para almacenar, organizar,
consultar y compartir fotografías y vídeos dentro de una familia.

La implementación actual se compone de:

- una aplicación web React;
- una API Node compartida por todos los clientes;
- PostgreSQL como registro oficial;
- Wasabi como almacenamiento de originales y derivados;
- una aplicación Android privada para gestionar archivos locales y realizar
  copias automáticas.

La aplicación web y Android utilizan la misma API Node.

Ningún cliente accede directamente a PostgreSQL ni a Wasabi.

---

# Arquitectura

```text
Aplicación web React
                    \
                     → API Node → PostgreSQL
                    /           → Wasabi
Aplicación Android
Aplicación web

React gestiona:

navegación;
biblioteca;
filtros;
selección;
visor;
álbumes;
compartición;
subida;
cola de subida;
progreso;
papelera;
trazabilidad visible;
llamadas a la API.
Aplicación Android

Android gestiona:

autenticación;
sesión local protegida;
acceso a MediaStore;
inventario Room;
gestión de archivos del dispositivo;
detección automática de Cámara;
cola local;
políticas de red;
subida manual;
subida automática;
multipart reanudable;
papelera MediaStore;
notificaciones.
Backend Node

Node gestiona:

autenticación;
autorización;
resolución del propietario;
validaciones;
ownership;
permisos familiares;
visibilidad;
comparticiones;
álbumes;
comprobación de duplicados;
supresiones;
sesiones multipart;
firma temporal de partes;
registro PostgreSQL;
acceso a Wasabi;
generación de derivados;
trazabilidad.
PostgreSQL

PostgreSQL es la fuente de verdad oficial.

Conserva:

fotografías y vídeos;
propietarios;
relaciones familiares;
archivos y variantes;
comparticiones;
álbumes;
sesiones de subida;
supresiones;
eventos.

Room e IndexedDB son memorias operativas locales y no sustituyen al registro
remoto.

Wasabi

Wasabi conserva:

originales;
thumbnails;
previews;
posters;
partes temporales de sesiones multipart.

Las credenciales de Wasabi permanecen exclusivamente en el backend.

Propiedad y privacidad

`orange_photos` representa el asset físico y conserva `owner_user_id` como
procedencia/origen original. `orange_photo_library_items` representa las copias
lógicas propias y contiene el ownership operativo de cada copia.

Una misma fotografía o vídeo puede tener varias copias lógicas de distintos
usuarios sin duplicar necesariamente el asset físico ni los objetos de Wasabi.
El propietario original se obtiene de la sesión autenticada que originó la
subida, mientras que el propietario operativo se obtiene de la copia lógica
efectiva.

Por defecto:

la copia inicial pertenece al usuario que realiza la subida;
la visibilidad inicial es private;
pertenecer a la misma familia no concede acceso automático;
compartir es una acción explícita;
compartir no crea ownership automáticamente.

`is_original_owner` identifica al usuario que originó/subió el asset e
`is_owner` al propietario de la copia lógica efectiva. `owned` y `library` son
ambos ownership lógico del usuario actual; `direct` y `album` son fuentes de
acceso recibido. «Añadir a mi biblioteca» crea una copia lógica propia sin
duplicar el archivo físico.

La comprobación exacta de duplicados está aislada por:

familia;
propietario;
checksum SHA-256.

Una coincidencia con contenido privado de otro usuario no revela:

que el contenido existe;
quién es su propietario;
sus metadatos;
su identificador.

El preflight de duplicados sigue aislado por familia, propietario y checksum, y
no revela contenido privado de otros usuarios. Una subida independiente de otro
usuario no se deduplica revelando existencia ajena; una foto recibida que se
añade a la biblioteca reutiliza el mismo asset físico mediante una nueva copia
lógica.

### Actualización entre dispositivos

Orange Photos puede ser modificado desde la web y Android utilizando la misma
API. La webapp refresca los álbumes, el detalle de álbum y «Compartidas
conmigo» al recuperar el foco de la ventana o cuando la pestaña vuelve a estar
visible.

No existe polling periódico ni WebSocket/SSE. Las modificaciones realizadas
desde otro dispositivo mientras una pestaña permanece continuamente visible y
enfocada no se reflejan en tiempo real.

#### Pendiente técnico

Si en el futuro se necesita sincronización instantánea entre dispositivos,
deberá diseñarse expresamente un mecanismo de invalidación/realtime. No debe
resolverse añadiendo polling agresivo sin revisar previamente su impacto y la
arquitectura.

Aplicación web
Biblioteca

La web es el gestor y visor principal de Orange Photos.

La entrada principal de Fotos se denomina «Galería» en la navegación. Galería
y Compartidas conmigo disponen de un menú de Opciones centrado. Compartidas
conmigo reúne contenido recibido directamente y mediante álbumes compartidos;
por defecto también muestra los elementos recibidos que ya se hayan integrado
en la biblioteca propia. La opción «Mostrar elementos ya integrados en mi
biblioteca» permite ocultarlos. Ocultarlos no elimina ni modifica ninguna copia
lógica: es únicamente un filtro de consulta.

La biblioteca permite:

consultar fotos y vídeos;
filtrar por tipo;
ver todos los elementos accesibles;
ver contenido propio;
ver contenido compartido conmigo;
ver contenido compartido por mí;
distinguir contenido propio compartido y contenido recibido;
cargar resultados mediante paginación;
navegar hacia fechas antiguas y nuevas;
conservar la posición de scroll;
seleccionar elementos individuales;
seleccionar rangos con Shift;
seleccionar los elementos cargados con Ctrl+A o Cmd+A;
limpiar la selección con Escape;
seleccionar por día;
conservar la intención de selección al cargar más elementos;
abrir el visor;
consultar metadatos;
consultar la trazabilidad cuando el usuario es propietario;
descargar originales;
descargar varios elementos;
mover a la papelera;
restaurar;
eliminar definitivamente.

La vista Compartidas conmigo excluye los elementos propios aunque estén
compartidos.

Álbumes usa el menú «Opciones» para sus ajustes de visualización; dentro de un
álbum, «Ajustes de visualización» abre el mismo panel. El contexto de un álbum
integra por defecto todos los elementos accesibles y permite refinar Origen
entre «Mis elementos» y «Añadidos a mi biblioteca». Los elementos de otros
usuarios aún no integrados también son visibles por defecto. Compartidas
conmigo y los álbumes muestran discretamente el propietario o proveedor de
cada elemento, y el icono de álbum compartido informa mediante tooltip de quién
lo comparte o proporciona.

En la vista de álbumes, el origen inicial incluye «Mis elementos» y «Añadidos
a mi biblioteca»; el filtro conserva esa selección al pasar de la lista al
interior del álbum y permite refinarla sin mostrar elementos directos o de
álbum como opciones independientes. La ocultación personal no está disponible
en álbumes.

En «Compartidas conmigo», cada usuario puede ocultar o mostrar personalmente
los elementos recibidos. Esta acción no elimina ni revoca la pertenencia o la
compartición; los elementos ocultos pueden recuperarse mediante «Mostrar
elementos ocultos». Solo afecta a esa vista y no modifica Galería ni Álbumes.

Visor

El visor permite:

mostrar fotografías;
reproducir vídeos;
consultar información;
consultar metadatos;
descargar el original;
compartir;
mover a la papelera;
restaurar;
eliminar definitivamente;
generar o recrear el poster de un vídeo;
consultar los eventos del elemento cuando el usuario es propietario.
Descargas

La descarga individual devuelve el original con su nombre original.

La descarga múltiple:

admite hasta 500 elementos;
genera un ZIP en streaming;
valida previamente el acceso a todos los elementos;
no carga todos los originales en memoria;
no genera una copia temporal completa en disco;
sanea los nombres;
evita colisiones de nombres dentro del ZIP.
Papelera

Mover una copia lógica a la papelera:

actualiza PostgreSQL para esa copia;
no elimina el objeto de Wasabi;
no afecta a las copias lógicas de otros usuarios.

Restaurar revierte el estado de papelera.

El purge definitivo:

exige ownership de la copia lógica;
exige que esa copia esté en la papelera;
elimina la copia lógica del usuario;
conserva las demás copias lógicas;
elimina los objetos físicos solo cuando no queda ninguna copia lógica;
conserva una supresión por familia, propietario y checksum.

Si falla la eliminación física, PostgreSQL no debe registrar la operación como
completada.

Subida web
Selección previa

Antes de iniciar una subida, el usuario puede:

arrastrar archivos;
seleccionar archivos;
acumular varias selecciones;
retirar archivos;
consultar incompatibilidades;
consultar duplicados dentro de la selección.

La subida no comienza hasta pulsar Iniciar subida.

El máximo es de 500 elementos por selección.

Límites

Límites actuales:

imágenes: 30 MB;
vídeos: 10 GB;
tamaño de parte multipart: 25 MB;
máximo de archivos transfiriéndose simultáneamente: 3;
máximo de partes simultáneas por archivo: 2;
para archivos de 1 GB o más: 1 parte simultánea por archivo.
Multipart web

Todos los originales nuevos subidos desde la web utilizan multipart directo del
navegador a Wasabi.

Node:

autentica;
autoriza;
crea la sesión;
firma temporalmente cada parte;
verifica la subida;
completa el objeto;
registra el resultado.

El navegador nunca recibe credenciales de Wasabi.

Cola persistente

La cola se guarda en IndexedDB.

Para archivos de hasta 100 MB, el navegador intenta conservar el File o Blob
cuando la plataforma permite clonarlo.

Para archivos mayores:

no se persiste el archivo completo;
se conserva la sesión remota;
se conservan las partes confirmadas;
después de cerrar o recargar puede ser necesario seleccionar de nuevo el mismo
archivo;
solo se transfieren las partes ausentes.

La cola admite estados activos, pendientes y terminales.

Una subida activa puede cancelarse. Cuando existe una sesión multipart:

se abortan las transferencias en curso;
se solicita el aborto de la sesión remota;
se elimina la entrada local.

La acción Limpiar elimina únicamente el historial terminal y no elimina
trabajos activos o pendientes.

Las sesiones remotas en proceso se consultan mediante polling. Una sesión
completing o processing no se convierte en missing_file.

Duplicados y supresiones

Antes de subir puede detectarse una coincidencia preventiva por:

nombre normalizado;
tamaño exacto;
misma familia.

La coincidencia exacta se calcula mediante SHA-256.

POST /api/orange-photos/uploads/check puede devolver:

already_owned;
restore_available;
suppressed;
upload_required.

already_owned indica que el propietario ya dispone del contenido.

restore_available indica que existe una copia propia recuperable.

suppressed indica que el propietario eliminó definitivamente el contenido y
que la subida automática debe respetar esa decisión.

upload_required indica que debe crearse una nueva copia.

Una reimportación explícita puede utilizar force_duplicate=true cuando el flujo
lo permite.

Los errores inciertos y DUPLICATE_FILE se reconcilian mediante checksum antes
de retransmitir el archivo.

Álbumes

Los álbumes permiten:

creación;
cambio de nombre;
portada automática;
portada manual;
archivado;
paginación;
añadir contenido;
retirar contenido;
compartir con toda la familia;
compartir con personas concretas;
conceder permiso de solo lectura;
conceder permiso para añadir fotos y vídeos.

La primera imagen puede convertirse automáticamente en portada cuando el álbum
todavía no dispone de una.

El propietario puede elegir como portada una imagen perteneciente al álbum.

Compartir un álbum concede acceso efectivo y reversible a su contenido sin:

cambiar orange_photos.visibility;
crear necesariamente una compartición directa;
duplicar el archivo en Wasabi;
cambiar su propietario lógico.

Los colaboradores:

solo pueden añadir contenido propio;
pueden retirar relaciones creadas por ellos;
no pueden administrar el álbum;
no adquieren ownership lógico de su contenido por colaborar.

### Modelo canónico del permiso de contribución

`orange_photo_albums.allow_contributions` es la fuente canónica del permiso
general para añadir fotos y vídeos a un álbum. Aplica tanto a
`visibility='family'` como a `visibility='selected'`.

`orange_photo_album_access` determina qué usuarios tienen acceso y su estado,
pero no mantiene un permiso de contribución individual.

Para `family_memberships.role='guest'`, el usuario es un miembro de la familia,
accede con `orange_photo_album_access.subject_type='family'` y puede contribuir
únicamente cuando `orange_photo_albums.allow_contributions=true`, manteniendo
las restricciones de aportación de contenido propio.

`orange_photo_album_shares.can_contribute` pertenece al modelo legacy. Se
conserva temporalmente como compatibilidad mientras existan rutas antiguas que
lo escriban, pero no debe considerarse fuente canónica de autorización.

Los invitados externos conservan por ahora sus permisos históricos
`can_contribute` / `can_comment` en `orange_photo_album_guest_invitations` y
`orange_photo_album_guest_grants`. No se eliminan ni se reinterpretan en esta
corrección.

#### Pendiente técnico

- Migrar o eliminar en una fase independiente las rutas legacy que todavía
  dependan de `orange_photo_album_shares`.
- Cuando ya no exista ningún consumidor real, retirar el dual-write de
  `orange_photo_album_shares.can_contribute`.
- Solo después, mediante migración específica y verificada, valorar eliminar
  esa columna.
- Revisar en una fase independiente la convivencia entre el modelo unificado y
  los permisos históricos de invitados externos antes de retirar cualquier
  campo de guest invitations/grants.
- La ruta legacy `shareAlbum()` sigue formando parte de la compatibilidad y la
  migración completa de destinatarios hacia `orange_photo_album_access` queda
  fuera de esta corrección.
- Los álbumes existentes cuyo `allow_contributions` haya quedado en false por
  operaciones anteriores no deben corregirse automáticamente si no puede
  reconstruirse con certeza la intención del propietario. Tras desplegar esta
  corrección se deberán volver a guardar manualmente los permisos de los
  álbumes afectados.

El propietario puede retirar cualquier elemento.

Siguen aplazados:

comentarios;
likes;
actividad persistida completa;
presentación;
enlace público;
descarga completa del álbum.
Procesamiento multimedia

Exposición eficiente mediante API

La fase de exposición eficiente mediante API está implementada. La API expone
por separado las variantes:

- `thumbnail_url`;
- `preview_url`;
- `poster_url`;
- `video_preview_url`;
- `original_url`.

El consumo actual es:

- timeline y cuadrículas: `thumbnail`;
- portadas de álbum: `thumbnail`, con fallback controlado;
- visor de imágenes: `preview`;
- descarga explícita: `original`;
- vídeo en timeline: `thumbnail` o `poster`.

El playback queda como futura variante pendiente.

Fotografías

El original se conserva intacto.

Las fotografías pueden disponer de derivados registrados en
`orange_photo_files`.

El contrato normativo de variantes, hashes, almacenamiento, generación,
consumo y borrado se documenta en
[`MEDIA_DERIVATIVES.md`](./MEDIA_DERIVATIVES.md).

Actualmente está implementada la infraestructura backend para generar:

- `thumbnail`: lado máximo de 480 px;
- `preview`: lado máximo de 1920 px.

Los derivados nunca sustituyen al original.

La relación canónica entre original y derivados se establece mediante
`photo_id + variant`.

Cada archivo conserva su propio checksum SHA-256. La deduplicación continúa
utilizando exclusivamente el checksum del original.

Los derivados conservan PNG o WebP cuando corresponde; JPEG y HEIC generan
derivados JPEG. No se amplían imágenes cuya resolución ya sea inferior al
tamaño objetivo.

La orientación visual se aplica durante la generación y los derivados no
conservan metadatos EXIF.

La generación automática de `thumbnail` y `preview` está activada para las
nuevas imágenes registradas mediante la subida estándar y mediante el flujo
multipart compartido por web y Android.

Los fallos al generar derivados no invalidan el original ya registrado.

La reconstrucción de derivados para fotografías históricas se realiza mediante
el reconciliador específico de imágenes.

La fecha de captura utiliza esta prioridad:

fecha manual;
EXIF DateTimeOriginal o CreateDate;
fecha de modificación proporcionada por el dispositivo;
fecha de subida.
Vídeos

Para un vídeo nuevo:

se almacena el original;
ffprobe obtiene duración y dimensiones;
se genera el poster JPEG;
se genera un thumbnail JPEG de lado máximo 480 px;
cuando ya existe poster, el thumbnail se genera desde el poster sin descargar
el vídeo original únicamente para esa operación;
se genera el preview MP4 corto;
los nuevos vídeos generan sus derivados mediante el procesador backend;
el reconciliador completa los derivados ausentes.

El backfill histórico de vídeo está completado en producción:

- 1788 vídeos totales;
- 1779 con poster;
- 1776 con thumbnail;
- 1777 con preview;
- 12 elementos incompletos conocidos por errores aislados de FFmpeg, ffprobe o
  descarga del original.

Estos 12 elementos incompletos no representan un fallo sistémico.

La fecha de captura utiliza esta prioridad:

fecha manual;
creation_time del contenedor;
fecha de modificación proporcionada por el dispositivo;
fecha de subida.

El propietario puede generar o recrear el poster.

La recreación del poster:

no modifica el original;
no modifica el preview;
conserva el poster anterior si falla antes del commit;
elimina el poster anterior solo después de confirmar el nuevo.
Trazabilidad

orange_photo_events conserva eventos relevantes del ciclo de vida.

Puede registrar:

subida;
decisión de duplicado;
supresión;
descarga completada;
compartición;
retirada de compartición;
papelera;
restauración;
purge;
cambios de metadatos;
incorporación o retirada de álbumes.

Los eventos pueden identificar:

familia;
fotografía o vídeo;
propietario original;
`copy_owner_user_id`, que delimita el historial de cada copia lógica;
actor;
tipo de cliente;
instalación Android;
datos específicos del evento.

No se registran como actividad funcional:

solicitudes de thumbnail;
solicitudes de preview;
generación de URL firmada;
apertura del detalle;
apertura del timeline;
visualizaciones;
accesos públicos.

En la web, la trazabilidad de un elemento solo es visible para su propietario.

Android envía:

x-orange-client: android_sync
x-orange-installation-id: <UUID local>
Aplicación Android
Alcance

La aplicación Android es una APK privada.

Su función es:

gestionar archivos locales del dispositivo;
detectar fotografías y vídeos nuevos;
realizar copias automáticas;
permitir subidas manuales;
mostrar el estado local y remoto;
utilizar la misma API Node que la web.

No es una aplicación Android completa de OrangeFamily.

Tecnología
Kotlin nativo;
Jetpack Compose;
AndroidX Room;
MediaStore;
WorkManager;
ContentObserver;
ConnectivityManager;
Android Keystore.
Identidad

El identificador de cuenta es:

auth_users.id

Android lo utiliza como:

accountUserId

No debe confundirse con person.id.

Cada cuenta dispone de:

configuración propia;
línea base propia;
inventario propio;
cola propia;
política de red propia.

La instalación se identifica mediante un UUID aleatorio persistido localmente.

No se utilizan:

IMEI;
Android ID;
número de serie;
identificadores físicos del dispositivo.
Autenticación

La aplicación:

inicia sesión mediante la API Node;
conserva la cookie de sesión;
protege la sesión mediante Android Keystore;
valida la sesión mediante /api/auth/me;
restaura la sesión;
elimina la sesión local al cerrar sesión;
invalida la sesión si cambia el entorno configurado.

No almacena:

contraseña;
token en texto plano;
credenciales PostgreSQL;
credenciales Wasabi.
Inventario Room

La base local es:

orange_photos_local.db

Room es memoria operativa local. PostgreSQL sigue siendo el registro oficial.

La identidad lógica de un archivo combina:

accountUserId
+ mediaCollection
+ mediaType
+ mediaStoreId

Estados locales implementados:

discovered;
pending;
uploading;
uploaded;
failed;
suppressed;
restore_available.

El inventario también puede conservar:

content URI;
nombre;
MIME;
tamaño;
fecha de alta;
fecha de captura;
ruta relativa;
dimensiones;
duración;
checksum SHA-256;
identificador remoto;
estado remoto;
código de error;
fecha de intento;
fecha de verificación;
información multipart.
Archivos del dispositivo

La pantalla de archivos del dispositivo utiliza MediaStore.

Permite:

navegar por carpetas;
mostrar fotos y vídeos;
cargar páginas de 200 elementos;
mostrar miniaturas;
seleccionar elementos;
seleccionar rangos;
seleccionar pendientes;
verificar el estado remoto;
subir manualmente;
reintentar fallos;
borrar localmente;
abrir la papelera;
restaurar;
eliminar definitivamente del dispositivo.

Eliminar un archivo del móvil no elimina:

el registro PostgreSQL;
el original de Wasabi;
sus derivados remotos.

En Android 11 o superior, la eliminación local desde una biblioteca mueve el
contenido a la papelera recuperable de MediaStore.

En Android 8, 9 y 10, OrangeFamily no permite eliminar archivos locales desde
una biblioteca porque no existe la papelera MediaStore utilizada por la
aplicación.

La eliminación definitiva local solo puede realizarse desde una papelera
compatible y mediante una acción explícita del usuario.

Activación del backup

La primera activación:

comprueba acceso completo a fotos y vídeos;
identifica al usuario autenticado;
enumera los volúmenes disponibles;
crea una línea base para imágenes;
crea una línea base para vídeos;
guarda la configuración;
no importa el histórico.

La carpeta automática observada es:

DCIM/Camera/

No entran automáticamente:

Screenshots;
Downloads;
WhatsApp;
Telegram;
otras carpetas;
contenido anterior a la activación.
Línea base

La línea base está separada por:

cuenta;
volumen;
tipo multimedia.

Utiliza el par ordenado:

DATE_ADDED
MediaStore ID

Un elemento es posterior cuando:

DATE_ADDED > baselineDate

o:

DATE_ADDED = baselineDate
AND MediaStore ID > baselineId

La inserción de nuevos elementos y el avance de la línea base se realizan dentro
de la misma transacción Room.

Promoción de discovered a pending

El navegador local de archivos puede haber registrado previamente un elemento
como discovered.

Cuando el escáner automático detecta ese mismo elemento:

no intenta duplicarlo;
lo promociona a pending;
limpia failure_code;
actualiza detected_at;
incluye la promoción en el contador imported.

La promoción solo afecta a discovered.

No modifica elementos que estén en:

pending;
uploading;
uploaded;
failed;
suppressed;
restore_available.
Detección automática

El ContentObserver pertenece a OrangePhotosSyncApplication.

Observa:

imágenes;
vídeos.

Agrupa cambios durante 1,5 segundos.

Después agenda:

orange_photos_media_change_<userId>

Cada worker vuelve a analizar MediaStore antes de seleccionar la cola.

Esto garantiza que el evento del sistema no sea la única fuente de información.

WorkManager

Existen trabajos únicos separados para:

sincronización inmediata;
cambios de MediaStore;
espera de red no medida;
mantenimiento periódico.

El worker:

valida la cuenta;
adquiere el lock;
analiza MediaStore;
registra elementos nuevos;
recupera estados interrumpidos;
selecciona el lote;
aplica la política de red;
calcula checksum;
ejecuta el preflight;
sube o reconcilia;
actualiza Room;
libera el lock.
Lock

El lock evita que dos workers procesen simultáneamente la misma cola.

Cuando un worker encuentra un lock activo válido:

no procesa la cola;
no modifica estados;
termina con resultado correcto;
no solicita otro reintento.

El worker que posee el lock continúa normalmente.

Políticas de red

La política se guarda por cuenta y parte de:

WIFI_ONLY
Económico
WIFI_ONLY
detecta e importa archivos sin Wi-Fi;
deja los archivos en pending;
solo los transfiere mediante una red no medida;
reactiva la cola cuando aparece Wi-Fi.
Intermedio
MOBILE_UP_TO_800_MB
permite red medida para archivos de hasta 800 MB;
los archivos mayores permanecen pendientes hasta Wi-Fi.
Extremo
ANY_NETWORK
permite cualquier tamaño admitido;
utiliza cualquier red conectada;
no agenda un trabajo exclusivo para Wi-Fi.

El worker utiliza:

NET_CAPABILITY_NOT_METERED

para determinar si la red es no medida.

Reactivación al conectar Wi-Fi

ConnectivityManager.NetworkCallback detecta la aparición de redes no medidas.

La aplicación conserva un conjunto sincronizado de redes no medidas activas.

La cola se reactiva únicamente cuando el conjunto pasa de:

0 redes no medidas

a:

1 o más redes no medidas

Los avisos repetidos de Android sobre la misma Wi-Fi no vuelven a programar el
worker.

onLost elimina la red perdida del conjunto, permitiendo que una reconexión
posterior vuelva a activar la cola.

Subida Android

Android calcula SHA-256 sobre el original y llama al preflight del backend.

Respeta literalmente el modo devuelto por Node:

simple;
direct_backend;
multipart.

Los logs de diagnóstico incluyen:

identificador local;
nombre;
tamaño real;
MIME;
existencia y longitud del checksum;
decisión del preflight;
modo de subida.
Multipart Android

Cuando Node devuelve multipart, Android utiliza la misma API reanudable que la
web.

Room conserva:

identificador remoto de sesión;
client_upload_key;
tamaño de parte;
total de partes;
caducidad;
ETag de cada parte confirmada.

Antes de reanudar:

consulta el estado remoto;
considera al servidor fuente de verdad;
conserva las partes remotas válidas;
envía únicamente las partes ausentes;
completa la sesión;
limpia el estado local multipart después de la confirmación.

La migración Room 4→5 crea las tablas multipart sin borrar:

inventario;
configuración;
cola;
estados existentes.
Estado confirmado en dispositivo físico

Se ha validado:

instalación de la APK release;
coincidencia SHA-256 entre la APK instalada y la APK generada;
detección de fotos nuevas;
detección de vídeos nuevos;
ausencia de importación histórica;
prevención de duplicados locales;
persistencia del inventario;
promoción discovered → pending;
subida simple;
subida de varias fotos;
subida de fotos y vídeo en el mismo lote;
modo económico sin Wi-Fi;
reactivación inmediata al conectar Wi-Fi;
modo intermedio mediante red móvil;
modo extremo mediante red móvil;
decisión multipart para un vídeo de 865047797 bytes;
finalización de esa subida multipart;
cola vacía después de completar;
exclusión de workers secundarios mediante el lock;
ausencia de reprogramación repetida por avisos de la misma Wi-Fi.

Permanece pendiente de validación física específica:

interrumpir una subida multipart después de confirmar varias partes;
verificar que la reanudación transmite únicamente las partes ausentes.
Release Android
Datos actuales
Application ID: com.orangefamily.photossync
versionCode: 3
versionName: 1.1.0
API: https://family.orangedesk.net/

La URL no debe incluir /api/.

La misma APK sirve para todos los familiares. Cada usuario inicia sesión con sus
propias credenciales.

Generación

Desde:

mobile/orange-photos-sync-agent

Ejecutar:

.\gradlew.bat clean assembleRelease --no-configuration-cache

La APK resultante se encuentra en:

mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk

El archivo distribuible es:

app-release.apk

No debe distribuirse ni versionarse:

mobile\orange-photos-sync-agent\orangefamily-installed.apk

Ese archivo se utilizó únicamente para comprobar la APK instalada.

Firma

Las actualizaciones deben conservar:

applicationId;
keystore;
alias;
firma.

También deben aumentar versionCode.

Instalar una actualización release encima conserva:

sesión;
Room;
preferencias;
inventario;
cola.

Los vídeos pueden disponer de thumbnail JPEG de máximo 480 px; los vídeos con poster existente generan el thumbnail desde el poster sin descargar ni transcodificar el original únicamente para ello; los vídeos históricos completan thumbnails mediante el reconciliador; la timeline/grid web prioriza thumbnail y utiliza poster como fallback.
