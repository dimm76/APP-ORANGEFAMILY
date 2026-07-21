# AI Agent Workflow

## Objetivo

Definir cómo deben trabajar ChatGPT, Cursor, Codex y otros agentes de IA en OrangeFamily.

El objetivo es evitar cambios improvisados, reducir ruido, ahorrar tokens y mantener una ejecución técnica controlada.

---

## Roles

### ChatGPT

Actúa como:

- analista funcional y técnico;
- revisor de documentación;
- revisor del código real;
- delimitador del alcance;
- redactor de instrucciones para Cursor o Codex;
- revisor de los resultados comunicados por los agentes.

### Cursor y Codex

Actúan como:

- ejecutores de cambios concretos;
- asistentes de implementación;
- revisores de compatibilidad con el código existente;
- detectores de bloqueos;
- proponentes de alternativas acotadas cuando la instrucción no encaje con la implementación real.

---

## Orden obligatorio de análisis

Antes de preparar cambios de implementación:

1. Revisar la documentación relevante de `docs/`.
2. Revisar el código real actualizado.
3. Identificar las decisiones ya tomadas.
4. Identificar los archivos afectados.
5. Definir el alcance exacto.
6. Preparar instrucciones aplicando CAMBIO MÍNIMO.

No deben generarse instrucciones amplias basadas únicamente en memoria cuando la documentación o el código puedan revisarse.

---

## Fuentes de verdad

El orden de prioridad es:

1. Documentación oficial de OrangeFamily dentro de `docs/`.
2. Código más reciente commiteado y pusheado en GitHub.
3. Estado local proporcionado por el usuario:
   - `git status`;
   - `git diff`;
   - archivos concretos;
   - resultados comunicados por Cursor o Codex.
4. Contexto provisional del hilo actual.

Cuando exista discrepancia entre documentación y código, debe señalarse antes de proponer cambios.

---

## Revisión obligatoria de código

Debe revisarse el código real antes de preparar instrucciones que afecten a:

- backend;
- API;
- base de datos;
- SQL;
- autenticación;
- autorización;
- permisos;
- seguridad;
- protección de datos;
- servicios frontend;
- estado React;
- operaciones de creación, actualización o eliminación;
- migraciones;
- arquitectura;
- flujos funcionales completos.

Puede omitirse para:

- documentación pura;
- correcciones de texto;
- mensajes de commit;
- explicaciones conceptuales sin cambios de código.

---

## Libertad controlada

Cursor y Codex pueden:

- resolver detalles menores de implementación;
- reutilizar patrones existentes;
- adaptar una solución cuando el código real lo exija;
- detectar incompatibilidades;
- proponer alternativas técnicas acotadas.

Cursor y Codex no deben:

- inventar funcionalidades;
- ampliar el alcance;
- modificar arquitectura sin autorización;
- añadir dependencias sin aprobación;
- refactorizar fuera del scope;
- reorganizar archivos sin necesidad;
- duplicar lógica;
- modificar módulos no relacionados;
- cambiar versiones o `CHANGELOG.md` salvo release explícita.

---

## Regla de alcance

Implementar únicamente lo solicitado en la tarea actual.

Si para completar la tarea parece necesario modificar algo fuera del alcance, el agente debe detenerse y explicarlo antes de hacerlo.

---

## Contenido mínimo de una instrucción

Las instrucciones para Cursor o Codex deben indicar:

- objetivo;
- alcance;
- archivos afectados;
- comportamiento esperado;
- restricciones;
- elementos que no deben modificarse;
- validaciones necesarias.

Las instrucciones deben ser breves, pero suficientemente precisas.

Las reglas estables deben referenciar esta documentación en lugar de repetirse íntegramente en cada tarea.