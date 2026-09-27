# Workflow Android APK — prueba, validación y publicación

Este documento es la fuente canónica para generar, instalar, validar y publicar APK de OrangeFamily.

Se aplica junto con:

- `.agents/skills/orangefamily-android/SKILL.md`
- `.agents/skills/orangefamily-android-release/SKILL.md`
- `docs/20-development/COMMIT_AND_RELEASE_WORKFLOW.md`

La regla principal es separar dos artefactos y dos momentos:

1. **APK de prueba física**, antes de cambiar la versión.
2. **APK definitiva publicable**, después del OK físico y del bump de versión.

Una APK de prueba no es una release publicada.

## 1. Fuentes de verdad

- Código funcional: Git.
- Código aprobado para una prueba: SHA exacto de la rama revisada.
- Código de una release definitiva: SHA exacto de `main`.
- Versión declarada: `mobile/orange-photos-sync-agent/app/build.gradle.kts`.
- Release publicada: `public.application_releases`.
- Binario publicado: fichero servido por HTTPS.
- Estado real del móvil: paquete consultado mediante ADB.
- Identidad del binario: SHA-256 de la APK.

No utilizar como fuente de verdad un fichero antiguo que siga existiendo en `app/build/outputs/apk/release/`. Antes de cualquier build release se ejecuta `clean assembleRelease`.

## 2. Invariante obligatorio: probar antes de versionar

El flujo correcto es:

```text
rama funcional
→ checks
→ commit + push
→ revisión remota
→ APK release firmada DE PRUEBA con la versión publicada actual
→ adb install -r
→ prueba física humana
→ si falla: corregir, revisar y repetir la APK de prueba SIN bump
→ OK humano explícito
→ bump versionCode/versionName
→ commit de versión
→ fast-forward a main
→ APK definitiva desde main limpio
→ adb install -r + smoke final
→ publicar EXACTAMENTE ese binario
→ cuatro hashes iguales
→ registrar application_releases
```

Está prohibido hacer el bump de versión para poder realizar la primera prueba física.

Los intentos de prueba no consumen `versionCode`.

## 3. Infraestructura local verificada

- Repositorio: `C:\Users\dimm7\local-sites\APP-ORANGEFAMILY`
- Proyecto Android: `C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent`
- Java/JBR: `C:\Program Files\Android\Android Studio\jbr`
- SDK Android: `C:\Users\dimm7\AppData\Local\Android\Sdk`
- ADB: `C:\Users\dimm7\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Keystore release: `C:\Users\dimm7\orangefamily-secrets\orangefamily-release.jks`
- Gradle signing properties: `C:\Users\dimm7\.gradle\gradle.properties`
- Application ID: `com.orangefamily.photossync`
- API release: `https://family.orangedesk.net/`
- Alias: `orangefamily`

Nunca imprimir contraseñas, copiar secretos al repositorio ni regenerar el keystore.

# FASE A — APK DE PRUEBA FÍSICA

## 4. Requisito previo

La implementación funcional debe estar:

- en una rama específica;
- committeada;
- subida al remoto;
- revisada directamente desde GitHub;
- corregida si procede;
- aprobada para prueba física.

No hace falta que la rama esté integrada todavía en `main`.

La APK de prueba se genera desde el SHA funcional aprobado y mantiene exactamente el `versionCode` y `versionName` publicados actualmente.

Esto permite reinstalar sobre la aplicación existente mediante la misma firma sin inventar una nueva release solo para probar.

Si la tarea incluye backend no compatible con producción, su despliegue requiere una autorización de producción separada. La APK de prueba no autoriza por sí sola un despliegue backend.

## 5. Determinar el estado antes de construir

Comprobar:

1. versión declarada en `build.gradle.kts`;
2. release publicada en Ajustes → Descargas o mediante la API autenticada;
3. versión instalada en el dispositivo.

Desde el proyecto Android:

```powershell
cd C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent

$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Select-String `
  -Path ".\app\build.gradle.kts" `
  -Pattern "versionCode|versionName"

& $adb devices

& $adb shell dumpsys package com.orangefamily.photossync |
  Select-String "versionCode|versionName"
```

Si el dispositivo tiene una versión superior a la que se pretende instalar, detenerse.

Nunca utilizar `adb install -d`.

Nunca desinstalar para evitar una comprobación de versión o firma.

## 6. Entorno Java

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"

java -version
```

No instalar otro Java para una release si el JBR de Android Studio está disponible.

## 7. Checks previos de la APK de prueba

```powershell
cd C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent

.\gradlew.bat :app:testDebugUnitTest --no-configuration-cache
.\gradlew.bat :app:assembleDebug --no-configuration-cache

git diff --check
git status --short
```

La prueba física no sustituye los tests.

## 8. Generar la APK de prueba

La APK de prueba es un build **release firmado**, no un debug build.

No cambiar versión.

Ejecutar siempre:

```powershell
.\gradlew.bat clean assembleRelease --no-configuration-cache
```

Debe finalizar con `BUILD SUCCESSFUL`.

APK resultante:

`app\build\outputs\apk\release\app-release.apk`

El `clean` es obligatorio para impedir que una APK antigua quede confundida con la recién generada.

## 9. Verificar el binario antes de instalar

```powershell
$apk=".\app\build\outputs\apk\release\app-release.apk"
$sdk="$env:LOCALAPPDATA\Android\Sdk"
$buildTools=Get-ChildItem "$sdk\build-tools" -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1

$aapt=Join-Path $buildTools.FullName "aapt.exe"
$apksigner=Join-Path $buildTools.FullName "apksigner.bat"

& $aapt dump badging $apk | Select-String "^package:"
& $apksigner verify --verbose --print-certs $apk
Get-FileHash $apk -Algorithm SHA256
```

El `package` debe ser `com.orangefamily.photossync`; la versión embebida debe ser la publicada actual para la fase de prueba.

No instalar si package, versión o firma son inesperados.

## 10. Instalar APK de prueba

```powershell
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

& $adb devices
& $adb install -r ".\app\build\outputs\apk\release\app-release.apk"
```

Resultado esperado: `Success`.

No usar `-d`.

No desinstalar.

No borrar datos.

No cerrar sesión expresamente.

La misma firma y `-r` conservan Room, preferencias, sesión y estado local.

Si aparece `INSTALL_FAILED_VERSION_DOWNGRADE`, comprobar primero el APK real: normalmente significa que se ha intentado instalar un artefacto antiguo o que el dispositivo ya tiene un `versionCode` superior.

## 11. Qué debe mostrar el agente al usuario

Si el agente tiene shell y autorización, debe ejecutar los comandos de build/ADB por sí mismo. No utilizar al usuario como terminal intermedio.

Si una acción manual es imprescindible, el bloque debe empezar siempre con:

```powershell
cd C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent
$adb="$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
```

No mostrar comandos que dependan de una variable no definida.

Después de instalar, el agente debe indicar únicamente las pruebas físicas concretas relacionadas con el cambio y el resultado esperado.

Formato:

```text
Prueba física pendiente:
1. Acción concreta en la app.
2. Resultado esperado.
3. Caso límite que originó el bug.
```

En este punto el proceso se detiene hasta recibir del usuario un OK o un fallo.

No hacer bump.

No publicar.

No registrar `application_releases`.

## 12. Si la prueba falla

Volver a la rama funcional.

Aplicar cambio mínimo.

Ejecutar tests.

Commit + push.

Revisión remota del nuevo commit.

Generar de nuevo una APK release de prueba con la misma versión publicada.

Instalar mediante `adb install -r`.

Repetir la validación.

No incrementar `versionCode` para iteraciones de prueba.

# FASE B — APK DEFINITIVA Y PUBLICACIÓN

## 13. Condición de entrada

Solo se inicia cuando el usuario ha confirmado explícitamente que la APK de prueba funciona físicamente.

Sin ese OK no se cambia la versión.

## 14. Determinar la nueva versión

Comprobar la release publicada y `build.gradle.kts`.

El nuevo `versionCode` debe ser estrictamente superior al publicado.

Modificar únicamente `mobile/orange-photos-sync-agent/app/build.gradle.kts` y solo:

```kotlin
versionCode = <nuevo código>
versionName = "<nueva versión>"
```

Commit separado de versión.

No mezclar cambios funcionales con el bump.

## 15. Integrar en main

Tras revisar el commit de versión:

```powershell
git fetch origin
git switch main
git pull --ff-only origin main
git merge --ff-only <rama-aprobada>
git push origin main

git rev-parse main
git rev-parse origin/main
```

Los dos SHA deben coincidir.

No usar force push, rebase ni merge commit cuando el fast-forward es posible.

## 16. Build definitivo desde main limpio

La APK definitiva sale exclusivamente del SHA aprobado de `main`.

Si el working tree habitual contiene untracked o trabajo ajeno, utilizar un worktree limpio del SHA de release en lugar de borrar, mover o hacer stash de trabajo no relacionado.

Ejecutar nuevamente:

```powershell
.\gradlew.bat :app:testDebugUnitTest --no-configuration-cache
.\gradlew.bat :app:assembleDebug --no-configuration-cache
.\gradlew.bat clean assembleRelease --no-configuration-cache
```

Repetir las verificaciones de package, `versionCode`, `versionName`, firma y SHA-256.

## 17. Instalar la APK definitiva antes de publicar

```powershell
& $adb shell dumpsys package com.orangefamily.photossync |
  Select-String "versionCode|versionName"

& $adb install -r ".\app\build\outputs\apk\release\app-release.apk"

& $adb shell dumpsys package com.orangefamily.photossync |
  Select-String "versionCode|versionName"
```

Realizar un smoke final de inicio, sesión, conectividad y funcionalidad modificada.

Una vez validada, **no volver a compilar**. El fichero probado es el que se publica.

# PUBLICACIÓN EN EL VPS

## 18. Infraestructura real

- Servidor: `ubuntu@141.95.179.205`
- Alias operativo conocido: `orangekode-prod-01m`
- Clave SSH desde Windows: `$env:USERPROFILE\.ssh\orangedesk-prod-2026`
- Repositorio de producción: `/opt/orangefamily/APP-ORANGEFAMILY`
- Directorio público de APK: `/var/www/family.orangedesk.net/downloads/android/`
- Patrón de fichero: `orangefamily-<versionName>.apk`
- URL pública: `https://family.orangedesk.net/downloads/android/orangefamily-<versionName>.apk`

La publicación del APK es independiente del workflow normal de deploy de frontend/backend.

## 19. Preparar variables de publicación

```powershell
cd C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent

$version="<versionName>"
$file="orangefamily-$version.apk"
$apk=".\app\build\outputs\apk\release\app-release.apk"
$key="$env:USERPROFILE\.ssh\orangedesk-prod-2026"
$server="ubuntu@141.95.179.205"
$remoteTmp="/tmp/$file"
$remoteFinal="/var/www/family.orangedesk.net/downloads/android/$file"
$url="https://family.orangedesk.net/downloads/android/$file"

$localHash=(Get-FileHash $apk -Algorithm SHA256).Hash
$localHash
```

## 20. Subir primero a /tmp

```powershell
scp -i $key $apk "$server`:$remoteTmp"
ssh -i $key $server "sha256sum '$remoteTmp'"
```

El hash temporal debe coincidir con `$localHash`.

No publicar si no coincide.

## 21. Instalar en el directorio público

La convención de las publicaciones actuales es fichero legible por Nginx con permisos `0644`.

Antes de instalar, comprobar la convención real de los APK ya publicados:

```powershell
ssh -i $key $server "stat -c '%U:%G %a %n' /var/www/family.orangedesk.net/downloads/android/orangefamily-*.apk | tail -n 5"
```

Solo si la convención confirmada es `root:root 0644`, publicar:

```powershell
ssh -i $key $server "sudo install -o root -g root -m 0644 '$remoteTmp' '$remoteFinal'"
```

Verificar:

```powershell
ssh -i $key $server "stat -c '%U:%G %a %s %n' '$remoteFinal' && sha256sum '$remoteFinal'"
```

Si la instalación existente del servidor no usa `root:root 0644`, detenerse y preservar la convención existente en lugar de modificarla silenciosamente.

## 22. Verificar el mismo binario por HTTPS

```powershell
$httpsCopy=Join-Path $env:TEMP $file

Invoke-WebRequest `
  -Uri $url `
  -OutFile $httpsCopy

$httpsHash=(Get-FileHash $httpsCopy -Algorithm SHA256).Hash
$httpsHash
```

Los cuatro hashes obligatorios son:

1. local;
2. `/tmp`;
3. fichero final del VPS;
4. descarga HTTPS.

Los cuatro deben coincidir exactamente.

Después puede eliminarse la copia temporal local y el fichero de `/tmp`.

# REGISTRO DE LA RELEASE

## 23. application_releases

El registro normal no se hace mediante SQL manual.

Ruta de interfaz:

`Ajustes → Descargas → Publicación Android`

Solo un owner puede actualizarlo.

La interfaz llama:

`PUT /api/settings/app-releases/android/latest`

Node valida y actualiza `public.application_releases` y registra la acción en audit logs.

Campos:

- `version_code`
- `version_name`
- `file_name`
- `download_url`
- `release_notes`

Ejemplo conceptual:

```text
version_code: <nuevo código>
version_name: <nueva versión>
file_name: orangefamily-<nueva versión>.apk
download_url: https://family.orangedesk.net/downloads/android/orangefamily-<nueva versión>.apk
release_notes: <cambios validados>
```

No registrar hasta que la URL HTTPS y los cuatro hashes estén verificados.

## 24. Verificación después del registro

En Ajustes → Descargas comprobar:

- versión;
- código;
- nombre de fichero;
- notas;
- enlace.

Abrir/descargar el enlace y confirmar que sigue correspondiendo al mismo APK.

Los clientes Android comparan el `versionCode` instalado con la release publicada. Solo después de registrar un código superior debe aparecer la actualización a usuarios con una versión anterior.

## 25. Qué debe devolver el agente al cerrar

### APK de prueba

```text
SHA funcional probado:
Version instalada antes:
Version de la APK de prueba:
Package:
Firma:
SHA-256:
adb install -r:
Pruebas físicas pendientes:
Publicada: no
application_releases: sin modificar
```

### APK definitiva publicada

```text
SHA main:
Version:
VersionCode:
Package:
APK local:
SHA-256 local:
SHA-256 /tmp:
SHA-256 servidor:
SHA-256 HTTPS:
Firma:
adb install -r:
Servidor: ubuntu@141.95.179.205
Ruta: /var/www/family.orangedesk.net/downloads/android/<file>
URL: https://family.orangedesk.net/downloads/android/<file>
application_releases: registrada / pendiente
```

## 26. Condiciones de parada

Detenerse si:

- el SHA que se construye no es el aprobado;
- hay cambios tracked no committeados;
- aparece trabajo ajeno que sería sobrescrito;
- falla cualquier test/build;
- falta el JBR, SDK o keystore esperado;
- package/version/firma de la APK no coinciden;
- ADB muestra `unauthorized` u `offline`;
- la instalación exige `-d` o desinstalar;
- hay firma incompatible;
- la versión embebida en la APK es distinta de la esperada;
- cualquiera de los cuatro hashes no coincide;
- el fichero HTTPS no es accesible;
- se requiere cambiar ownership/permisos del servidor sin confirmar la convención;
- la release que se intenta registrar no coincide con el binario publicado.

Nunca arreglar una condición de parada con force push, downgrade, uninstall, regeneración de keystore, recompilación silenciosa o edición manual de PostgreSQL.

## 27. Incidente de proceso del 27/09/2026

Durante la preparación de la 1.8.2 se adelantó el bump de `versionCode/versionName` antes de completar la primera prueba física.

No hubo publicación pública antes de validar, pero el orden no era el flujo establecido.

Regla preventiva incorporada al harness:

**la APK de prueba firmada se genera e instala manteniendo la versión publicada actual; el bump solo se realiza después del OK físico humano.**
