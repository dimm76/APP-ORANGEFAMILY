# Despliegue de OrangeFamily en producción

## Infraestructura

OrangeFamily se ejecuta en un VPS Ubuntu sin Plesk. La infraestructura de
producción actualmente configurada es:

- Host IPv4 del VPS: `141.95.179.205`.
- Usuario de despliegue por SSH: `ubuntu`.
- Repositorio: `/opt/orangefamily/APP-ORANGEFAMILY`.
- Rama desplegada: `main`.
- Frontend publicado: `/var/www/family.orangedesk.net/html`.
- Backend: `/opt/orangefamily/APP-ORANGEFAMILY/backend`.
- Servicio systemd: `orangefamily-backend.service`.
- Puerto interno del backend: `4200`.
- Dominio público: `https://family.orangedesk.net`.

Nginx sirve los archivos estáticos del frontend y reenvía las peticiones a
`/api/` al backend en `127.0.0.1:4200`. El despliegue no modifica la
configuración de Nginx ni reinicia ese servicio.

El DNS del dominio debe mantener un registro `A` hacia `141.95.179.205`. No se
documenta una dirección IPv6 concreta porque no se ha proporcionado ninguna.
Solo debe existir un registro `AAAA` si el VPS tiene una IPv6 asignada y
validada para este servicio.

## PostgreSQL y variables de entorno

La base de datos de producción es `orangefamily_app_prod` y su usuario es
`orangefamily_app_user`. Las contraseñas no se almacenan en este documento ni
en el workflow.

El archivo de entorno del backend ya existe en:

```text
/opt/orangefamily/APP-ORANGEFAMILY/backend/.env
```

El despliegue comprueba que exista, pero nunca lo sobrescribe, elimina,
imprime ni copia. Las migraciones de PostgreSQL se revisan y ejecutan
manualmente; el despliegue automático no ejecuta SQL ni modifica la base de
datos.

## Despliegue automático

El workflow `.github/workflows/deploy-production.yml`, denominado
`Deploy OrangeFamily Production`, se ejecuta con cada push a `main` y también
puede iniciarse manualmente mediante `workflow_dispatch`.

Primero valida el commit en GitHub Actions con Node.js 24 LTS:

1. Ejecuta `npm ci` y `npm run build` en la raíz.
2. Ejecuta `npm ci` en `backend`.

El lint global no forma parte del despliegue porque sus incompatibilidades
con el backend CommonJS se resolverán en otra tarea.

Superada la validación, el workflow conecta por SSH y:

1. Comprueba el repositorio, la rama `main` y la existencia de `backend/.env`.
2. Ejecuta `git fetch origin main` y `git reset --hard origin/main`.
3. Instala dependencias y compila el frontend.
4. Sincroniza `dist/` con el directorio público mediante
   `rsync -a --delete`.
5. Instala las dependencias del backend.
6. Reinicia exclusivamente `orangefamily-backend.service`.
7. Comprueba el servicio y el healthcheck local.

La concurrencia impide que dos despliegues de producción se ejecuten a la
vez. Un despliegue en curso no se cancela cuando llega otro.

### Secrets de GitHub

El repositorio necesita estos secrets:

- `PROD_SSH_HOST`: host del VPS.
- `PROD_SSH_USER`: usuario SSH.
- `PROD_SSH_PRIVATE_KEY`: clave privada de despliegue.
- `PROD_APP_PATH`: ruta absoluta del repositorio en el VPS.
- `PROD_FRONTEND_PATH`: ruta absoluta donde Nginx sirve el frontend.

Los valores configurados deben corresponder con las rutas y el host descritos
en este documento.

### Requisito de sudo

El usuario `ubuntu` debe tener permiso no interactivo para reiniciar y
consultar exclusivamente `orangefamily-backend.service`. La configuración de
sudoers debe prepararse manualmente y no forma parte del workflow. Como mínimo,
las operaciones usadas son:

```bash
sudo systemctl restart orangefamily-backend.service
sudo systemctl is-active --quiet orangefamily-backend.service
```

## Despliegue manual

Antes de desplegar, confirmar que el commit deseado está en `main`, que
`backend/.env` existe y que no hay migraciones pendientes que deban ejecutarse
manualmente. Después, desde GitHub Actions, seleccionar
`Deploy OrangeFamily Production` y usar **Run workflow** sobre `main`.

Si GitHub Actions no está disponible, un administrador puede reproducir por
SSH las mismas comprobaciones y comandos documentados en el workflow. No debe
usar `git clean -fd`, modificar `backend/.env` ni ejecutar migraciones como
parte de ese procedimiento.

## Comprobaciones y diagnóstico

Healthcheck local desde el VPS:

```bash
curl --fail --silent --show-error http://127.0.0.1:4200/api/health
```

Estado y logs del backend:

```bash
sudo systemctl status orangefamily-backend.service
sudo journalctl -u orangefamily-backend.service --since "30 minutes ago"
sudo journalctl -u orangefamily-backend.service -f
```

También debe comprobarse el dominio público:

```bash
curl --fail --silent --show-error https://family.orangedesk.net/api/health
```

## Rollback básico

El rollback recomendado consiste en revertir en Git el commit problemático,
subir el nuevo commit de reversión a `main` y dejar que el workflow despliegue
ese estado trazable.

En una emergencia, un administrador puede desplegar temporalmente un commit
anterior en el VPS, reconstruir frontend y backend y reiniciar el mismo
servicio. Debe tener presente que el siguiente despliegue volverá a igualar el
servidor con `origin/main`. Los cambios de esquema no se revierten
automáticamente y requieren un procedimiento manual específico.

## Convivencia en el VPS

Los servicios comparten VPS, pero se mantienen separados:

- OrangeDesk: puerto `4000`.
- OrangeTraining staging: puerto `4100`.
- OrangeFamily producción: puerto `4200`.

El despliegue de OrangeFamily no modifica ni reinicia OrangeDesk,
OrangeTraining, Nginx o el servidor.

---

# Procedimiento uniforme de despliegue y migraciones

## Propósito

Este apartado establece el proceso obligatorio para desplegar cambios de OrangeFamily en producción.

Debe aplicarse siempre que un cambio afecte a alguno de estos elementos:

- frontend;
- backend;
- dependencias;
- base de datos;
- migraciones;
- permisos PostgreSQL;
- configuración del servicio;
- variables de entorno.

El objetivo es evitar que el código, la base de datos y los permisos queden desalineados.

## Infraestructura real de producción

### Repositorio

```text
/opt/orangefamily/APP-ORANGEFAMILY
```

### Frontend

El frontend se instala y construye desde:

```text
/opt/orangefamily/APP-ORANGEFAMILY
```

### Backend

El backend se ejecuta desde:

```text
/opt/orangefamily/APP-ORANGEFAMILY/backend
```

### Servicio

OrangeFamily utiliza `systemd`.

Servicio oficial:

```text
orangefamily-backend.service
```

Archivo de unidad:

```text
/etc/systemd/system/orangefamily-backend.service
```

Override:

```text
/etc/systemd/system/orangefamily-backend.service.d/override.conf
```

El servicio utiliza:

```text
WorkingDirectory=/opt/orangefamily/APP-ORANGEFAMILY/backend
EnvironmentFile=/opt/orangefamily/APP-ORANGEFAMILY/backend/.env
ExecStart=/usr/bin/npm start
User=ubuntu
```

Directorio temporal configurado:

```text
TMPDIR=/var/tmp/orangefamily
```

### Puerto del backend

```text
127.0.0.1:4200
```

### Base de datos

```text
orangefamily_app_prod
```

### Rol PostgreSQL de ejecución

```text
orangefamily_app_user
```

El backend debe acceder a PostgreSQL mediante este rol restringido.

### Gestor de procesos

OrangeFamily no utiliza PM2.

No usar:

```bash
pm2 restart all
pm2 logs
```

Usar siempre:

```bash
sudo systemctl restart orangefamily-backend.service
sudo systemctl status orangefamily-backend.service --no-pager
sudo journalctl -u orangefamily-backend.service
```

## Regla fundamental

El código que dependa de una migración no puede considerarse desplegado hasta que se hayan completado todas estas fases:

1. migración aplicada;
2. esquema verificado;
3. permisos concedidos;
4. acceso probado con el rol real del backend;
5. backend reiniciado;
6. healthcheck correcto;
7. endpoint afectado probado;
8. interfaz validada;
9. logs revisados.

Una migración no está terminada únicamente porque PostgreSQL muestre:

```text
CREATE TABLE
ALTER TABLE
CREATE INDEX
COMMIT
```

También debe confirmarse que `orangefamily_app_user` puede utilizar los objetos creados.

## Clasificación de los despliegues

Antes de iniciar el despliegue debe determinarse cuál de estos casos corresponde.

### Solo frontend

Se aplica cuando únicamente han cambiado archivos del frontend y no existen cambios en:

- backend;
- dependencias del backend;
- migraciones;
- configuración del servicio.

Procedimiento:

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY

git pull --ff-only origin main

npm ci
npm run build
```

Validar:

- build correcto;
- versión publicada;
- navegación;
- funcionalidad afectada;
- responsive cuando proceda.

No reiniciar el backend si no ha cambiado.

### Backend sin migración

Se aplica cuando cambia Node, pero no cambia el esquema PostgreSQL.

Procedimiento:

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY

git pull --ff-only origin main

cd backend
npm ci
```

Reiniciar:

```bash
sudo systemctl restart orangefamily-backend.service
```

Comprobar:

```bash
sudo systemctl status \
  orangefamily-backend.service \
  --no-pager
```

Healthcheck:

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:4200/api/health
```

Logs:

```bash
sudo journalctl \
  -u orangefamily-backend.service \
  --since "10 minutes ago" \
  --no-pager \
  -o cat
```

También debe probarse el endpoint o flujo modificado.

### Backend con migración

Se aplica cuando el código nuevo depende de:

- tablas nuevas;
- columnas nuevas;
- índices;
- restricciones;
- vistas;
- funciones;
- cambios en relaciones;
- cambios en permisos.

Debe seguirse el procedimiento completo descrito a continuación.

# Procedimiento obligatorio para despliegues con migración

## 1. Preparación antes del commit

Las migraciones deben almacenarse en:

```text
docs/30-database/migration/
```

Antes de aceptar una migración deben identificarse explícitamente:

- tablas creadas;
- columnas añadidas o modificadas;
- índices;
- restricciones;
- claves foráneas;
- secuencias;
- vistas;
- funciones;
- datos transformados;
- objetos eliminados;
- permisos necesarios;
- compatibilidad con los datos existentes;
- riesgo de bloqueo;
- necesidad de backup;
- procedimiento de recuperación.

Cuando las operaciones lo permitan, la migración debe:

- utilizar `BEGIN`;
- utilizar `COMMIT`;
- evitar operaciones destructivas;
- utilizar `IF EXISTS` o `IF NOT EXISTS` cuando sea razonable;
- mantener cambio mínimo;
- no modificar objetos ajenos al alcance;
- fallar de forma explícita si encuentra un estado inválido.

## 2. Permisos incluidos en la revisión

Toda migración que cree objetos debe incluir una sección explícita de revisión de privilegios.

No se debe asumir que los objetos creados por `postgres` serán accesibles automáticamente desde el backend.

El rol operativo es:

```text
orangefamily_app_user
```

Como regla general:

### Tablas utilizadas por la aplicación

```sql
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.nombre_tabla
TO orangefamily_app_user;
```

### Tablas de solo lectura

```sql
GRANT SELECT
ON TABLE public.nombre_tabla
TO orangefamily_app_user;
```

### Secuencias

Cuando existan columnas basadas en secuencias:

```sql
GRANT USAGE, SELECT, UPDATE
ON SEQUENCE public.nombre_secuencia
TO orangefamily_app_user;
```

### Funciones

Cuando el backend deba ejecutar una función PostgreSQL:

```sql
GRANT EXECUTE
ON FUNCTION public.nombre_funcion(...)
TO orangefamily_app_user;
```

### Esquema

El rol debe disponer de acceso al esquema:

```sql
GRANT USAGE
ON SCHEMA public
TO orangefamily_app_user;
```

No conceder privilegios innecesarios como:

- `SUPERUSER`;
- `CREATEDB`;
- `CREATEROLE`;
- `ALL ON DATABASE`;
- permisos globales sobre objetos ajenos a OrangeFamily.

Los privilegios deben limitarse a los objetos y operaciones que necesita la aplicación.

## 3. Validación local obligatoria

La migración debe probarse primero en local.

Ejemplo:

```bash
psql \
  -v ON_ERROR_STOP=1 \
  -d orangefamily_local \
  -f docs/30-database/migration/NOMBRE_MIGRACION.sql
```

`ON_ERROR_STOP=1` es obligatorio para detener la ejecución ante el primer error SQL.

Después deben verificarse:

- tablas;
- columnas;
- tipos;
- valores por defecto;
- restricciones;
- índices;
- claves foráneas;
- datos anteriores;
- permisos;
- endpoints afectados;
- validaciones de Node;
- interfaz dependiente.

Siempre que exista un rol local equivalente, debe probarse la consulta utilizando ese rol y no únicamente como `postgres`.

## 4. Actualización del repositorio en producción

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY

git status --short
git pull --ff-only origin main
git log -1 --oneline
```

Antes de continuar:

- el árbol de trabajo debe estar limpio;
- debe confirmarse el commit desplegado;
- deben identificarse las migraciones nuevas;
- debe comprobarse si han cambiado los archivos de dependencias;
- debe conocerse el orden exacto del despliegue.

Para revisar migraciones incorporadas por la actualización:

```bash
git diff HEAD@{1} -- docs/30-database/migration/
```

No ejecutar a ciegas todas las migraciones de la carpeta.

Aplicar únicamente las migraciones pendientes y en su orden cronológico.

## 5. Backup o punto de recuperación

Debe evaluarse un backup antes de ejecutar la migración cuando esta:

- modifica datos existentes;
- elimina columnas o tablas;
- cambia relaciones;
- altera claves;
- afecta a un volumen elevado;
- puede bloquear tablas;
- tiene una reversión compleja.

La decisión de no realizar backup también debe ser consciente y proporcional al riesgo.

## 6. Aplicación de la migración en producción

Ejecutar desde la raíz del proyecto:

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY
```

Aplicar:

```bash
sudo -u postgres psql \
  -v ON_ERROR_STOP=1 \
  -d orangefamily_app_prod \
  -f docs/30-database/migration/NOMBRE_MIGRACION.sql
```

No continuar si aparece cualquier error.

No reiniciar el backend hasta confirmar que:

- la migración terminó;
- el esquema es correcto;
- los permisos están aplicados.

## 7. Verificación del esquema

Para una tabla:

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "\d public.nombre_tabla"
```

Para verificar columnas:

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nombre_tabla'
ORDER BY ordinal_position;
"
```

Para comprobar que un objeto existe:

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "
SELECT to_regclass('public.nombre_tabla');
"
```

También deben verificarse las restricciones e índices relevantes.

## 8. Aplicación y verificación de permisos

Si la migración no contiene los `GRANT`, aplicarlos inmediatamente después.

Ejemplo para varias tablas:

```bash
sudo -u postgres psql -d orangefamily_app_prod <<'SQL'
GRANT USAGE
ON SCHEMA public
TO orangefamily_app_user;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE
  public.tabla_uno,
  public.tabla_dos
TO orangefamily_app_user;
SQL
```

Comprobar privilegios:

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'orangefamily_app_user'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;
"
```

La existencia de filas en `role_table_grants` debe corresponder con las operaciones reales realizadas por Node.

## 9. Prueba con el rol real de la aplicación

La validación como `postgres` no es suficiente.

Debe ejecutarse al menos una consulta como:

```text
orangefamily_app_user
```

Cuando `DATABASE_URL` esté disponible dentro de un entorno seguro:

```bash
psql "$DATABASE_URL" -c "
SELECT 1
FROM public.nombre_tabla
LIMIT 1;
"
```

No ejecutar previamente:

```bash
echo "$DATABASE_URL"
```

No copiar el valor de `DATABASE_URL`.

No pegar credenciales en documentación, tickets, informes o conversaciones.

La prueba debe cubrir las operaciones requeridas:

- lectura;
- inserción;
- actualización;
- eliminación;

según el uso real del objeto.

## 10. Instalación de dependencias

### Frontend

Cuando haya cambiado `package-lock.json`:

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY
npm ci
```

### Backend

Cuando haya cambiado `backend/package-lock.json`:

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY/backend
npm ci
```

No ejecutar instalaciones innecesarias si los archivos de dependencias no han cambiado, salvo que el proceso oficial de despliegue establezca lo contrario.

## 11. Construcción del frontend

Cuando existan cambios frontend:

```bash
cd /opt/orangefamily/APP-ORANGEFAMILY
npm run build
```

El build debe terminar correctamente antes de continuar.

Un aviso conocido y documentado no equivale a un error, pero no deben ignorarse avisos nuevos sin revisarlos.

## 12. Reinicio del backend

Comando oficial:

```bash
sudo systemctl restart orangefamily-backend.service
```

No utilizar PM2.

## 13. Estado del servicio

```bash
sudo systemctl status \
  orangefamily-backend.service \
  --no-pager
```

Debe confirmarse:

```text
active (running)
```

También debe comprobarse que no existe:

- bucle de reinicios;
- fallo inmediato;
- error al cargar variables;
- error de conexión PostgreSQL;
- problema con el directorio temporal.

## 14. Healthcheck

```bash
curl --fail --silent --show-error \
  http://127.0.0.1:4200/api/health
```

El healthcheck debe confirmar:

- backend operativo;
- conexión con PostgreSQL.

El healthcheck no sustituye la prueba funcional: puede ser correcto aunque un endpoint concreto falle por una tabla o permiso.

## 15. Prueba del endpoint afectado

Debe probarse expresamente el endpoint que utiliza el objeto modificado.

La prueba puede hacerse mediante:

- interfaz;
- navegador;
- `curl` autenticado;
- prueba de integración existente.

Debe verificarse:

- respuesta HTTP;
- datos devueltos;
- permisos;
- ownership;
- errores visibles;
- conservación de datos anteriores.

## 16. Validación visual

Cuando el cambio afecte al frontend, comprobar:

- escritorio;
- móvil;
- datos existentes;
- estados vacíos;
- estados con datos;
- errores;
- permisos de propietario;
- permisos de miembro;
- navegación de entrada y salida;
- ausencia de overflow.

## 17. Logs después del despliegue

Revisar:

```bash
sudo journalctl \
  -u orangefamily-backend.service \
  --since "10 minutes ago" \
  --no-pager \
  -o cat
```

Seguimiento en directo:

```bash
sudo journalctl \
  -u orangefamily-backend.service \
  -f \
  -o cat
```

No considerar terminado el despliegue si aparecen errores nuevos.

Deben buscarse especialmente:

```text
relation does not exist
permission denied
column does not exist
violates constraint
connection refused
ECONNREFUSED
INTERNAL_ERROR
```

## Criterio obligatorio de finalización

Un despliegue con migración solo puede cerrarse cuando se haya confirmado:

- [ ] repositorio actualizado;
- [ ] commit correcto;
- [ ] migración pendiente identificada;
- [ ] riesgo y backup evaluados;
- [ ] migración aplicada con `ON_ERROR_STOP=1`;
- [ ] esquema verificado;
- [ ] permisos concedidos;
- [ ] permisos verificados;
- [ ] acceso probado como `orangefamily_app_user`;
- [ ] dependencias instaladas si procede;
- [ ] frontend construido si procede;
- [ ] backend reiniciado mediante `systemd`;
- [ ] servicio activo;
- [ ] healthcheck correcto;
- [ ] endpoint afectado probado;
- [ ] prueba visual realizada;
- [ ] datos anteriores comprobados;
- [ ] logs sin errores nuevos;
- [ ] incidencia documentada si ha existido.

# Diagnóstico de incidencias de despliegue

## `relation does not exist`

Significa normalmente que:

- la migración no se aplicó;
- se aplicó en otra base de datos;
- el backend utiliza otra conexión;
- el nombre del objeto no coincide;
- una parte de la migración falló.

Comprobar:

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "
SELECT to_regclass('public.nombre_tabla');
"
```

## `permission denied for table`

Significa normalmente que:

- la tabla existe;
- fue creada por `postgres`;
- `orangefamily_app_user` no recibió privilegios suficientes.

Comprobar:

```bash
sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'nombre_tabla';
"
```

Aplicar únicamente los privilegios requeridos.

## `permission denied for sequence`

La tabla puede permitir inserciones, pero la secuencia utilizada por una columna no está autorizada.

Conceder:

```sql
GRANT USAGE, SELECT, UPDATE
ON SEQUENCE public.nombre_secuencia
TO orangefamily_app_user;
```

## `column does not exist`

El código y el esquema están desalineados.

Posibles causas:

- backend actualizado antes de migrar;
- migración incompleta;
- migración aplicada en otra base;
- nombre de columna diferente.

## PM2 muestra `No process found`

No es un error del backend.

OrangeFamily no utiliza PM2.

Comprobar:

```bash
sudo systemctl status orangefamily-backend.service
```

## El backend está activo, pero una pantalla no carga

El proceso puede estar activo y el healthcheck responder correctamente, mientras un endpoint concreto falla.

Revisar:

```bash
sudo journalctl \
  -u orangefamily-backend.service \
  --since "10 minutes ago" \
  --no-pager \
  -o cat
```

Comprobar:

- endpoint;
- consulta SQL;
- tablas;
- columnas;
- permisos;
- datos;
- autenticación;
- módulo autorizado.

# Incidencia del 31 de julio de 2026: álbumes no visibles

## Contexto

Se desplegó la funcionalidad de categorías y fechas de álbumes de Orange Photos.

El cambio incorporaba:

- columnas `date_mode`, `date_start` y `date_end` en `orange_photo_albums`;
- tabla `orange_photo_album_categories`;
- tabla `orange_photo_album_category_items`;
- endpoints para categorías;
- asignación personal de categorías;
- nuevas consultas en el listado de álbumes.

## Síntoma

Después del despliegue dejaron de mostrarse los álbumes en producción.

Los álbumes y fotografías no se habían eliminado.

Los datos continuaban almacenados en PostgreSQL.

El problema era que el endpoint de álbumes no podía completar sus consultas.

## Primera fase del error

El backend se actualizó antes de que los objetos nuevos estuvieran disponibles.

Los logs mostraron:

```text
relation "public.orange_photo_album_category_items" does not exist
```

y:

```text
relation "public.orange_photo_album_categories" does not exist
```

## Segunda fase del error

La migración se aplicó utilizando `postgres`.

Las tablas pasaron a existir, pero el rol utilizado por el backend no tenía privilegios sobre ellas.

Los logs mostraron:

```text
permission denied for table orange_photo_album_category_items
```

y:

```text
permission denied for table orange_photo_album_categories
```

## Causa raíz

El proceso de despliegue no incluía como pasos obligatorios:

- aplicar la migración antes de activar el código dependiente;
- identificar todos los objetos nuevos;
- conceder permisos al rol de aplicación;
- verificar los privilegios;
- probar el acceso como `orangefamily_app_user`;
- probar el endpoint afectado;
- revisar los logs antes de cerrar el despliegue.

## Resolución

Se concedieron al rol:

```text
orangefamily_app_user
```

los privilegios necesarios sobre:

```text
public.orange_photo_album_categories
public.orange_photo_album_category_items
```

Después se reinició:

```text
orangefamily-backend.service
```

y se validó nuevamente el listado de álbumes.

No hubo pérdida de:

- álbumes;
- fotografías;
- relaciones;
- archivos en Wasabi.

## Medidas preventivas

A partir de esta incidencia:

1. toda migración debe identificar los objetos creados;
2. toda migración debe revisar permisos;
3. los `GRANT` deben incluirse en la migración o en el paso operativo inmediatamente posterior;
4. debe verificarse el esquema antes de reiniciar el backend;
5. debe probarse el acceso como `orangefamily_app_user`;
6. debe probarse el endpoint afectado;
7. debe revisarse `journalctl`;
8. el despliegue no puede cerrarse únicamente con un healthcheck correcto;
9. OrangeFamily debe gestionarse exclusivamente mediante `systemd`;
10. no debe utilizarse PM2.

# Seguridad de credenciales

Nunca debe:

- mostrarse el contenido completo de `backend/.env`;
- copiarse la `DATABASE_URL`;
- documentarse una contraseña;
- incluirse una credencial en Git;
- pegarse una credencial en una conversación;
- incluirse un secreto en una captura;
- imprimirse una variable sensible mediante `echo`;
- dejarse una credencial en el historial de comandos cuando pueda evitarse.

Cuando una credencial se exponga accidentalmente:

1. rotar la contraseña;
2. actualizar de forma segura el archivo de entorno;
3. comprobar los permisos del archivo;
4. reiniciar `orangefamily-backend.service`;
5. validar el healthcheck;
6. validar el acceso a PostgreSQL;
7. comprobar que la credencial anterior ya no funciona;
8. revisar que no se haya incorporado a Git.