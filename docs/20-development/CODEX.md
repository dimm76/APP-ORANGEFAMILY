# Codex

## Uso

Codex se utilizará para ejecutar tareas de implementación concretas sobre el código real de OrangeFamily.

Antes de preparar una instrucción para Codex deben revisarse:

- la documentación relevante;
- el código actualizado;
- los archivos afectados;
- las decisiones existentes.

---

## Alcance

Cada instrucción deberá indicar:

- objetivo;
- archivos afectados;
- comportamiento esperado;
- restricciones;
- validaciones necesarias.

Codex debe aplicar CAMBIO MÍNIMO.

## Perfil de ejecución

Codex ejecuta instrucciones previamente analizadas. No debe volver a investigar
ni diseñar la solución cuando el encargo ya define archivos y cambios. Puede
ejecutar PowerShell, shell y Git cuando la tarea lo autorice, y debe realizar
directamente las operaciones rutinarias disponibles en lugar de devolverlas al
usuario. Commit y push requieren autorización explícita; el acceso a
producción también. Disponer de shell no implica autorización para producción.

## Git delegado

Con autorización explícita puede ejecutar `status`, `branch` o `switch`,
staging de archivos concretos, checks de diff, commit, push, `pull --ff-only`,
`merge --ff-only` y push a main. Sin autorización no ejecuta force push, hard
reset, rebase, amend, borrado de ramas remotas, tags/releases, cambios de
producción ni migraciones productivas.

---

## Prohibiciones

Codex no debe:

- ampliar el alcance;
- inventar funcionalidades;
- modificar arquitectura sin autorización;
- añadir dependencias sin aprobación;
- refactorizar código no relacionado;
- reorganizar archivos innecesariamente;
- duplicar lógica;
- modificar módulos ajenos;
- actualizar versión o `CHANGELOG.md` salvo release solicitada.

---

## Bloqueos

Si la tarea requiere modificar archivos no previstos, cambiar arquitectura o tomar una decisión funcional no documentada, Codex debe detenerse y comunicarlo antes de continuar.

---

## Resultado esperado

Las tareas de Codex pueden usar `.codex/task-contract.schema.json` y los roles
de `.codex/agents/`. El Executor escribe solo dentro de `allowed_paths`; el
Reviewer inspecciona el cambio sin modificarlo; el Verifier ejecuta gates
deterministas; y el Security Reviewer se activa únicamente ante riesgo
significativo. Las operaciones de push, producción, migraciones y release
Android requieren autorización individual en el contrato.

Las tareas largas pueden ejecutarse mediante `npm run agent:run`. El proceso
externo conserva/reanuda el mismo thread, trata trabajo pendiente como
`CONTINUE`, intenta recovery ante blockers técnicos recuperables y revalida
scope, rama y repositorios antes y después de cada turno. El modo unattended
no autoriza push a `main`, deploy, release/tag, DB productiva ni Git
destructivo aunque esas operaciones aparezcan por error en el contrato.

Cuando una petición de implementación sea semánticamente compleja y defina un
objetivo terminal que requiera continuidad, varias fases, verificación o
recovery hasta completar el resultado, Codex debe aplicar
`.agents/skills/autonomous-task/SKILL.md` en lugar de ejecutarla como un turno
normal. No existe una sintaxis obligatoria `START`/`END`.

El entrypoint realiza preflight y genera `prompt.md` y `task-contract.json`
bajo `.agent-runtime/<task-id>/`. Después ejecuta
`.codex/autonomous-bootstrap.mjs`; el bootstrap valida las fronteras, crea el
worktree y la rama `agent/<task-id>` y lanza el supervisor existente. El usuario
no debe construir el contrato, crear ramas/worktrees ni lanzar manualmente el
supervisor.

Codex deberá informar:

- archivos modificados;
- archivos creados o eliminados;
- comportamiento implementado;
- validaciones realizadas;
- validaciones no realizadas;
- posibles limitaciones pendientes.
- rama y SHA completo cuando proceda;
- commit, push correcto o fallido y estado Git final cuando se hayan ejecutado;
- migración ejecutada o no ejecutada;
- entorno donde se ejecutó y si producción fue tocada.
