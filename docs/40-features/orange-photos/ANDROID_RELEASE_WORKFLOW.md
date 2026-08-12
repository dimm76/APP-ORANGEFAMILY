# Workflow de release Android — OrangeFamily

Este documento define el procedimiento obligatorio para crear, validar, firmar, instalar y publicar una versión Android de OrangeFamily. Ninguna APK release se publica desde cambios no trazables.

## 1. Fuentes de verdad

- Código: Git, rama `main`.
- Versión compilada: `mobile/orange-photos-sync-agent/app/build.gradle.kts`.
- Release registrada: PostgreSQL, tabla `application_releases`.
- Binario: APK publicada en la URL HTTPS configurada.
- Estado instalado: paquete consultado mediante ADB.

`application_releases` no sustituye a Git. Toda versión registrada debe proceder de un commit conocido de `main`.

## 2. Reglas de trazabilidad obligatorias

1. Nunca compilar desde cambios sin commit ni desde una rama funcional pendiente.
2. Nunca publicar versiones no registradas en Git.
3. La APK definitiva se compila únicamente desde `main` limpio y actualizado.
4. Registrar el SHA exacto antes de compilar.
5. `versionCode` y `versionName` publicados deben coincidir con la APK.
6. Publicar exactamente la APK probada y conservar su SHA-256.
7. Nunca regenerar el keystore.

## 3. Preparación del entorno

Repositorio habitual: `C:\Users\dimm7\local-sites\APP-ORANGEFAMILY`.
Proyecto: `C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent`.
Las rutas pueden variar y no deben codificarse en la aplicación.

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

## 4. SDK Android y ADB

`local.properties` es local, no se versiona y puede regenerarse. Leer siempre `sdk.dir`:

```powershell
Get-Content .\mobile\orange-photos-sync-agent\local.properties | Select-String "^sdk\.dir="
$adb = "<sdk.dir>\platform-tools\adb.exe"
& $adb devices
```

La configuración comprobada es `C:\Users\dimm7\AppData\Local\Android\Sdk`. No asumir que ADB está en `PATH`.

## 5. Inicio de desarrollo

```powershell
git switch main
git pull --ff-only origin main
git status --short
git switch -c <tipo>/<nombre>
```

El working tree debe estar limpio. No implementar directamente sobre `main`.

## 6. Desarrollo mínimo

Modificar solo archivos necesarios, no mezclar versionado con desarrollo funcional, ejecutar checks y revisar `git diff --check` y `git status --short`.

## 7. Commit y push funcional

```powershell
git diff --check; git status --short; git add <archivos>; git commit -m "<mensaje>"; git push -u origin <rama>
```

No generar aquí la APK release definitiva.

## 8. Revisión previa a release

Revisar diff contra `main`, archivos, tests, build, scope, secretos, UTF-8 y pruebas funcionales. No continuar con errores conocidos.

## 9. Determinación de versión

Comprobar `build.gradle.kts`, Ajustes > Descargas o `application_releases`, y el dispositivo:

```powershell
& $adb shell dumpsys package com.orangefamily.photossync | Select-String "versionCode|versionName"
```

El nuevo `versionCode` debe ser superior al distribuido y nunca reutilizarse. Si Git, dispositivo y registro discrepan, detener y alinear primero.

## 10. Actualización de versión

Modificar solo `versionCode` y `versionName` en `mobile/orange-photos-sync-agent/app/build.gradle.kts`. El cambio debe estar committeado antes del build definitivo.

## 11. Integración en main

Tras aprobar la rama, ejecutar `git switch main`, `git pull --ff-only origin main`, `git status --short` y `git log -1 --oneline`. Registrar el SHA. La APK definitiva sale de este `main` limpio.

## 12. Configuración release

```text
Application ID: com.orangefamily.photossync
API: https://family.orangedesk.net/
Keystore: C:\Users\dimm7\orangefamily-secrets\orangefamily-release.jks
Alias: orangefamily
Gradle properties: C:\Users\dimm7\.gradle\gradle.properties
```

Propiedades: `orangeFamily.releaseApiBaseUrl`, `orangeFamily.keystoreFile`, `orangeFamily.keystorePassword`, `orangeFamily.keyAlias` y `orangeFamily.keyPassword`. Nunca documentar contraseñas o secretos. No cambiar alias, `applicationId` ni regenerar el keystore.

## 13. Verificación previa

```powershell
Test-Path "C:\Users\dimm7\orangefamily-secrets\orangefamily-release.jks"
```

El `build.gradle.kts` valida la configuración release.

## 14. Tests

Desde `mobile/orange-photos-sync-agent`: `./gradlew.bat :app:testDebugUnitTest --no-configuration-cache` y `./gradlew.bat :app:assembleDebug --no-configuration-cache`. Después revisar `git diff --check` y `git status --short`.

## 15. Build release

Desde `mobile/orange-photos-sync-agent`, ejecutar `./gradlew.bat clean assembleRelease --no-configuration-cache`. La salida es `app\build\outputs\apk\release\app-release.apk`; solo `BUILD SUCCESSFUL` valida el build.

## 16. Verificación de APK

Comprobar fichero, package, versiones, certificado y SHA-256 con `apkanalyzer`/`apksigner` del SDK y:

```powershell
Get-FileHash ".\app\build\outputs\apk\release\app-release.apk" -Algorithm SHA256
```

Package, versiones y firma deben coincidir con Git y el keystore esperado.

## 17. Dispositivo

`& $adb devices` debe mostrar un dispositivo en estado `device`, nunca `unauthorized` u `offline`. Registrar la versión anterior con `dumpsys package`.

## 18. Instalación

No desinstalar. Ejecutar `& $adb install -r ".\app\build\outputs\apk\release\app-release.apk"`. La misma firma y un `versionCode` válido conservan sesión, Room, preferencias y datos locales. Ante firma incompatible, detenerse.

## 19. Verificación posterior

Comprobar de nuevo package y versiones. Abrir la app y probar inicio, sesión, producción, biblioteca local, biblioteca cloud, sincronización y funcionalidad modificada. No publicar antes de validar la APK instalada.

## 20. Publicación

Usar exactamente el fichero probado; no regenerarlo. Renombrar como `orangefamily-<versionName>.apk`, sin cambiar bytes, copiarlo al almacenamiento HTTPS y registrar nombre, URL y SHA-256.

## 21. Verificación remota

Descargar la APK publicada y comparar su `Get-FileHash <apk-descargada> -Algorithm SHA256` con el hash local. Si difiere, no registrar la release.

## 22. application_releases

Solo después de build, firma, instalación, pruebas, publicación y hash remoto, registrar en Ajustes > Descargas: `version_code`, `version_name`, `file_name`, `download_url` y `release_notes`.

## 23. Comprobación final

En Ajustes > Descargas verificar versiones, nombre, notas y enlace; descargar desde la URL publicada y confirmar que es el mismo APK.

## 24. Trazabilidad

Conservar fecha, SHA de `main`, versiones, nombre, SHA-256, URL, dispositivo, versión previa, tests, build, instalación y pruebas manuales. Debe poder responderse de qué commit exacto salió cada APK.

## 25. Flujo resumido obligatorio

```text
main limpio → rama → desarrollo → tests → commit + push → revisión → versión
→ versionCode/versionName → commit release → integrar main → main limpio + SHA
→ tests → assembleRelease → package/version/firma/hash → adb install -r
→ pruebas → publicar EL MISMO APK → hash remoto → application_releases
→ comprobación final → release cerrada
```

## 26. Detener la release si

El working tree está sucio, `main` desactualizado, hay código sin commit, las fuentes de versión discrepan, `versionCode` es inválido, package/versión/firma son incorrectos, ADB está `unauthorized`/`offline`, se requiere desinstalar, el hash remoto difiere, el registro es incoherente, fallan tests/build, hay mojibake/UTF-8 corrupto o aparecen secretos.

## 27. Discrepancia observada el 12/08/2026

Sin modificar estos estados en esta tarea:

```text
Git main: 1.3.0 / versionCode 6
APK instalada por ADB: 1.3.0 / versionCode 6
Ajustes > Descargas: 1.4.0 / versionCode 7
```

Las fuentes están desalineadas. No generar APK nueva, cambiar versiones a ciegas ni sobrescribir `application_releases`; verificar el APK publicado, identificar su código de origen y alinear Git/documentación antes de la próxima release. No se afirma qué estado debe corregirse: requiere tarea separada.
