# AGENTS.md — APP-ORANGEFAMILY

Estas reglas son obligatorias para cualquier agente que trabaje en este repositorio.

## Arquitectura obligatoria

- Frontend: React.
- Backend/API: Node.js.
- Base de datos y fuente única de verdad: PostgreSQL.
- React consume exclusivamente la API Node.
- React nunca accede directamente a PostgreSQL.
- Node concentra la API, lógica de negocio, validaciones, autenticación, autorizaciones, permisos, ownership, automatizaciones, integraciones y acceso a datos.
- PostgreSQL concentra almacenamiento, relaciones, integridad y rendimiento.
- OrangeFamily es un producto independiente.
- No reutilizar lógica de negocio de OrangeDesk ni de otros proyectos.
- Solo puede reutilizarse infraestructura técnica cuando aporte valor y después de revisar el código real.
- La futura aplicación Android utilizará la misma API Node.
- No crear APIs específicas para Android.

## Fuentes de verdad

Antes de proponer o ejecutar cambios, seguir este orden:

1. Revisar la documentación relevante dentro de `docs/`.
2. Revisar el código real actualizado del repositorio.
3. Identificar las decisiones ya adoptadas.
4. Localizar componentes, helpers, hooks, servicios, endpoints y utilidades reutilizables.
5. Aplicar el cambio mínimo necesario.

La documentación del repositorio tiene prioridad sobre cualquier suposición.

Si documentación y código discrepan, señalarlo explícitamente y parar antes de decidir cuál modificar.

No asumir comportamientos que puedan comprobarse revisando primero documentación o código.

## Datos y cambios SQL

- PostgreSQL es la fuente de verdad.
- React no debe mantener una fuente de verdad paralela.
- Todo cambio de esquema debe realizarse mediante una migración SQL incremental y versionada.
- No inventar tablas, columnas, relaciones, restricciones ni tipos.
- Contrastar siempre el esquema real.
- Si el esquema no está claro, parar y pedir aclaración.
- Diferenciar migraciones de esquema, seeds y scripts de importación o reconciliación.
- La lógica de negocio y autorización pertenece a Node.
- No desplazar lógica crítica al frontend.
- No ocultar lógica de negocio innecesariamente en SQL.
- No ejecutar cambios directamente en producción salvo instrucción explícita.

## Alcance y calidad

- Aplicar el cambio mínimo necesario.
- No refactorizar, optimizar, reescribir ni limpiar fuera del scope solicitado.
- No modificar módulos o archivos no relacionados.
- No cambiar la arquitectura ni la estructura de carpetas sin autorización expresa.
- No añadir librerías ni dependencias sin instrucción explícita.
- Antes de crear código, comprobar si ya existe una solución reutilizable.
- Evitar duplicación, sobreingeniería y abstracciones futuras no solicitadas.
- Mantener separadas UI, lógica de negocio y acceso a datos.
- No romper funcionalidad existente.
- No modificar más archivos de los estrictamente necesarios.

## Reglas visuales

Antes de tocar cualquier archivo de interfaz, estilos, componentes visuales, modales, tablas, badges, botones, inputs, selects, popovers, menús contextuales o layouts, el agente debe leer y aplicar:

```text
docs/10-architecture/UI-STYLE-GUIDE.md
```

Reglas obligatorias:

- Reutilizar patrones y clases globales existentes.
- No inventar estilos si ya existe un patrón aplicable.
- No inventar colores.
- No inventar tamaños.
- No inventar radios.
- No inventar sombras.
- No crear botones, badges, modales, inputs, selects o menús con estilos propios si ya existe un patrón global.
- No mezclar clases específicas de una feature con otra feature.
- El CSS de una feature solo puede contener layout y ajustes realmente específicos y mínimos.
- Antes de crear CSS nuevo, revisar los estilos globales.
- No duplicar ni redefinir patrones globales dentro de una feature.
- No usar estilos nativos del navegador sin clase de la aplicación.
- No crear modales sin el patrón global.
- No crear popovers sin el patrón global.
- No usar un selector como badge.
- No añadir CSS global nuevo salvo justificación clara.
- Si no está claro si un estilo debe ser global o específico, parar y pedir confirmación.

Las clases `od-*` documentadas en la guía son provisionales hasta revisar la infraestructura real reutilizada.

No realizar renombrados masivos por motivos nominales.

## Seguridad

- Validar y sanitizar todos los inputs en Node.
- Nunca confiar en el frontend.
- Comprobar identidad, permisos, ownership y acceso al recurso para cada acción protegida.
- Devolver al frontend únicamente los datos necesarios y autorizados.
- No exponer credenciales, secretos, hashes, tokens ni información sensible.
- No registrar secretos ni datos sensibles en logs.
- Usar consultas parametrizadas.
- No interpolar valores directamente en SQL.
- Gestionar errores sin filtrar detalles internos.
- No exponer errores SQL, rutas internas ni trazas completas en producción.
- Revisar especialmente el acceso a datos de menores, documentos, fotografías, vídeos, finanzas y cualquier información privada familiar.

## Regla de parada

No asumir ni completar huecos inventando estructuras.

Si faltan contexto, esquema, permisos, ownership, documentación, código relevante o una decisión que pueda cambiar la solución, parar y pedir aclaración antes de escribir código.

También debe parar si la tarea requiere:

- modificar arquitectura;
- cambiar la estructura de carpetas;
- añadir dependencias;
- modificar archivos fuera del scope;
- tomar una decisión funcional no documentada;
- reutilizar lógica de negocio de otro proyecto;
- aplicar cambios destructivos;
- acceder a producción sin autorización.

## Contrato previo antes de modificar código

Antes de escribir código, el agente debe identificar brevemente:

- objetivo exacto;
- archivos o zonas que prevé tocar;
- si requiere cambios en React;
- si requiere cambios en Node;
- si requiere cambios en PostgreSQL;
- si requiere migración SQL;
- si afecta a permisos, ownership, autenticación o datos sensibles;
- qué queda explícitamente fuera de scope.

Si no puede determinar alguno de estos puntos con seguridad, debe parar y pedir aclaración.

## Funcionalidad completa frente a soporte parcial

El agente no debe declarar una funcionalidad como implementada si solo ha creado una parte técnica.

Ejemplos:

- si crea un endpoint sin una vista React usable, debe indicar que el backend está implementado y la vista está pendiente;
- si crea botones deshabilitados, debe indicar que la UI está preparada pero la acción real está pendiente;
- si crea una migración pero no se ha aplicado, debe indicarlo;
- si una acción requiere modal, confirmación, permisos o validación y no están hechos, debe señalarlo;
- si una integración queda simulada o incompleta, debe decirlo expresamente.

## Reglas de backend y API

Cuando se toque backend:

- validar todos los inputs en Node;
- no confiar en valores enviados por React;
- comprobar permisos y ownership antes de leer o modificar recursos;
- no devolver campos internos innecesarios;
- no exponer tokens, secretos, credenciales, hashes ni datos sensibles;
- usar consultas parametrizadas;
- mantener la lógica crítica en Node salvo justificación documentada;
- no crear endpoints públicos sin revisar expresamente la autenticación;
- mantener contratos de respuesta consistentes;
- devolver errores controlados;
- evitar duplicar lógica entre endpoints.

Para rutas públicas:

- declarar qué ruta queda pública;
- justificar por qué no requiere sesión;
- limitar los campos devueltos;
- comprobar que las rutas privadas relacionadas siguen protegidas.

## Reglas de base de datos

Cuando la tarea implique una entidad nueva, relación nueva o modificación de columnas:

- crear una migración SQL incremental;
- documentar el propósito;
- aplicar solo el cambio solicitado;
- evitar operaciones destructivas no justificadas;
- indicar si requiere backup previo;
- indicar si requiere ejecución manual;
- no aplicar la migración en producción salvo instrucción explícita.

El agente debe indicar:

```text
Migración SQL: sí/no
Archivo de migración:
Requiere ejecución manual: sí/no
Requiere backup previo: sí/no
```

## Git y despliegue

- No hacer commit ni push automáticamente salvo instrucción explícita.
- Antes de modificar código, revisar `git status`.
- No usar `git add .` automáticamente cuando existan cambios ajenos o provisionales.
- Añadir únicamente los archivos validados.
- Al terminar, mostrar o resumir el diff.
- No cambiar de rama sin autorización.
- No trabajar sobre una rama distinta de la indicada por el usuario.
- No crear tags ni releases salvo instrucción explícita.
- No modificar workflows de despliegue salvo instrucción explícita.
- No asumir que staging o producción están configurados si la documentación no lo confirma.

## Documentación

Toda decisión importante debe documentarse.

Especialmente:

- arquitectura;
- APIs;
- modelo de datos;
- convenciones;
- seguridad;
- permisos;
- ownership;
- integraciones;
- decisiones funcionales;
- despliegue.

No modificar documentación ajena al scope.

Cuando una implementación cambie una decisión documentada, actualizar únicamente el documento afectado.

## Checks obligatorios

Antes de cerrar una tarea, ejecutar los checks que correspondan y estén disponibles.

Frontend:

```powershell
npm.cmd run build
```

Backend:

```powershell
node --check .\backend\app.js
node --check .\backend\src\<archivo>.js
```

Diff:

```powershell
git diff --check
git diff --stat
```

Si un check no aplica o no puede ejecutarse, indicarlo claramente.

No ocultar errores ni afirmar que una validación fue correcta sin haberla ejecutado.

## Entregable al finalizar una tarea

Responder siempre con esta estructura:

```text
Archivos modificados:
- ...

Archivos creados:
- ...

Archivos eliminados:
- ...

Hecho:
- ...

Pendiente:
- ...

Fuera de scope:
- ...

Checks:
- npm.cmd run build: correcto/fallido/no ejecutado/no aplica
- node --check ...: correcto/fallido/no ejecutado/no aplica
- git diff --check: correcto/fallido/no ejecutado

Migración SQL:
- sí/no
- archivo:
- ejecución manual:
- backup previo:

Commit/push:
- no realizado salvo instrucción explícita.
```

No omitir limitaciones, riesgos ni comprobaciones pendientes.