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