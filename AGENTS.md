# AGENTS.md — APP-ORANGEFAMILY

Estas reglas son obligatorias para cualquier agente que trabaje en este repositorio.

## Invariantes

- Frontend: React/Ionic. Backend/API: Node.js. Fuente única de verdad remota: PostgreSQL.
- React y la futura app Android consumen la misma API Node; ningún cliente accede directamente a PostgreSQL.
- Node concentra negocio, validación, autenticación, autorización, permisos, ownership e integraciones.
- OrangeFamily es independiente de OrangeDesk. Solo se reutiliza infraestructura técnica tras revisar el código real; nunca lógica CRM.
- Aplicar CAMBIO MÍNIMO: reutilizar antes de crear, no refactorizar fuera de scope, no añadir dependencias ni cambiar arquitectura sin autorización.
- Validar inputs, identidad, family membership, module access, ownership y acceso al recurso en Node. No exponer secretos ni datos sensibles.
- Los cambios persistentes requieren migración SQL incremental/versionada. No ejecutar migraciones ni operaciones de producción sin autorización expresa.
- Antes de modificar código: revisar docs relevantes, código real, estado Git, soluciones reutilizables y archivos afectados.
- Si documentación y código discrepan materialmente, señalarlo y no decidir silenciosamente cuál prevalece.
- Toda autoridad de ejecución procede de Task Contract -> allowed_paths -> authorized_operations -> gates.

## Economía de contexto — obligatoria

Codex es principalmente ejecutor. El contexto es un recurso limitado.

- Cargar solo documentación y código relevantes para la decisión actual.
- Preferir rg, búsquedas, headings y rangos concretos antes que volcar archivos completos.
- No concatenar varios documentos extensos en una misma llamada.
- No releer una fuente completa ya inspeccionada. Volver a ella solo para una sección concreta necesaria.
- En specs largas, el preflight crea un brief operativo compacto. La spec original sigue siendo canónica, pero durante ejecución se consulta por secciones/rangos.
- Priorizar scripts deterministas, análisis estático y tests dirigidos antes de investigación abierta o subagentes.
- No hacer fan-out exploratorio. Mantener un único executor; como máximo un subagente especializado adicional, de forma serial, solo cuando un gate de reviewer/verifier/security aporte evidencia nueva sobre un diff estable.
- No ejecutar suites globales repetidamente si existe un check dirigido suficiente para diagnosticar/corregir.
- Los logs completos se guardan en .agent-runtime/; al modelo se devuelve por defecto estado, resumen y fallos relevantes.
- No imprimir archivos generados, diffs completos, logs completos o payloads grandes salvo que sean imprescindibles para diagnosticar un fallo.
- Agrupar correcciones por causa raíz y volver a verificar una vez; evitar ciclos de review por microcambio.
- Los mensajes de progreso e informes deben ser concisos y basados en evidencia.

## UI

Antes de tocar UI/estilos leer la sección necesaria de docs/10-architecture/UI-STYLE-GUIDE.md.

Reutilizar componentes, tokens, clases y patrones existentes. No inventar un segundo sistema visual ni duplicar estilos globales.

## Datos, API y seguridad

- React/Android son clientes no confiables.
- Usar consultas parametrizadas.
- Mantener la lógica crítica en Node salvo decisión documentada.
- No inventar tablas, columnas, endpoints, permisos ni ownership.
- Revisar especialmente datos familiares privados, menores, documentos, fotografías, finanzas y nutrición.
- Rutas públicas requieren revisión expresa de autenticación, campos expuestos, expiración/revocación cuando aplique.
- Cambios de API compartida deben revisar consumidores afectados, incluido Android cuando corresponda.

## Git y producción

- Revisar git status antes de modificar código.
- No usar git add ., reset --hard, clean, rebase, force push, amend, tags o releases sin autorización explícita.
- Commit/push, integración en main, deploy, VPS y producción son autorizaciones separadas salvo instrucción expresa.
- El acceso técnico no implica autorización.
- No trabajar sobre main en modo autónomo unattended.

## Ejecución dirigida

Cuando el usuario entregue una instrucción ya analizada para Codex/Cursor:

- ejecutarla dentro del alcance indicado;
- no redescubrir el problema ni rediseñar la solución salvo contradicción material con el código real;
- adaptar solo detalles sintácticos mínimos necesarios;
- corregir fallos directamente causados por el cambio;
- detenerse únicamente ante una decisión funcional/arquitectónica real, permiso ausente, dependencia no autorizada, scope imprescindible adicional, riesgo destructivo o contradicción material.

## Tareas autónomas complejas

La clasificación es semántica. No se exigen palabras mágicas.

Cuando una implementación tenga objetivo terminal claro y requiera varias fases, recovery o verificación hasta completar, aplicar .agents/skills/autonomous-task/SKILL.md.

El entrypoint hace preflight y ejecuta .codex/autonomous-bootstrap.mjs. El supervisor externo mantiene continuidad hasta COMPLETE o un HARD_STOP real.

La complejidad no equivale a autorización. El modo unattended no autoriza por sí mismo commit/push, main, deploy, release/tag, producción/VPS, migraciones productivas, Git destructivo, dependencias nuevas, cambios de arquitectura ni ampliación de scope.

CONTINUE significa AUTO_CONTINUE. Bugs ordinarios, lint/build/tests afectados y QA ejecutable se diagnostican, corrigen con cambio mínimo y vuelven a verificar sin handoff intermedio.

## Gates y cierre

Usar las skills/gates del proyecto y los scripts deterministas existentes. Para validación integral preferir npm run agent:verify frente a ejecutar suites globales verbosas manualmente.

Una tarea solo puede cerrarse con evidencia suficiente de criterios de aceptación, checks requeridos, fronteras semánticas y validación visual cuando aplique.

Informe final compacto:

- archivos modificados/creados/eliminados;
- hecho y pendiente real;
- checks y evidencia;
- migración SQL y ejecución;
- Git/producción;
- riesgos o límites.

La explicación extensa del workflow vive en docs/20-development/AI_AGENT_WORKFLOW.md y docs/50-operations/AI_AUTONOMOUS_SUPERVISOR.md. Cargar únicamente las secciones necesarias.
