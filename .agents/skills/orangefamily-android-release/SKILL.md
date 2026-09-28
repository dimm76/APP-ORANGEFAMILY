# OrangeFamily Android release

Use this skill for every task involving an Android APK: test build, signed build, ADB install, version bump, release build, publication, server upload, hash verification, or `application_releases`.

Canonical procedure: `docs/40-features/orange-photos/ANDROID_RELEASE_WORKFLOW.md`. Read it before acting.

## Mandatory two-phase flow

### Phase A — signed test APK

The functional branch must already be committed, pushed, remotely reviewed, and approved.

Do not change `versionCode` or `versionName` before physical validation.

Build a signed `release` APK from the exact approved functional SHA, using the current published version and the production API. The purpose is to test the real signing, permissions, storage, networking, update path, and production integration without consuming a new version.

Always run `clean assembleRelease`; never trust an APK already present under `app/build/outputs`.

Verify the APK package, embedded version, signature, and SHA-256 before installation.

Install only with `adb install -r`. Never use `-d`, never uninstall to bypass a signature/version error, and never clear application data.

The test APK is local-only. Never upload it to the public server and never update `application_releases`.

If physical testing fails, correct the same functional branch, commit/push, review again, rebuild another signed test APK with the same current published version, and repeat. Do not bump versions while iterating.

A version bump is allowed only after the user explicitly confirms that the physical tests passed.

### Phase B — final publishable APK

After explicit physical approval, determine the next version from the current published metadata and device state. The new `versionCode` must be strictly greater than the published one.

Change only the Android version fields, commit the version change, review it, fast-forward the approved branch to `main`, and push `main`.

Build the final APK from a clean checkout/worktree of the exact `main` SHA. Run tests and `clean assembleRelease`, then verify package/version/signature/hash. Choose Route A for the standard final smoke or Route B when the explicit objective is end-to-end updater validation.

After the final APK passes, do not rebuild it. The exact tested bytes are the publication artifact.

#### Route A — standard final smoke

The normal Phase B route is:

```text
build definitivo desde main limpio
→ verificar package/version/firma/hash
→ adb install -r
→ smoke
→ no recompilar
→ publicar exactamente ese binario
→ verificar hashes
→ registrar la release
```

#### Route B — updater end-to-end validation

Use this route only when the explicit goal is to validate the real update
mechanism. Phase A must already have validated the functionality physically
with a signed release APK using the currently published version.

In this route, do **not** run `adb install -r` on the final APK before
publication. Keep the device on the previous published version and:

```text
build definitivo desde main limpio
→ verificar package/version/firma/SHA
→ publicar exactamente ese APK
→ verificar los cuatro hashes
→ registrar la nueva release
→ abrir la versión anterior
→ comprobar versionCode superior y la modal
→ Descargar actualización desde la app
→ comprobar descarga HTTPS e instalación Android
→ comprobar persistencia y versión final
→ comprobar que la misma release ya no se ofrece
```

`adb install -r` no debe ejecutarse sobre el APK final antes de esta prueba,
porque invalidaría la detección de actualización. Después de la instalación
realizada por Android, ADB solo puede usarse para consultas de lectura, por
ejemplo `dumpsys package`.

La instalación correcta no basta para aprobar esta ruta. Antes de actualizar
se deben registrar la sesión autenticada, la política de red, el estado del
agente y algún estado Room reconocible. Después deben conservarse la sesión
sin pedir login, la biblioteca local, la política de red, el estado del
agente, la configuración/baselines/inventario/estados de sincronización Room,
la operación normal, la versión registrada y el indicador de aplicación
actualizada. Si falla cualquiera, falla la validación end-to-end.

La persistencia relevante comprende `SecureSessionStore` (SharedPreferences
cifradas + AndroidKeyStore), `UploadNetworkPolicyStore` (SharedPreferences) y
`OrangePhotosLocalDatabase` (Room: configuración, baselines, inventario local,
estados de sincronización, sesiones multipart y demás estado persistente). Una
actualización del mismo `applicationId` y firma no debe borrar esos datos.
Durante la validación siguen prohibidos `uninstall`, `pm clear`, borrar datos,
`-d`, regenerar el keystore o cambiar el `applicationId`.

## Local environment

- Repository: `C:\Users\dimm7\local-sites\APP-ORANGEFAMILY`
- Android project: `C:\Users\dimm7\local-sites\APP-ORANGEFAMILY\mobile\orange-photos-sync-agent`
- JBR: `C:\Program Files\Android\Android Studio\jbr`
- SDK: `C:\Users\dimm7\AppData\Local\Android\Sdk`
- ADB: `C:\Users\dimm7\AppData\Local\Android\Sdk\platform-tools\adb.exe`
- Release keystore: `C:\Users\dimm7\orangefamily-secrets\orangefamily-release.jks`
- Application ID: `com.orangefamily.photossync`
- Release API: `https://family.orangedesk.net/`

Never expose Gradle signing passwords or regenerate the keystore.

## Production APK server

- SSH: `ubuntu@141.95.179.205`
- SSH key: `$env:USERPROFILE\.ssh\orangedesk-prod-2026`
- Temporary upload: `/tmp/orangefamily-<version>.apk`
- Published directory: `/var/www/family.orangedesk.net/downloads/android/`
- Public URL: `https://family.orangedesk.net/downloads/android/orangefamily-<version>.apk`

Published APK permissions are `0644`; preserve the established ownership convention. If the server differs from the documented convention, stop instead of silently changing it.

Publication is not performed by the normal GitHub production deploy workflow.

## Hash invariant

Before registration, these four SHA-256 values must be identical:

1. local final APK;
2. `/tmp` copy on the VPS;
3. published VPS file;
4. file downloaded again through the public HTTPS URL.

A mismatch stops the release.

## Registration

Register only after the public HTTPS file exists and its hash matches.

Preferred UI: `Ajustes → Descargas → Publicación Android`.

Fields:

- `version_code`
- `version_name`
- `file_name`
- `download_url`
- `release_notes`

The UI calls `PUT /api/settings/app-releases/android/latest`; Node writes `public.application_releases` and its audit log. Do not update the table manually during the normal release workflow.

## Agent/user interaction

Execute routine shell/Git/Gradle/ADB/SSH steps yourself when authorized and available. Do not use the user as a terminal relay.

When the user must run a local command, never assume shell state. Start the block with the exact `cd`, then define required variables such as `$adb`, and provide complete copy/paste commands.

For physical validation, tell the user only the concrete app actions and expected results. Do not bump or publish while waiting for the user's result.

If `adb install -r` reports a downgrade, signature mismatch, unauthorized/offline device, or unexpected package/version, stop. Never use a bypass flag or uninstall the app.
