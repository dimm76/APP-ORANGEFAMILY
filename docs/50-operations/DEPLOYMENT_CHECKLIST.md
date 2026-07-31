# Checklist de despliegue

Lista operativa reutilizable para cualquier despliegue de OrangeFamily.

Debe completarse antes de considerar terminado un despliegue.

---

# 1. Identificación del despliegue

## Fecha

```text

Responsable
Commit desplegado
Tipo de despliegue
 Solo frontend.
 Backend sin migración.
 Backend con migración.
 Configuración o infraestructura.
 Aplicación Android.
 Otro:
Funcionalidad o incidencia afectada
2. Revisión previa
 El alcance del cambio está claramente definido.
 Se han identificado los archivos modificados.
 No existen cambios fuera del scope.
 Se ha revisado la documentación relacionada.
 Se ha revisado el código existente.
 Se han reutilizado componentes, servicios o utilidades existentes.
 No se han añadido dependencias innecesarias.
 No se han realizado refactorizaciones ajenas al cambio.
 Se ha evaluado el impacto sobre otros módulos.
 Se ha evaluado el impacto sobre usuarios existentes.
 Se ha evaluado el impacto sobre datos existentes.
 Se ha definido el criterio de validación.
 Se ha evaluado la necesidad de rollback.
3. Estado de Git antes del despliegue

Entrar en el repositorio:

cd /opt/orangefamily/APP-ORANGEFAMILY

Comprobar el estado:

git status --short
 El árbol de trabajo está limpio.
 No existen archivos no rastreados inesperados.
 No existen cambios locales sin commit.
 El commit correcto está en main.
 El commit se ha enviado al remoto.
 El commit desplegado ha sido identificado.

Actualizar producción:

git pull --ff-only origin main

Comprobar el commit:

git log -1 --oneline
 git pull --ff-only terminó correctamente.
 El commit mostrado coincide con el esperado.
 No se produjo ningún merge inesperado.
 No existen conflictos.
4. Clasificación técnica del cambio
Frontend
 Hay cambios en frontend.
 No hay cambios en frontend.
Backend
 Hay cambios en backend.
 No hay cambios en backend.
Base de datos
 Hay migración PostgreSQL.
 No hay migración PostgreSQL.
Dependencias
 Cambió package-lock.json.
 Cambió backend/package-lock.json.
 No cambiaron dependencias.
Servicio
 Requiere reinicio del backend.
 No requiere reinicio del backend.
Configuración
 Cambia .env.
 Cambia systemd.
 Cambia Nginx.
 Cambia Plesk.
 No cambia configuración.
5. Migraciones PostgreSQL

Completar esta sección únicamente cuando exista una migración.

Identificación

Migración:

docs/30-database/migration/

Archivo aplicado:

 La migración está versionada.
 El nombre sigue el orden cronológico del proyecto.
 La migración ha sido revisada.
 La migración aplica cambio mínimo.
 La migración no modifica objetos ajenos al scope.
 La migración utiliza transacción cuando procede.
 La migración utiliza IF EXISTS o IF NOT EXISTS cuando procede.
 La migración falla de forma explícita ante estados inválidos.
 La migración ha sido probada en local.
 La funcionalidad dependiente ha sido validada en local.
Objetos afectados
 Tablas nuevas identificadas.
 Columnas nuevas identificadas.
 Columnas modificadas identificadas.
 Índices identificados.
 Restricciones identificadas.
 Claves foráneas identificadas.
 Secuencias identificadas.
 Vistas identificadas.
 Funciones identificadas.
 Datos transformados identificados.
 Objetos eliminados identificados.
 No hay otros objetos afectados.

Detalle:

Riesgo y recuperación
 Se ha evaluado el riesgo sobre datos.
 Se ha evaluado el riesgo de bloqueo.
 Se ha evaluado el volumen afectado.
 Se ha evaluado la necesidad de backup.
 Se ha realizado backup cuando procede.
 Se ha definido rollback cuando procede.
 La migración es no destructiva.
 La migración destructiva está expresamente autorizada.
Aplicación en producción

Ejecutar desde:

cd /opt/orangefamily/APP-ORANGEFAMILY

Aplicar con:

sudo -u postgres psql \
  -v ON_ERROR_STOP=1 \
  -d orangefamily_app_prod \
  -f docs/30-database/migration/NOMBRE_MIGRACION.sql
 Se utilizó ON_ERROR_STOP=1.
 La migración terminó sin errores.
 No se ignoró ningún mensaje de error.
 No se continuó el despliegue después de un fallo SQL.
 La base de datos correcta fue orangefamily_app_prod.
6. Verificación del esquema
Existencia de objetos

Para comprobar una tabla:

sudo -u postgres psql \
  -d orangefamily_app_prod \
  -c "
SELECT to_regclass('public.nombre_tabla');
"
 Todas las tablas nuevas existen.
 Todas las columnas nuevas existen.
 Los tipos de datos son correctos.
 Los valores por defecto son correctos.
 La nulabilidad es correcta.
 Los índices existen.
 Las restricciones existen.
 Las claves foráneas existen.
 Las secuencias existen cuando proceden.
 Las funciones o vistas existen cuando proceden.
Verificación de columnas
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
 El resultado coincide con la migración.
 El esquema coincide con las consultas del backend.
 Los datos anteriores siguen siendo válidos.
7. Permisos PostgreSQL

El rol de ejecución del backend es:

orangefamily_app_user

Los objetos creados por postgres no conceden automáticamente acceso a este rol.

Identificación de permisos
 Se han identificado las tablas que necesita el backend.
 Se han identificado las operaciones necesarias.
 Se han identificado las secuencias necesarias.
 Se han identificado las funciones necesarias.
 Se ha evitado conceder permisos globales innecesarios.
Permisos de tablas

Cuando la aplicación necesita lectura y escritura:

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.nombre_tabla
TO orangefamily_app_user;

Cuando solo necesita lectura:

GRANT SELECT
ON TABLE public.nombre_tabla
TO orangefamily_app_user;
Permisos de secuencias
GRANT USAGE, SELECT, UPDATE
ON SEQUENCE public.nombre_secuencia
TO orangefamily_app_user;
Permisos de funciones
GRANT EXECUTE
ON FUNCTION public.nombre_funcion(...)
TO orangefamily_app_user;
Acceso al esquema
GRANT USAGE
ON SCHEMA public
TO orangefamily_app_user;
 GRANT aplicado a todas las tablas nuevas.
 GRANT aplicado a todas las secuencias necesarias.
 GRANT aplicado a todas las funciones necesarias.
 No se concedió SUPERUSER.
 No se concedió CREATEDB.
 No se concedió CREATEROLE.
 No se concedió ALL ON DATABASE.
 Los permisos se limitaron al mínimo necesario.
Verificación de privilegios
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
 Los privilegios aparecen para todas las tablas necesarias.
 Los privilegios coinciden con las operaciones reales del backend.
 No existen privilegios excesivos.
Prueba con el rol real

La validación como postgres no es suficiente.

 Se ha probado el acceso como orangefamily_app_user.
 Se ha probado lectura.
 Se ha probado inserción cuando procede.
 Se ha probado actualización cuando procede.
 Se ha probado eliminación cuando procede.
 No se ha mostrado la contraseña.
 No se ha impreso DATABASE_URL.

Ejemplo seguro:

psql "$DATABASE_URL" -c "
SELECT 1
FROM public.nombre_tabla
LIMIT 1;
"

No ejecutar:

echo "$DATABASE_URL"
8. Dependencias
Frontend

Completar si cambió package-lock.json.

cd /opt/orangefamily/APP-ORANGEFAMILY
npm ci
 npm ci terminó correctamente.
 No aparecieron errores de dependencias.
 No se modificó package-lock.json en producción.
Backend

Completar si cambió backend/package-lock.json.

cd /opt/orangefamily/APP-ORANGEFAMILY/backend
npm ci
 npm ci terminó correctamente.
 No aparecieron errores de dependencias.
 No se modificó el lockfile en producción.
9. Build del frontend

Completar cuando existan cambios frontend.

cd /opt/orangefamily/APP-ORANGEFAMILY
npm run build
 El build terminó correctamente.
 No existen errores de compilación.
 Los avisos nuevos han sido revisados.
 Los avisos conocidos siguen siendo los mismos.
 Los archivos finales fueron generados.
 La publicación utiliza el build nuevo.
10. Reinicio del backend

OrangeFamily utiliza systemd.

No utiliza PM2.

Reiniciar:

sudo systemctl restart orangefamily-backend.service

Comprobar:

sudo systemctl status \
  orangefamily-backend.service \
  --no-pager
 Se utilizó orangefamily-backend.service.
 No se utilizó PM2.
 El servicio aparece como active (running).
 No existe bucle de reinicios.
 El proceso Node arrancó correctamente.
 El backend escucha en 127.0.0.1:4200.
 Las variables de entorno se cargaron correctamente.
 No existen errores de conexión PostgreSQL.
 No existen errores del directorio temporal.
11. Healthcheck
curl --fail --silent --show-error \
  http://127.0.0.1:4200/api/health
 El healthcheck devuelve respuesta correcta.
 El backend está operativo.
 PostgreSQL está accesible.
 La respuesta corresponde al entorno de producción.

El healthcheck no sustituye la prueba del endpoint afectado.

12. Validación de API
Endpoint afectado
Método
GET / POST / PATCH / PUT / DELETE
 El endpoint responde.
 El código HTTP es correcto.
 Los datos devueltos son correctos.
 Los inputs se validan.
 La autenticación se valida.
 Los permisos se validan.
 El ownership se valida.
 Los errores se gestionan correctamente.
 Los datos existentes siguen disponibles.
 No existe regresión en endpoints relacionados.
Perfiles probados
 Owner.
 Miembro.
 Usuario sin permiso cuando procede.
 Recurso propio.
 Recurso compartido.
 Recurso ajeno cuando procede.
13. Validación funcional
Flujo principal
 El flujo principal funciona de principio a fin.
 Los datos se guardan.
 Los datos se recargan correctamente.
 Los datos anteriores permanecen visibles.
 Los estados vacíos funcionan.
 Los estados con datos funcionan.
 Los mensajes de error son correctos.
 No aparecen errores de consola.
 No aparecen errores de red inesperados.
 No se ha roto navegación existente.
Funciones relacionadas
 Crear.
 Editar.
 Eliminar.
 Restaurar.
 Compartir.
 Archivar.
 Buscar.
 Filtrar.
 Ordenar.
 Paginar.
 Descargar.
 Subir.
 No aplica alguna de las anteriores.
14. Validación visual

Completar cuando haya cambios en interfaz.

 Escritorio validado.
 Móvil validado.
 Tablet validada cuando procede.
 No existe overflow horizontal.
 No existen elementos solapados.
 Las cabeceras permanecen visibles cuando procede.
 El scroll funciona.
 Los modales funcionan.
 Los menús funcionan.
 Los estados de carga funcionan.
 Los estados de error funcionan.
 Los textos no se cortan.
 Los iconos son correctos.
 Los permisos visuales coinciden con los permisos reales.
 La funcionalidad es consistente con el resto de OrangeFamily.
15. Validación de datos
 Los datos existentes siguen presentes.
 No se han creado duplicados inesperados.
 No se han eliminado registros.
 No se han roto relaciones.
 Los ownership siguen siendo correctos.
 Los recursos compartidos siguen accesibles.
 Los contadores coinciden.
 Los filtros devuelven datos correctos.
 Los datos nuevos se guardan correctamente.
 Los valores por defecto son correctos.
 Los datos migrados se han verificado.

Detalle de comprobación:

16. Logs

Revisar después del reinicio y después de probar la funcionalidad:

sudo journalctl \
  -u orangefamily-backend.service \
  --since "10 minutes ago" \
  --no-pager \
  -o cat

Seguimiento en tiempo real:

sudo journalctl \
  -u orangefamily-backend.service \
  -f \
  -o cat
 No aparece relation does not exist.
 No aparece permission denied.
 No aparece column does not exist.
 No aparece violates constraint.
 No aparece ECONNREFUSED.
 No aparecen errores SQL nuevos.
 No aparecen errores del endpoint afectado.
 No aparece un bucle de reinicio.
 No aparecen errores de autenticación inesperados.
 No aparecen errores de permisos inesperados.
 No aparecen errores nuevos de aplicación.

Errores encontrados:

Resolución aplicada:

17. Seguridad
 No se ha mostrado backend/.env.
 No se ha mostrado DATABASE_URL.
 No se han copiado contraseñas.
 No se han incluido secretos en Git.
 No se han incluido secretos en documentación.
 No se han incluido secretos en capturas.
 No se han dejado credenciales en comandos compartidos.
 .env continúa ignorado por Git.
 Los permisos del archivo .env siguen siendo correctos.
 Las credenciales expuestas accidentalmente se han rotado.
 La credencial anterior ha dejado de funcionar.
 El servicio se reinició tras actualizar credenciales.
18. Rollback

Completar cuando exista riesgo o cuando el despliegue haya fallado.

Rollback de código

Commit anterior:

Procedimiento:

Rollback de base de datos
Restauración de backup
 Se ha identificado el commit anterior.
 Se ha identificado la migración afectada.
 Se ha definido si la migración es reversible.
 Se ha identificado el backup disponible.
 El rollback se ha probado o revisado.
 No se ha ejecutado un rollback destructivo sin autorización.
19. Criterio de finalización

El despliegue no se considera terminado hasta confirmar todos los puntos aplicables.

 Repositorio actualizado.
 Commit correcto desplegado.
 Árbol de trabajo limpio.
 Migración aplicada cuando procede.
 Esquema verificado.
 Permisos aplicados.
 Permisos probados como orangefamily_app_user.
 Dependencias instaladas cuando procede.
 Frontend construido cuando procede.
 Backend reiniciado mediante systemd.
 Servicio activo.
 Healthcheck correcto.
 Endpoint afectado probado.
 Flujo funcional validado.
 Datos existentes comprobados.
 Permisos y ownership comprobados.
 Prueba visual realizada.
 Logs revisados.
 No existen errores nuevos.
 Seguridad revisada.
 Incidencias documentadas.
 Rollback documentado cuando procede.
20. Resultado del despliegue
Estado final
 Correcto.
 Correcto con observaciones.
 Fallido y revertido.
 Pendiente de validación.
 Pendiente de corrección.
Resumen
Migraciones aplicadas
Endpoints validados
Pruebas realizadas
Incidencias
Acciones pendientes
Hora de finalización