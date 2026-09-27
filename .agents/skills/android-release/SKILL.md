# OrangeFamily Android release

Fuente canónica: `docs/40-features/orange-photos/ANDROID_RELEASE_WORKFLOW.md`.

Esta skill cubre únicamente el ciclo de release, no el desarrollo Android:

1. Preflight: `main` limpio y actualizado, SHA conocido, `applicationId`, versión, HTTPS, keystore y alias configurados sin imprimir secretos.
2. Validación pre-build y post-build separadas: tests/debug, `assembleDebug`, release build; después `apkanalyzer`/`apksigner` sobre el APK para package, versión, firma y SHA-256. Si faltan herramientas, el resultado es BLOCKED.
3. Inmutabilidad: BUILD ONCE → TEST THAT APK → PUBLISH THAT EXACT APK.
4. ADB autorizado: SDK desde `local.properties`, dispositivo `device`, `install -r`, sin desinstalar.
5. Publicación y registro separados: solo con `publish_android_release` y `register_android_release` autorizados.
6. Verificación posterior: contrato `GET /api/app-releases/android/latest` y hashes local/remoto.

Operaciones sensibles requieren autorización individual. Si falta mecanismo externo documentado, detenerse en `READY_TO_PUBLISH` o `READY_TO_REGISTER`; no inventar SSH, rutas ni credenciales. Un conflicto de firma, hash, versión, branch, estado Git o autenticación es `HARD_STOP`.
