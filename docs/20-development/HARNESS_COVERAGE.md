# Docs → harness coverage

Esta matriz relaciona invariantes documentales con mecanismos ejecutables. La documentación enlazada sigue siendo la fuente de verdad; el harness selecciona controles y exige autorización/evidencia, pero no copia su contenido.

| Fuente | Regla/invariante | Activación | Skill | Gate/check | Autorización/HARD_STOP | Estado |
|---|---|---|---|---|---|---|
| `docs/10-architecture/RULES.md`, `API.md` | React y Android consumen Node; Node valida acceso | `api-contract`, API/backend | `orangefamily-frontend`, `orangefamily-backend`, `orangefamily-android` | API/Android checks, boundaries | contrato compartido; boundary incompleta = FAIL | ENFORCED (checks); decisiones = AGENT-GUIDED |
| `docs/10-architecture/DATABASE.md` | migraciones versionadas, permisos y producción separada | `docs/30-database/migration/**`, `database/**` | `orangefamily-database` | `migration-schema-check` | `database.migrate_production`, backup; producción no autorizada = HARD_STOP | ENFORCED (estructura); permisos/backup = MANUAL/AUTHORIZED |
| `docs/10-architecture/UI-STYLE-GUIDE.md` | patrones/tokens existentes | CSS/JSX/TSX/UI guide | `orangefamily-design-system` | UI + visual evidence | validación visual requerida por contrato | AGENT-GUIDED + MANUAL/AUTHORIZED (percepción visual) |
| `docs/20-development/SECURITY_AND_DATA_PROTECTION.md` | auth, ownership, secretos, privacidad | rutas/permiso/upload/storage/secretos | `security-gate` | security-risk | riesgo significativo = Security Reviewer | ENFORCED (clasificación); revisión = AGENT-GUIDED |
| `docs/40-features/orange-photos/ANDROID_RELEASE_WORKFLOW.md` | build trazable, APK inmutable, hashes, ADB | release contract/Android release | `android-release` | `android-release-check`, Gradle gates | publish/register/ADB autorizados; mismatch = HARD_STOP | ENFORCED (preflight/hash); publicación = MANUAL/AUTHORIZED |
| `docs/50-operations/*` | producción separada, systemd y checklist | deploy/production/workflow | `git-delivery`, `security-gate` | scope/security | VPS/deploy/restart explícitos | MANUAL/AUTHORIZED |
| `docs/20-development/*` | cambios y decisiones mantienen docs canónicas | impacto semántico/documental | `documentation-maintenance` | `docs-impact`, completion | faltante o contradicción = FAIL | ENFORCED (impacto/evidencia) |

Las reglas de producto, almacenamiento, Android operativo y release permanecen en sus documentos canónicos para evitar duplicación. Si una regla requiere cambiar código o arquitectura, el harness la marca como follow-up/HARD_STOP en vez de inventar una implementación.
