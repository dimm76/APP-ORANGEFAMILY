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
- diseñador de la solución concreta;
- delimitador del alcance;
- redactor de instrucciones para Cursor o Codex;
- revisor de commits GitHub;
- revisor de despliegues;
- coordinador del proceso.

ChatGPT debe realizar por sí mismo la investigación disponible mediante el
repositorio y la documentación antes de pedir ejecución a Codex.

### Cursor y Codex

Actúan como:

- ejecutores;
- operadores del repositorio local;
- ejecutores de checks;
- ejecutores de Git cuando esté autorizado;
- ejecutores de operaciones locales autorizadas.

No son responsables de volver a planificar una tarea que ya ha sido analizada.

### Usuario

El usuario:

- define objetivos;
- resuelve decisiones funcionales cuando son necesarias;
- autoriza acciones sensibles;
- autoriza producción o destrucción de datos cuando corresponda;
- valida funcionalmente cuando sea necesario.

El usuario no debe actuar por defecto como puente manual para comandos Git o
PowerShell que Codex o Cursor puedan ejecutar.

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

Para cualquier tarea de reutilización desde APP-ORANGEDESK, revisar previamente:

- `docs/20-development/ORANGEDESK_TO_ORANGEFAMILY_REUSE.md`

---

## Flujo estándar de desarrollo

1. **Solicitud**: el usuario define el objetivo funcional, bug o cambio.
2. **Análisis por ChatGPT**: revisa documentación, código real y decisiones
   existentes; localiza archivos, relaciones, permisos, ownership, seguridad y
   datos; investiga lo comprobable en el repositorio y delimita el cambio
   mínimo. ChatGPT planifica y delimita; Codex o Cursor ejecutan.
3. **Preparación de la rama**: cuando sea necesaria, parte de un `main`
   actualizado y limpio. Codex o Cursor pueden crear o cambiar de rama cuando
   la instrucción lo autorice, sin requerir que el usuario copie comandos.
4. **Implementación**: ChatGPT entrega objetivo, archivos autorizados, cambio,
   comportamiento, restricciones, checks y autorizaciones. Codex o Cursor
   ejecutan sin replantear, ampliar scope ni refactorizar fuera del encargo.
5. **Validación local**: ejecutan syntax, ESLint, build, tests, `git diff
   --check` y verificaciones específicas, comunicando resultados, baseline,
   archivos, migraciones y limitaciones.
6. **Git de la rama**: con autorización explícita ejecutan `status`, staging
   selectivo, checks, commit y push directamente. No usan automáticamente `git
   add .`, `reset --hard`, `rebase`, `push --force` ni `commit --amend`.
7. **Revisión remota**: tras el push, ChatGPT revisa en GitHub el SHA, commits,
   base, ahead/behind, archivos, diff acumulado y compatibilidad del scope.
8. **Correcciones**: ChatGPT prepara instrucciones exactas; Codex o Cursor
   corrigen en la misma rama, validan y crean nuevos commits cuando se autorice.
9. **Integración en main**: solo tras aprobación remota; se prefieren
   `pull --ff-only`, `merge --ff-only` y push explícitamente autorizados.
10. **Despliegue**: tras el push a main, ChatGPT revisa workflow, SHA,
    conclusión, pasos relevantes y healthcheck cuando estén disponibles.
11. **Migraciones locales**: solo con autorización explícita, entorno conocido,
    configuración segura y protección contra producción.
12. **Migraciones de producción**: requieren autorización explícita, revisión
    SQL, evaluación de backup y validaciones antes y después.
13. **VPS/SSH**: solo con acceso confirmado, acción explícita y alcance
    definido; si no hay acceso, el usuario actúa como operador de esa acción.
14. **Cierre**: ChatGPT confirma commit, main, producción, migraciones, checks
    y pendientes reales.

El usuario no es el operador de terminal por defecto. Codex o Cursor ejecutan
PowerShell, shell y Git autorizado cuando disponen de acceso.
