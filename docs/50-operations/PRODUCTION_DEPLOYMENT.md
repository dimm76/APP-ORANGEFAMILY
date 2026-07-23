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
