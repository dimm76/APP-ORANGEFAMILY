# Familiares, invitación y recuperación de contraseña

## Alcance

El propietario de una familia (`family_memberships.role = 'owner'`) administra sus familiares. Los familiares usan el rol `member`. No existe registro público ni permisos configurables por módulo.

Un `owner` con membership activa conserva el acceso completo actual. Un `member` necesita membership activa y `auth_users.status = 'active'`; en esta primera versión solo puede acceder a OrangePhotos. Wiki, Attachments, Ajustes y los demás módulos permanecen reservados al propietario tanto en la interfaz como en la API.

## Administración

Rutas autenticadas y exclusivas del `owner`:

- `GET /api/settings/family-members`: lista los familiares de la familia obtenida de la sesión.
- `POST /api/settings/family-members`: crea persona, membership `member` y, si se solicita acceso, cuenta pendiente e invitación.
- `PATCH /api/settings/family-members/:personId`: modifica los campos permitidos, el estado de membership y el acceso.
- `POST /api/settings/family-members/:personId/resend-invitation`: invalida invitaciones anteriores y genera una nueva.
- `POST /api/settings/family-members/:personId/send-password-reset`: solicita recuperación para una cuenta activa.

El propietario no puede editarse ni desactivarse desde esta funcionalidad. El backend obtiene usuario, familia y rol exclusivamente de la sesión y comprueba el ownership del recurso.

## Activación y recuperación

Rutas públicas:

- `POST /api/auth/activate`: acepta un token de activación y una contraseña de al menos 10 caracteres.
- `POST /api/auth/forgot-password`: siempre devuelve la misma respuesta, exista o no la cuenta.
- `POST /api/auth/reset-password`: acepta un token de recuperación y una contraseña de al menos 10 caracteres.

Los tokens se generan aleatoriamente y PostgreSQL almacena únicamente su SHA-256. Las invitaciones caducan en 48 horas y las recuperaciones en 60 minutos. Activación y reset son transaccionales; el reset revoca todas las sesiones anteriores. La activación no inicia sesión automáticamente.

La migración `docs/30-database/migration/20260724180000_auth_activation_tokens.sql` añade `public.auth_activation_tokens`. La recuperación reutiliza `public.auth_password_reset_tokens`.

## Correo SMTP

El backend usa `nodemailer` y estas variables:

```text
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
MAIL_FROM
APP_PUBLIC_URL
```

`APP_PUBLIC_URL` se usa para construir `/activate?token=...` y `/reset-password?token=...`. Los tokens y las URLs completas con token no se registran. En desarrollo, si SMTP no está configurado, el envío se omite con un log sin datos sensibles; en producción se considera un error de envío.

## Auditoría

Las operaciones registran los eventos aplicables en `audit_logs`: `family_member_created`, `family_member_updated`, `family_member_access_enabled`, `family_member_access_disabled`, `activation_sent`, `password_reset_requested` y `password_reset_completed`. No se almacenan tokens ni contraseñas en la auditoría.

> `docs/10-architecture/API.md` y `docs/10-architecture/DATABASE.md` siguen desactualizados y requieren una tarea documental independiente. Para el estado vigente se usa `docs/20-development/API_AND_AUTH_STATUS.md`, el código y las migraciones existentes.
