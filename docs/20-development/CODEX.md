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
