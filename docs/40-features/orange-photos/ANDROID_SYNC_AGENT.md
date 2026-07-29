# Agente Android de sincronización de Orange Photos

## Propósito

El agente Android es una APK privada cuya función es detectar y subir automáticamente a OrangeFamily las fotos y los vídeos nuevos del dispositivo.

La aplicación web continúa siendo el gestor y visor principal de Orange Photos.

El agente no es, inicialmente, una versión móvil completa de OrangeFamily ni una galería alternativa. Su responsabilidad principal es actuar como capa de sincronización entre el dispositivo Android y la API Node de OrangeFamily.

## Ubicación y tecnología

- Proyecto: `mobile/orange-photos-sync-agent`.
- Implementación: Kotlin nativo.
- Interfaz mínima: Jetpack Compose.
- Persistencia local: AndroidX Room.
- Acceso multimedia: Android MediaStore.

## Arquitectura

```text
Android MediaStore
  → inventario local persistente
  → futura cola de sincronización
  → futura ejecución mediante WorkManager
  → API Node de OrangeFamily
  → PostgreSQL y Wasabi

Android nunca accede directamente a PostgreSQL ni a Wasabi.

Node mantiene:

autenticación;
autorización;
resolución del propietario;
validaciones;
permisos;
lógica de negocio;
acceso a PostgreSQL;
acceso a Wasabi;
control de visibilidad;
comparticiones;
comprobación remota de duplicados.
Principio de propiedad y privacidad

Orange Photos no es una biblioteca visible automáticamente para toda la familia.

Cada fotografía o vídeo tiene un propietario.

Por defecto:

el propietario es el usuario autenticado que realiza la subida;
la visibilidad es private;
otros miembros de la familia no pueden ver el elemento;
compartir es una acción posterior y explícita.

La pertenencia a una familia delimita el dominio y permite comparticiones internas, pero no concede acceso automático al contenido privado de los demás miembros.

Ejemplo:

Foto subida desde el móvil de Claudia

Familia: Familia Medina
Propietaria: Claudia
Visibilidad: private
Visible para Diego: no
Visible para Sara: no

Si Claudia decide compartirla con Diego, la propiedad no cambia:

Propietaria: Claudia
Compartida con: Diego
Permiso: acceso explícito
Identidad utilizada por el agente

El agente utiliza como identificador estable de cuenta:

auth_users.id

Este valor se obtiene de:

GET /api/auth/me

En Android se utiliza como:

accountUserId

No debe confundirse con person.id.

El inventario local queda aislado mediante accountUserId, de forma que:

cada miembro tiene su propia activación;
cada miembro tiene sus propias líneas base;
cada miembro tiene su propio inventario;
un usuario no puede ver ni procesar el inventario local de otro;
el cambio de sesión no mezcla estados ni elementos pendientes.
API compartida

El agente utiliza la misma API Node que la aplicación web.

No se crearán APIs específicas para Android salvo que una necesidad funcional real requiera ampliar el contrato compartido para todos los clientes.

La autenticación reutiliza:

POST /api/auth/login;
GET /api/auth/me;
POST /api/auth/logout.

El agente nunca envía libremente el propietario de una foto.

En una futura subida, Node deberá obtener el propietario a partir de la sesión autenticada.

Autenticación y sesión

La autenticación ya está implementada.

El agente:

inicia sesión mediante la API Node;
conserva la cookie de sesión;
protege la sesión mediante Android Keystore;
restaura la sesión al abrir la aplicación;
valida la sesión mediante /api/auth/me;
elimina la sesión local al cerrar sesión;
invalida la sesión si cambia el host o entorno configurado.

No se almacena:

contraseña;
token en texto plano;
credenciales de PostgreSQL;
credenciales de Wasabi.

Los datos de sesión se excluyen de:

copias de seguridad Android;
transferencias entre dispositivos.
Entornos
Desarrollo: API local.
Emulador Android: 10.0.2.2.
Dispositivo físico: IP LAN del ordenador o adb reverse.
Producción: HTTPS.
HTTP cleartext solo se permite en builds de debug.
La URL de producción debe obtenerse de la configuración real de despliegue.
La URL de producción no debe quedar inventada ni codificada arbitrariamente.
Inventario local

El agente mantiene un inventario local persistente mediante Room.

Este inventario no es el registro oficial de OrangeFamily.

Su finalidad es recordar:

qué elementos ha detectado el dispositivo;
qué usuario los detectó;
qué elementos están pendientes;
qué elementos no deben registrarse dos veces;
desde qué punto comenzó la observación.

La fuente de verdad oficial seguirá siendo PostgreSQL cuando se implemente la subida.

La base local actual es:

orange_photos_local.db

La base está excluida de copias de seguridad y transferencias entre dispositivos porque contiene content URI válidas únicamente en el dispositivo original.

Tablas locales actuales
local_media_items

Registra los elementos nuevos detectados.

Campos funcionales:

usuario autenticado;
volumen o colección MediaStore;
tipo multimedia;
MediaStore ID;
content URI;
nombre visible;
MIME type;
tamaño;
fecha de alta;
fecha de captura, cuando existe;
ruta relativa;
anchura;
altura;
duración para vídeos;
fecha de detección;
estado local.

El único estado actual es:

pending

Todavía no existen:

uploading;
uploaded;
failed;
remotePhotoId;
hash;
intentos de subida.
agent_configs

Mantiene la configuración del agente por usuario:

accountUserId;
fecha de activación;
líneas base resumidas;
último análisis;
estado habilitado.
media_baselines

Mantiene líneas base separadas por:

usuario;
volumen;
tipo multimedia.
Clave única local

Un mismo elemento no puede registrarse dos veces para la misma cuenta.

La clave lógica combina:

accountUserId
+ mediaCollection
+ mediaType
+ mediaStoreId

Esto evita colisiones entre:

usuarios diferentes;
imágenes y vídeos con el mismo ID;
volúmenes distintos;
análisis repetidos.

Las inserciones utilizan una estrategia equivalente a:

INSERT OR IGNORE
Primera activación

Cuando un usuario activa el agente:

se comprueba que existe acceso completo a fotos y vídeos;
se identifica al usuario autenticado;
se enumeran los volúmenes externos disponibles;
se calcula una línea base para imágenes;
se calcula una línea base para vídeos;
se guarda la activación;
no se importa el histórico existente.

Ejemplo:

18:00
El móvil ya contiene 8.000 fotos.

El agente se activa.
Las 8.000 fotos no se registran como pendientes.

18:15
Se crean tres fotos nuevas.

IMG_1001.jpg → pending
IMG_1002.jpg → pending
IMG_1003.jpg → pending

Las fotografías anteriores no entran actualmente en el inventario.

Una futura importación histórica deberá ser:

explícita;
separada de la activación normal;
controlada por el usuario.
Estrategia de línea base

La detección no depende únicamente de la fecha.

Para cada usuario, volumen y tipo multimedia se guarda el mayor par ordenado:

DATE_ADDED
MediaStore ID

Un elemento es posterior a la línea base cuando:

DATE_ADDED > baselineDate

o bien:

DATE_ADDED = baselineDate
AND MediaStore ID > baselineId

El MediaStore ID actúa como desempate porque DATE_ADDED tiene precisión limitada.

La inserción de nuevos elementos y la actualización de la línea base se realizan dentro de una transacción Room.

La línea base solo avanza después de completar correctamente el registro local.

Volúmenes nuevos

Si después de la activación aparece un volumen MediaStore nuevo:

el agente establece primero una línea base propia para ese volumen;
el histórico del nuevo volumen no entra automáticamente como pendiente;
solo se detectan elementos posteriores a esa nueva línea base.

Esto evita importar accidentalmente grandes bibliotecas antiguas al conectar un nuevo volumen.

Carpeta observada

La primera versión observa únicamente la carpeta principal de Cámara.

Android 10 o superior:

RELATIVE_PATH = DCIM/Camera/

Android 9 o inferior:

BUCKET_DISPLAY_NAME = Camera

No se incluyen:

Screenshots;
Downloads;
WhatsApp;
Telegram;
otras carpetas;
contenido histórico anterior a la activación.

No se utilizan rutas físicas absolutas.

El agente trabaja mediante content URI.

Permisos

Android 13 o superior:

READ_MEDIA_IMAGES;
READ_MEDIA_VIDEO.

Android 12 o inferior:

READ_EXTERNAL_STORAGE con maxSdkVersion=32.

Android 14 o superior:

se reconoce READ_MEDIA_VISUAL_USER_SELECTED;
se distingue acceso completo de acceso parcial;
el acceso parcial no se considera suficiente para copiar automáticamente toda la carpeta Cámara.

Con acceso parcial:

el agente no puede activarse;
el agente no puede analizar;
la interfaz informa de que se necesita acceso completo;
se permite revisar los permisos desde Ajustes.

No se solicitan:

permisos de escritura;
MANAGE_EXTERNAL_STORAGE;
acceso a Cámara;
ubicación;
contactos;
permisos no relacionados.
Aislamiento entre usuarios

El logout no elimina el inventario local.

Al cerrar sesión:

los datos permanecen almacenados;
dejan de mostrarse;
dejan de procesarse;
no pueden utilizarse bajo otra cuenta.

Si otro usuario inicia sesión en el mismo dispositivo:

se crea su propia configuración;
se crea su propia línea base;
se consulta únicamente su inventario;
no hereda estados ni asociaciones del usuario anterior.

Los resultados asíncronos se descartan si cambia la cuenta durante una consulta.

Persistencia y pérdida de datos locales

El inventario local sobrevive a:

cierre de la aplicación;
reinicio del dispositivo;
reapertura de la aplicación.

El inventario local puede perderse si:

se desinstala la aplicación;
se borran sus datos;
se restaura el dispositivo;
se sustituye el teléfono.

Esto no debe comprometer la integridad de OrangeFamily.

El inventario local se considera reconstruible.

La futura garantía contra duplicados deberá vivir en el backend y no depender exclusivamente de Room.

No se realizará una copia de seguridad tradicional de la base local.

Eliminación de archivos del móvil

El agente permite gestionar archivos locales desde «Archivos del dispositivo».
En Android 11 o superior, la eliminación normal mueve el contenido a la papelera
recuperable de MediaStore. Desde la pantalla Papelera puede restaurarse o
eliminarse definitivamente con confirmación adicional del sistema. En Android
8, 9 y 10 no existe una papelera MediaStore equivalente y la eliminación local
es definitiva tras advertencia.

En el futuro, si una foto ya está confirmada en OrangeFamily y se elimina del móvil:

En móvil: no
En OrangeFamily: sí

La eliminación local no debe eliminar el registro remoto.

La interfaz distingue los elementos con copia remota confirmada y ofrece limitar
la operación a esos elementos. Ninguna operación local elimina el registro ni el
objeto remoto de OrangeFamily.

Eliminación en OrangeFamily

Si una foto se elimina voluntariamente de OrangeFamily pero continúa en el móvil, el agente no debe volver a subirla automáticamente.

Para evitar un ciclo:

usuario elimina
→ agente vuelve a subir
→ usuario vuelve a eliminar

el backend conserva una supresión vinculada al propietario durante el purge definitivo.

Esa supresión deberá estar asociada a:

familia;
propietario;
contenido;
decisión de eliminación.

No debe aplicarse globalmente a otros miembros.

Ejemplo:

Mismo contenido

Diego:
- eliminado voluntariamente;
- no volver a subir automáticamente.

Claudia:
- activo;
- privado.

Este contrato ya está implementado en el backend; el agente Android todavía no lo consume.

Duplicados y privacidad

La comprobación de duplicados debe respetar la propiedad y privacidad.

El contrato remoto implementado en `POST /api/orange-photos/uploads/check` acepta
un checksum SHA-256 y limita la deduplicación a `family_id` y al
`owner_user_id` autenticado. Devuelve `already_owned`, `restore_available`,
`suppressed` o `upload_required`; `photo_id` solo se incluye para una foto propia.
Una coincidencia cuyo propietario sea otro usuario, aunque la foto esté compartida,
se trata como `upload_required` y no revela metadatos.

El purge definitivo conserva una supresión por familia, propietario y checksum.
Las subidas automáticas del mismo propietario quedan bloqueadas, mientras que una
reimportación explícita con `force_duplicate=true` elimina la supresión tras el alta.

El backend no debe revelar a un miembro que otro miembro posee una fotografía privada con el mismo contenido.

Ejemplo incorrecto:

Esta foto ya existe y pertenece a Claudia.

La deduplicación diferencia:

entidad lógica propiedad de un usuario;
objeto físico almacenado;
permisos de acceso.

El almacenamiento físico permanece independiente por propietario. No se reutilizan
objetos Wasabi entre propietarios.

El mismo contenido no implica necesariamente la misma entidad lógica.

No se debe fusionar automáticamente contenido entre propietarios.

Registro oficial remoto

Cuando se implemente la subida:

PostgreSQL será el registro oficial;
Wasabi conservará el archivo;
Room seguirá siendo la memoria operativa local.

El flujo futuro esperado es:

detected
→ pending
→ checking
→ uploading
→ uploaded

En caso de error:

uploading
→ failed
→ retry_pending
→ uploading
→ uploaded

Un archivo solo podrá marcarse como sincronizado cuando Node confirme:

recepción completa;
almacenamiento correcto;
creación o resolución del registro;
identificador remoto autorizado.

Terminar de enviar bytes no será suficiente.

Dispositivos

El agente está previsto para todos los miembros de la familia.

Cada instalación deberá quedar asociada a:

familia;
usuario propietario;
instalación;
dispositivo;
última actividad.

Todavía no existe un registro remoto de dispositivos.

Será necesario valorar una futura entidad similar a:

family_devices
- id
- family_id
- owner_user_id
- installation_id
- device_name
- platform
- created_at
- last_seen_at
- revoked_at

No debe crearse esta tabla sin revisar previamente el modelo existente y el flujo de registro del dispositivo.

Estado actual

Implementado:

proyecto Android nativo;
build debug;
login;
sesión cifrada;
restauración de sesión;
validación mediante /api/auth/me;
logout;
acceso a MediaStore;
permisos adaptados por versión Android;
detección de acceso parcial;
activación por usuario;
línea base de imágenes y vídeos;
inventario Room persistente;
aislamiento por auth_users.id;
detección manual de nuevos elementos;
prevención de duplicados locales;
contadores de fotos y vídeos pendientes;
persistencia tras reiniciar la aplicación;
SHA-256 de cada original;
comprobación remota de duplicados y supresiones;
subida simple y directa mediante la API Node;
confirmación mediante `remotePhotoId`;
estados `pending`, `uploading`, `uploaded`, `failed`, `suppressed` y `restore_available`;
WorkManager con ejecución inmediata y periódica;
ContentObserver y sincronización automática;
reintentos exponenciales para errores transitorios;
identificador UUID estable de instalación, sin identificadores del dispositivo;
cabeceras `x-orange-client: android_sync` y `x-orange-installation-id`;
notificaciones agrupadas de éxito y elementos sin copia;
trazabilidad remota del origen y del ciclo de vida en `orange_photo_events`.

Validado manualmente en dispositivo físico:

el histórico previo no entra como pendiente;
una foto nueva entra una sola vez;
un segundo análisis no la duplica;
el inventario persiste tras cerrar y abrir la app;
un vídeo nuevo se registra correctamente;
fotos y vídeos se contabilizan por separado.

Todavía no implementado:

presencia actual del archivo en el móvil;
eliminación local;
sincronización bidireccional;
importación histórica;
registro remoto completo de dispositivos;
agente de escritorio y verificación de discos;
galería Android;
telemetría de visualizaciones y accesos públicos.

La instalación se identifica localmente mediante un UUID aleatorio persistido en
preferencias privadas y excluido de backup. Puede cambiar al desinstalar o borrar
datos. No existe todavía una entidad remota de dispositivo.

`orange_photo_events` conserva subidas, decisiones de duplicado/supresión,
descargas completadas, compartición, papelera, restauración, purge, cambios de
metadatos y pertenencia a álbumes. No registra thumbnails, previews, URLs firmadas,
detalle, timeline, vistas ni accesos públicos.

Próximas fases
introducir estados locales de sincronización;
mantener la ejecución manual.
Fase 5: automatización
WorkManager;
restricciones de red;
reintentos;
ejecución tras reinicio;
notificaciones;
control de batería y datos.
Evolución futura
selección de otras carpetas;
importación histórica explícita;
liberación segura de espacio;
estado local/remoto;
inventario de varios dispositivos;
cliente Android más completo;
galería local y nube;
agente de escritorio para verificar copias en discos locales.
Fuera del alcance actual
Galería conjunta local y nube.
Borrado de archivos del móvil.
Sincronización bidireccional.
Edición.
Acceso directo a Wasabi.
Acceso directo a PostgreSQL.
Importación histórica automática.
Compartición desde el agente.
Visualización de fotos privadas de otros miembros.
Ejecución automática en segundo plano.
## Release privada

## Gestión manual de archivos del dispositivo

Tras autenticar, el listado de carpetas es la pantalla principal. El drawer abre
«Ajustes», que conserva el estado, conexión, permisos, estadísticas y controles
del agente automático, o «Papelera». El inventario manual está basado exclusivamente
en MediaStore. Las imágenes y vídeos accesibles se agrupan por volumen y bucket;
Android no recorre rutas físicas, no solicita `MANAGE_EXTERNAL_STORAGE` y no
accede a Wasabi.

Con acceso parcial de Android 14 solo se muestran los elementos autorizados y la
interfaz advierte que el inventario es parcial. La regla de acceso completo del
backup automático no cambia.

La identidad local estable combina `accountUserId`, volumen, tipo y MediaStore ID.
Room conserva hash SHA-256, tamaño, fecha de modificación, estado remoto y
`remotePhotoId`; un cambio de tamaño o fecha invalida la confirmación. La
comprobación se realiza contra PostgreSQL a través de Node, en lotes máximos de
200 y aislados por el propietario autenticado. Solo un hash exacto con original
remoto válido concede `BACKED_UP`; nombre y tamaño conceden como máximo
`POSSIBLE_MATCH`.

La selección usa identificadores estables y admite elementos individuales,
rangos, todos y pendientes. Las subidas manuales entran en la misma tabla Room,
WorkManager, autenticación y worker que el backup automático. El borrado usa
MediaStore y afecta solo al fichero local; nunca elimina PostgreSQL ni Wasabi.
No se inicia un escaneo/hash de todo el dispositivo en segundo plano.

Cuando el worker completa una subida, actualiza en la misma operación Room los
campos `local_status`, `cloud_status=backed_up`, `remotePhotoId`, checksum y fecha
de verificación. El Flow observado por la cuadrícula refleja inmediatamente la
nube confirmada sin exigir una reconciliación manual.

El lock local de sincronización dura 30 minutos. Antes de adquirirlo, el worker
recupera únicamente locks caducados, sin expiración o heredados cuya expiración
supere ese máximo; un lock activo válido provoca un reintento de WorkManager. La
cola mantiene pendientes y fallos reintentables, pero excluye fallos permanentes
sin bloquear elementos posteriores.

La interfaz separa los estados locales `pending`, `uploading`, `failed` y
`uploaded`. Los fallos permanentes no se reintentan automáticamente, pero el
usuario puede seleccionarlos y devolverlos explícitamente a `pending`, limpiando
su código de fallo. El progreso de la ejecución activa se mantiene únicamente en
memoria mediante `StateFlow` y muestra los bytes enviados por el stream HTTP; Room
continúa siendo la fuente persistente. La cabecera permite consultar actividad,
pendientes y resultados sin iniciar otra subida al tocar el indicador.

La política de red se guarda por usuario en preferencias privadas y parte de
`WIFI_ONLY`. El worker decide por archivo usando la capacidad Android
`NET_CAPABILITY_NOT_METERED`; los elementos aplazados permanecen `pending` y se
programa un trabajo único `UNMETERED`. En red medida, el modo intermedio admite
hasta 800 MB y el extremo cualquier tamaño. Los errores inciertos y
`DUPLICATE_FILE` se reconcilian por checksum antes de permitir otra transmisión.

El `ContentObserver` de imágenes y vídeos pertenece a `Application`, no a una
`Activity`. Agrupa cambios durante 1,5 segundos y agenda el trabajo único
`orange_photos_media_change_<userId>`. Cada ejecución del worker vuelve a leer
MediaStore y registra los elementos detectados en Room antes de recuperar estados
`uploading` y seleccionar el lote. Las acciones manuales convergen en
`orange_photos_sync_<userId>`; la espera de Wi-Fi y el mantenimiento periódico
usan nombres únicos separados para no multiplicar workers.

Cuando Node devuelve `upload_mode=multipart`, Android usa la misma API reanudable
que la web. Room 5 conserva el identificador remoto de sesión, la clave estable de
cliente, tamaño y total de partes, caducidad y cada ETag confirmado. Al reanudar,
el servidor vuelve a ser la fuente de verdad de las partes presentes y el agente
transfiere únicamente las ausentes. La migración 4→5 crea estas tablas sin borrar
el inventario, la configuración ni la cola existentes. `simple` y
`direct_backend` siguen implementados por compatibilidad y solo se usan cuando
Node devuelve expresamente esos modos.

La carpeta usa una cuadrícula con miniaturas solicitadas a `ContentResolver`,
carga incremental en páginas de 200 y estados observados desde Room. El estado
remoto caduca a las 24 horas y puede renovarse con «Verificar». «Todo» selecciona
los elementos cargados hasta ese momento. `remote_missing` permanece reservado:
el backend no lo produce mientras PostgreSQL no disponga de un estado físico
oficial del objeto.

La URL release de la API es:

```text
https://family.orangedesk.net/
```

La APK release se genera desde `mobile/orange-photos-sync-agent` con:

```powershell
gradlew.bat clean assembleRelease ^
  -PorangeFamily.releaseApiBaseUrl=https://family.orangedesk.net/ ^
  -PorangeFamily.keystoreFile=RUTA_KEYSTORE ^
  -PorangeFamily.keystorePassword=CONTRASEÑA_KEYSTORE ^
  -PorangeFamily.keyAlias=orangefamily ^
  -PorangeFamily.keyPassword=CONTRASEÑA_CLAVE
```

La APK resultante se encuentra en:

```text
app\build\outputs\apk\release\app-release.apk
```

Las versiones futuras deben conservar el `applicationId`, el keystore y el alias,
y aumentar `versionCode`.

Documentos relacionados
Orange Photos.
Almacenamiento de Orange Photos.
Estado de API y autenticación.
Arquitectura de la API.
Seguridad y protección de datos.
Despliegue de producción.

## Cuándo hacerlo

Haz esta modificación **antes del commit del bloque de inventario**. Así el commit incluirá:

- implementación Room;
- permisos y detección;
- decisiones de privacidad;
- estado real del agente;
- fases futuras.

Después añade también el documento:

```powershell
git add docs/40-features/orange-photos/ANDROID_SYNC_AGENT.md
```

## Desarrollo, firma y distribución de la APK

### Variantes

Debug:

- se usa para desarrollo y pruebas desde Android Studio;
- Android Studio la firma automáticamente con la clave debug;
- no utiliza el keystore release;
- lee `orangeFamily.apiBaseUrl` desde
  `mobile/orange-photos-sync-agent/local.properties`;
- para emulador Android, el localhost del PC se alcanza mediante
  `http://10.0.2.2:<puerto>/`;
- para móvil físico en la misma red, debe usarse la IP local del PC y el backend
  debe aceptar conexiones desde la red.

Release:

- se usa para instalar la APK estable en los móviles familiares;
- apunta a `https://family.orangedesk.net/`;
- no debe usarse `https://family.orangedesk.net/api/`;
- utiliza el keystore definitivo;
- la misma APK sirve para todos los familiares;
- cada usuario inicia sesión con sus propias credenciales;
- identidad, familia y ownership proceden de la sesión autenticada.

### Keystore definitivo

Ruta local actual:

```text
C:\Users\dimm7\orangefamily-secrets\orangefamily-release.jks
```

Alias:

```text
orangefamily
```

Application ID:

```text
com.orangefamily.photossync
```

- El keystore se crea una sola vez y se reutiliza en todas las versiones futuras.
- No debe regenerarse ni guardarse en Git.
- Debe conservarse junto con sus contraseñas en copias seguras.
- Perder el keystore impide actualizar una APK ya instalada.
- La contraseña del almacén y la contraseña de la clave son conceptos distintos,
  aunque actualmente pueden tener el mismo valor.
- Nunca deben documentarse las contraseñas reales.

### Propiedades privadas de Gradle

Las propiedades están almacenadas fuera del repositorio en:

```text
C:\Users\dimm7\.gradle\gradle.properties
```

Propiedades utilizadas:

```text
orangeFamily.releaseApiBaseUrl
orangeFamily.keystoreFile
orangeFamily.keystorePassword
orangeFamily.keyAlias
orangeFamily.keyPassword
```

No deben copiarse valores secretos al repositorio.

### Generación de release

Desde:

```text
C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent
```

Comando habitual:

```powershell
.\gradlew.bat clean assembleRelease --no-configuration-cache
```

Si `JAVA_HOME` no está configurado para la sesión:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

APK generada:

```text
app\build\outputs\apk\release\app-release.apk
```

El aviso `Unable to strip ... libandroidx.graphics.path.so` no bloqueó la
generación de la APK y puede considerarse informativo mientras el build termine
con `BUILD SUCCESSFUL`.

### Primera instalación y actualizaciones

Primera instalación:

- una antigua APK debug puede tener el mismo `applicationId` pero otra firma;
- Android no permite instalar la release encima;
- en ese caso debe desinstalarse una sola vez la versión debug;
- se pierden únicamente los datos locales de esa instalación;
- PostgreSQL y Wasabi no se ven afectados.

Actualizaciones futuras:

- mantener el mismo `applicationId`;
- mantener el mismo keystore;
- mantener el mismo alias;
- aumentar siempre `versionCode`;
- `versionName` debe reflejar la versión visible;
- generar una nueva release;
- Android la instalará encima conservando sesión, Room y preferencias.

Ejemplo:

```kotlin
versionCode = 3
versionName = "1.1.0"
```

### Pruebas habituales con Android Studio

1. Abrir `mobile/orange-photos-sync-agent` en Android Studio.
2. Seleccionar la variante `debug`.
3. Configurar `local.properties`.
4. Conectar emulador o móvil físico.
5. Pulsar **Run**.
6. Android Studio compila, firma e instala automáticamente.

No se necesita:

- crear otro keystore;
- introducir credenciales release;
- ejecutar `assembleRelease`;
- desinstalar la release, salvo que debug y release compartan `applicationId` y
  se intente alternar entre ambas.

### Recomendación pendiente

Como mejora posterior, añadir en `buildTypes.debug`:

```kotlin
applicationIdSuffix = ".debug"
```

Objetivo:

- permitir tener instalada simultáneamente la app de producción y la app debug;
- evitar conflictos de firma;
- mantener completamente separadas las pruebas locales y producción.

Este cambio no está implementado en esta tarea.
