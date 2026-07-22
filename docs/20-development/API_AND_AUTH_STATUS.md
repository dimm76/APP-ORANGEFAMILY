# API and Authentication Status

## Estado actual

OrangeFamily dispone de una API Node CommonJS conectada a su PostgreSQL propio y de una implementación inicial de autenticación mediante sesiones.

La implementación utiliza exclusivamente el modelo propio definido en la migración `20260722120000_initial_identity_and_auth.sql`. No depende de lógica de negocio ni de tablas de otros productos.

> Nota documental: `docs/10-architecture/API.md` y `docs/10-architecture/DATABASE.md` contienen referencias de estado desactualizadas. Requieren una actualización documental posterior, fuera de esta tarea.

---

## Arquitectura implementada

```text
React / futura aplicación Android
  → API Node
  → PostgreSQL
```

React y los demás clientes deben consumir únicamente la API Node.

## Endpoints de autenticación

### `POST /api/auth/login`

Recibe un cuerpo JSON con `email` y `password`. Si las credenciales son válidas, crea una sesión y devuelve el usuario autorizado junto con sus datos de persona y memberships familiares activas.

La sesión se entrega mediante la cookie `of_session`, configurada con `HttpOnly`, `SameSite=Lax`, `Path=/`, expiración y `Secure` en producción o cuando `SESSION_COOKIE_SECURE=true`.

### `POST /api/auth/logout`

Revoca la sesión identificada por la cookie y elimina `of_session` del cliente. La respuesta no revela si la sesión ya había expirado o sido revocada.

### `GET /api/auth/me`

Devuelve el usuario de la sesión vigente. Responde `401` cuando no existe una sesión válida.

## Identidad y acceso familiar

La identidad autenticada sigue esta relación:

```text
auth_users.person_id
  → persons
  → family_memberships
  → families
```

Los roles familiares proceden de `family_memberships.role`. No existe ni se utiliza una tabla `profiles`.

La respuesta pública limita los datos a identificador, email, estado, identidad básica de la persona y familias activas con su rol. No devuelve hashes, tokens ni campos internos de sesión.

## Seguridad implementada

- Contraseñas con `scrypt` nativo de Node y formato versionado.
- Tokens de sesión aleatorios; PostgreSQL almacena únicamente su hash SHA-256.
- Consultas parametrizadas.
- Respuesta genérica ante credenciales incorrectas.
- Bloqueo temporal tras ocho intentos fallidos.
- Sesiones revocables y con expiración configurable.
- Auditoría best-effort de login correcto, login fallido y logout.
- Validación de usuario activo, bloqueo, expiración y revocación en cada sesión.

## Bootstrap del propietario inicial

`npm run bootstrap-admin` crea o actualiza transaccionalmente:

- el `auth_user` activo y verificado;
- su `person` activa;
- una `family` activa;
- una `family_membership` activa con rol `owner`.

Las variables requeridas están documentadas en `backend/.env.example`. El script no imprime contraseñas ni hashes.

## Pendiente

- Integrar una vista React de login y estado de sesión.
- Definir autorización por recurso para futuros dominios funcionales.
- Revisar CORS, proxy de confianza, HTTPS y configuración final de cookies antes de producción.
- Actualizar los estados generales desactualizados de `API.md` y `DATABASE.md` en una tarea documental posterior.
