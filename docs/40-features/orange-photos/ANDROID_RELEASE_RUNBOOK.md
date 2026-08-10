# OrangeFamily — Runbook de publicación Android

> Documento operativo de referencia para versionar, compilar, firmar, validar, subir y publicar una nueva APK Android de OrangeFamily y comprobar que queda disponible desde **Ajustes → Descargas**.
>
> Actualizar este documento si cambian IPs, dominios, rutas, firma, estructura del VPS o mecanismo de publicación.

## 1. Dónde guardar este documento

Guardar en el repositorio en:

```text
docs/40-features/orange-photos/ANDROID_RELEASE_RUNBOOK.md
```

Debe quedar junto a:

```text
docs/40-features/orange-photos/ANDROID_SYNC_AGENT.md
docs/40-features/orange-photos/IMPLEMENTATION_STATUS.md
```

Y conviene añadir al principio de `ANDROID_SYNC_AGENT.md`:

```md
> Para publicar una nueva APK en producción:
> [`ANDROID_RELEASE_RUNBOOK.md`](./ANDROID_RELEASE_RUNBOOK.md)
```

## 2. Datos operativos actuales

### Repositorio

GitHub:

```text
https://github.com/dimm76/APP-ORANGEFAMILY
```

Repositorio local habitual en Windows:

```text
C:\Users\dimm7\local-sites\app-orangefamily
```

Proyecto Android:

```text
mobile/orange-photos-sync-agent
```

Archivo de versión:

```text
mobile/orange-photos-sync-agent/app/build.gradle.kts
```

Application ID:

```text
com.orangefamily.photossync
```

No cambiarlo para una actualización normal.

### Producción

Dominio web / API usado por la APK release:

```text
https://family.orangedesk.net/
```

Servidor:

```text
orangekode-prod-01m
```

IP pública usada desde Windows:

```text
141.95.179.205
```

Usuario SSH:

```text
ubuntu
```

Clave SSH local habitual:

```text
$env:USERPROFILE\.ssh\orangedesk-prod-2026
```

Conexión SSH desde PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ubuntu@141.95.179.205
```

El hostname `orangekode-prod-01m` puede aparecer dentro del servidor, pero Windows no tiene por qué resolverlo. Para SSH/SCP desde Windows usar la IP documentada mientras siga siendo la vigente.

### Código desplegado en VPS

```text
/opt/orangefamily/APP-ORANGEFAMILY
```

Servicio backend:

```text
orangefamily-backend.service
```

Comprobar:

```bash
sudo systemctl status orangefamily-backend.service
```

Reiniciar solo si un despliegue backend lo requiere:

```bash
sudo systemctl restart orangefamily-backend.service
```

Publicar solo una APK no requiere reiniciar el backend.

### PostgreSQL producción

Base:

```text
orangefamily_app_prod
```

Acceso administrativo:

```bash
sudo -u postgres psql -d orangefamily_app_prod
```

Tabla de release vigente:

```text
public.application_releases
```

PostgreSQL guarda metadatos de publicación, no el APK.

### Carpeta pública de APKs

Ruta física:

```text
/var/www/family.orangedesk.net/downloads/android/
```

Nombre esperado:

```text
orangefamily-X.Y.Z.apk
```

URL pública:

```text
https://family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
```

Ejemplo:

```text
https://family.orangedesk.net/downloads/android/orangefamily-1.4.0.apk
```

No confundir con:

```text
/opt/orangefamily/APP-ORANGEFAMILY/mobile/orange-photos-sync-agent/orangefamily-installed.apk
```

`orangefamily-installed.apk` no es la release pública versionada.

## 3. Flujo completo

```text
Código Android
  → validar en dispositivo físico
  → commit/push
  → versionCode/versionName
  → commit/push del bump
  → integrar en main
  → assembleRelease
  → APK firmada
  → SHA256
  → copia orangefamily-X.Y.Z.apk
  → prueba ADB
  → SCP a /tmp
  → mover a /var/www/family.orangedesk.net/downloads/android/
  → copiar propietario/permisos
  → verificar SHA256 en VPS
  → validar URL HTTPS
  → Ajustes → Descargas
  → PUT /api/settings/app-releases/android/latest
  → public.application_releases
  → comprobar descarga desde web
```

Hay dos operaciones diferentes: alojar el APK y registrar qué release es la vigente. No registrar una release antes de validar que la URL HTTPS funciona.

## 4. Revisar Git antes de publicar

Desde:

```text
C:\Users\dimm7\local-sites\app-orangefamily
```

```powershell
git status --short
git branch --show-current
git log --oneline -5
```

No publicar una APK cuyo código final exista solo sin commit en el working tree.

Commit funcional, por ejemplo:

```powershell
git add <archivos-modificados>
git commit -m "feat(android): improve cloud library timeline navigation"
git push
```

## 5. Versionar Android

Editar:

```text
mobile/orange-photos-sync-agent/app/build.gradle.kts
```

Bloque:

```kotlin
defaultConfig {
    applicationId = "com.orangefamily.photossync"
    minSdk = 26
    targetSdk = 36
    versionCode = N
    versionName = "X.Y.Z"
}
```

Reglas:

- `versionCode` siempre debe aumentar;
- `versionName` es la versión legible;
- no reutilizar un `versionCode` publicado;
- no cambiar `applicationId`;
- mantener la misma firma release.

Ejemplo:

```kotlin
versionCode = 7
versionName = "1.4.0"
```

Commit recomendado:

```powershell
git add mobile/orange-photos-sync-agent/app/build.gradle.kts
git commit -m "chore(android): bump version to 1.4.0"
git push
```

## 6. Integrar en main

Si se trabajó en rama:

```powershell
git switch main
git pull --ff-only origin main
```

Si la rama permite fast-forward:

```powershell
git merge --ff-only <rama>
git push origin main
```

Si `--ff-only` falla, no forzar. Revisar la divergencia antes de integrar.

Comprobar:

```powershell
git status
git log --oneline -5
```

La release publicada debe ser trazable a un commit de Git.

## 7. Configurar el build release

```powershell
cd C:\Users\dimm7\local-sites\app-orangefamily\mobile\orange-photos-sync-agent
```

Java:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

API producción:

```powershell
${env:ORG_GRADLE_PROJECT_orangeFamily.releaseApiBaseUrl} = "https://family.orangedesk.net/"
```

La URL debe usar HTTPS y terminar en `/`.

## 8. Firma release

La firma usa propiedades Gradle locales. El build valida URL, keystore, passwords y alias.

Nunca documentar ni commitear:

- clave privada SSH;
- fichero keystore;
- password del keystore;
- password de la key;
- tokens;
- cookies;
- credenciales PostgreSQL/Wasabi.

Mantener el mismo `applicationId` y una firma compatible para poder actualizar una instalación existente.

## 9. Compilar

Desde `mobile/orange-photos-sync-agent`:

```powershell
.\gradlew.bat clean assembleRelease --no-configuration-cache
```

Debe terminar en:

```text
BUILD SUCCESSFUL
```

APK:

```text
app\build\outputs\apk\release\app-release.apk
```

Ruta absoluta habitual:

```text
C:\Users\dimm7\local-sites\app-orangefamily\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk
```

## 10. Comprobar que existe

Desde raíz del repo:

```powershell
Get-ChildItem ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\"
```

Error habitual: buscar `\.\app\build...` estando en la raíz. Desde la raíz hay que incluir `mobile\orange-photos-sync-agent`.

## 11. SHA256

Desde raíz:

```powershell
Get-FileHash ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk" -Algorithm SHA256
```

Guardar el hash si se desea verificar el artefacto más tarde.

## 12. Crear APK versionada

```powershell
Copy-Item ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk"
```

Ejemplo:

```powershell
Copy-Item ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-1.4.0.apk"
```

Hash versionada:

```powershell
Get-FileHash ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk" -Algorithm SHA256
```

Debe coincidir con `app-release.apk`.

## 13. Prueba ADB

Comprobar dispositivo:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

Actualizar conservando datos:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk"
```

Si falla por firma, no desinstalar automáticamente: revisar primero el keystore correcto.

## 14. SSH al VPS

```powershell
ssh -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ubuntu@141.95.179.205
```

Verbose:

```powershell
ssh -v -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ubuntu@141.95.179.205
```

## 15. SCP de la APK

Recomendado en una sola línea para evitar errores de PowerShell:

```powershell
scp -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk" ubuntu@141.95.179.205:/tmp/orangefamily-X.Y.Z.apk
```

Ejemplo:

```powershell
scp -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-1.4.0.apk" ubuntu@141.95.179.205:/tmp/orangefamily-1.4.0.apk
```

Si parece colgado:

```powershell
scp -v -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk" ubuntu@141.95.179.205:/tmp/orangefamily-X.Y.Z.apk
```

Ruta de clave correcta:

```text
$env:USERPROFILE\.ssh\orangedesk-prod-2026
```

No:

```text
$env:USERPROFILE.ssh\orangedesk-prod-2026
```

## 16. Verificar archivo en `/tmp`

En VPS:

```bash
ls -lh /tmp/orangefamily-X.Y.Z.apk
sha256sum /tmp/orangefamily-X.Y.Z.apk
```

Comparar SHA256 con Windows.

## 17. Localizar APKs si cambia la infraestructura

```bash
sudo find /var/www /srv /opt -type f -name 'orangefamily-*.apk' -print 2>/dev/null
```

Para una versión concreta:

```bash
sudo find /var/www /srv /opt -type f -name 'orangefamily-1.2.0.apk' -print 2>/dev/null
```

Ubicación confirmada actualmente:

```text
/var/www/family.orangedesk.net/downloads/android/
```

## 18. Mover a carpeta pública

```bash
sudo mv /tmp/orangefamily-X.Y.Z.apk /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
```

No sobrescribir releases anteriores.

## 19. Propietario y permisos

Copiar de una APK pública válida:

```bash
sudo chown --reference=/var/www/family.orangedesk.net/downloads/android/orangefamily-1.2.0.apk /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
sudo chmod --reference=/var/www/family.orangedesk.net/downloads/android/orangefamily-1.2.0.apk /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
```

Si `1.2.0` ya no existe, usar otra release pública válida como referencia.

Comprobar:

```bash
ls -lh /var/www/family.orangedesk.net/downloads/android/
```

## 20. Verificar SHA256 en VPS

```bash
sha256sum /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
```

Debe coincidir con Windows.

## 21. Verificar URL pública

```bash
curl -I https://family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
```

Esperado normalmente:

```text
HTTP/2 200
```

Desde Windows:

```powershell
curl.exe -I "https://family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk"
```

No registrar la release si devuelve 404/403/5xx.

## 22. Ajustes → Descargas

La webapp publica la release desde:

```text
Ajustes → Descargas
```

Consulta:

```text
GET /api/app-releases/android/latest
```

Actualización por owner:

```text
PUT /api/settings/app-releases/android/latest
```

Campos:

```text
version_code
version_name
file_name
download_url
release_notes
```

Ejemplo:

```text
version_code: 7
version_name: 1.4.0
file_name: orangefamily-1.4.0.apk
download_url: https://family.orangedesk.net/downloads/android/orangefamily-1.4.0.apk
```

El backend valida autenticación, rol owner, versionCode, nombre APK, HTTPS y notas; actualiza `public.application_releases` y registra auditoría en `public.audit_logs`.

No hace falta un `INSERT`/`UPDATE` SQL manual para una publicación normal.

## 23. Verificar PostgreSQL

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -P pager=off \
  -c "
SELECT
  version_code,
  version_name,
  file_name,
  download_url,
  published_at
FROM public.application_releases
WHERE platform = 'android';
"
```

La salida debe coincidir con lo publicado en Ajustes.

## 24. Verificación final en web

1. Recargar `Ajustes → Descargas`.
2. Comprobar `versionName` y `versionCode`.
3. Comprobar `file_name`.
4. Pulsar `Descargar APK`.
5. Comprobar que descarga la nueva versión.
6. Verificar nombre del archivo.
7. Instalar encima de la versión anterior cuando corresponda.
8. Confirmar que conserva datos/sesión si la actualización debe hacerlo.

## 25. Rollback

El backend no permite publicar un `versionCode` inferior al vigente.

No intentar rollback de `code 7` a `code 6`.

Si una release falla, hacer rollback funcional con un código superior:

```text
1.4.0 / code 7 → problema
1.4.1 / code 8 → corrección/reversión funcional
```

Mantener la APK anterior mientras no haya una política explícita de limpieza.

## 26. Troubleshooting

### `Could not resolve hostname orangekode-prod-01m`

Usar la IP vigente:

```powershell
ssh -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ubuntu@141.95.179.205
```

### `Identity file ... not accessible`

```powershell
Test-Path "$env:USERPROFILE\.ssh\orangedesk-prod-2026"
```

Debe devolver `True`.

### SCP parece colgado

Primero probar SSH. Luego usar `scp -v`.

### No aparece `app-release.apk`

```powershell
Get-ChildItem ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\"
```

### Build release falla

Comprobar:

```powershell
$env:JAVA_HOME
${env:ORG_GRADLE_PROJECT_orangeFamily.releaseApiBaseUrl}
```

La URL esperada actualmente:

```text
https://family.orangedesk.net/
```

Y comprobar que las propiedades privadas de firma existen localmente.

### La APK no actualiza una instalación existente

Revisar:

- mismo `applicationId`;
- `versionCode` superior;
- misma firma release;
- no haber generado accidentalmente una build debug.

### URL 404

```bash
ls -lh /var/www/family.orangedesk.net/downloads/android/
```

Comprobar que URL y nombre físico coinciden exactamente.

### URL 403

Comparar propietario/permisos con una APK pública válida y reaplicar `chown --reference` / `chmod --reference`.

### Ajustes muestra versión anterior

Consultar `public.application_releases` antes de modificar código.

### `orangefamily-installed.apk`

No usarlo para publicación. Las releases públicas están en:

```text
/var/www/family.orangedesk.net/downloads/android/
```

## 27. Comandos rápidos

### Windows — raíz

```powershell
cd C:\Users\dimm7\local-sites\app-orangefamily
git status --short
git branch --show-current
git log --oneline -5
```

### Build

```powershell
cd .\mobile\orange-photos-sync-agent
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
${env:ORG_GRADLE_PROJECT_orangeFamily.releaseApiBaseUrl} = "https://family.orangedesk.net/"
.\gradlew.bat clean assembleRelease --no-configuration-cache
cd ..\..
```

### Hash + copia

```powershell
Get-FileHash ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk" -Algorithm SHA256
Copy-Item ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\app-release.apk" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk"
```

### SCP

```powershell
scp -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ".\mobile\orange-photos-sync-agent\app\build\outputs\apk\release\orangefamily-X.Y.Z.apk" ubuntu@141.95.179.205:/tmp/orangefamily-X.Y.Z.apk
```

### SSH

```powershell
ssh -i "$env:USERPROFILE\.ssh\orangedesk-prod-2026" ubuntu@141.95.179.205
```

### VPS

```bash
sudo mv /tmp/orangefamily-X.Y.Z.apk /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
sudo chown --reference=/var/www/family.orangedesk.net/downloads/android/orangefamily-1.2.0.apk /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
sudo chmod --reference=/var/www/family.orangedesk.net/downloads/android/orangefamily-1.2.0.apk /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
sha256sum /var/www/family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
curl -I https://family.orangedesk.net/downloads/android/orangefamily-X.Y.Z.apk
```

### Web

```text
Ajustes → Descargas
```

### DB

```bash
sudo -u postgres psql -d orangefamily_app_prod -P pager=off -c "SELECT version_code, version_name, file_name, download_url, published_at FROM public.application_releases WHERE platform = 'android';"
```

## 28. Checklist final

- [ ] funcionalidad validada en móvil físico;
- [ ] cambios funcionales commit/push;
- [ ] código final integrado en `main`;
- [ ] `versionCode` incrementado;
- [ ] `versionName` actualizado;
- [ ] bump commit/push;
- [ ] build release correcto;
- [ ] APK firmada;
- [ ] SHA256 calculado;
- [ ] APK versionada;
- [ ] prueba ADB correcta;
- [ ] SCP correcto;
- [ ] hash VPS coincide;
- [ ] APK en `/var/www/family.orangedesk.net/downloads/android/`;
- [ ] propietario correcto;
- [ ] permisos correctos;
- [ ] URL HTTPS devuelve 200;
- [ ] release registrada en `Ajustes → Descargas`;
- [ ] DB muestra la release;
- [ ] web muestra la versión;
- [ ] `Descargar APK` funciona;
- [ ] instalación/actualización correcta;
- [ ] no se han expuesto secretos;
- [ ] runbook actualizado si cambió infraestructura.

## 29. Valores que deben actualizarse si cambia infraestructura

```text
IP VPS                141.95.179.205
usuario SSH           ubuntu
clave SSH local       $env:USERPROFILE\.ssh\orangedesk-prod-2026
dominio producción    family.orangedesk.net
API release           https://family.orangedesk.net/
repo local            C:\Users\dimm7\local-sites\app-orangefamily
repo VPS              /opt/orangefamily/APP-ORANGEFAMILY
carpeta pública APK   /var/www/family.orangedesk.net/downloads/android/
DB producción         orangefamily_app_prod
servicio backend      orangefamily-backend.service
tabla releases        public.application_releases
```

## 30. Seguridad

Este runbook puede contener IP pública, rutas, usuario SSH, nombre de la clave local y dominios.

No debe contener secretos reales: claves privadas, passwords, keystore, tokens, cookies o credenciales.

## 31. Fuente de verdad

- Git → código.
- `build.gradle.kts` → versión de la build.
- APK firmada → artefacto ejecutable.
- `/var/www/family.orangedesk.net/downloads/android/` → almacenamiento público actual.
- `public.application_releases` → release anunciada como vigente.
- `Ajustes → Descargas` → interfaz de publicación.
- `GET /api/app-releases/android/latest` → contrato de consulta de release vigente.

Si estos elementos no coinciden, la publicación no se considera cerrada.
