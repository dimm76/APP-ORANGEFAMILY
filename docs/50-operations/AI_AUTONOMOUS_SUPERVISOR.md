# Supervisor autónomo de Codex

## Objetivo

`scripts/ai/autonomous-run.mjs` es el proceso externo que mantiene viva una tarea larga sin depender de que un único turno de Codex decida continuar.

El supervisor:

- inicia Codex en el repositorio primario;
- conserva el mismo thread cuando la CLI lo permite;
- evalúa el completion report después de cada turno usando la lógica ya cargada en proceso;
- reanuda automáticamente ante trabajo pendiente;
- intenta recovery ante blockers recuperables;
- detecta falta de progreso;
- revalida repositorios, ramas y scope antes y después de cada turno;
- termina únicamente por COMPLETE, HARD_STOP real o un límite operativo de seguridad.

La continuidad real la impone este proceso externo. El agente `.codex/agents/supervisor.toml` es read-only y sirve como regla de clasificación, no como sustituto del loop.

## Perfil por defecto

- máximo: 40 turnos;
- recovery de BLOCKED recuperable: 3 turnos;
- estancamiento: 4 turnos sin cambio verificable;
- tiempo máximo: 480 minutos;
- sandbox: `workspace-write`;
- red del sandbox: desactivada;
- configuración/reglas personales: no heredadas;
- mismo thread de Codex durante la ejecución.

## Entrada automática desde Codex

Una petición de implementación semánticamente compleja se enruta mediante `AGENTS.md` a `.agents/skills/autonomous-task/SKILL.md`. No requiere palabras mágicas ni delimitadores `START`/`END`.

El turno inicial actúa únicamente como Lead/bootstrap: revisa documentación y código, hace preflight, usa la rama fuente actual como `base_ref` y su HEAD exacto como `base_sha`, genera `prompt.md` y `task-contract.json` en `.codex/runtime/<task-id>/` y ejecuta `.codex/autonomous-bootstrap.mjs`. Ese bootstrap protegido valida repositorio, base SHA, estado tracked, task id y rama `agent/<task-id>`; después crea un worktree hermano aislado, copia los inputs runtime y lanza `scripts/ai/autonomous-run.mjs`.

La clasificación de una tarea como compleja no amplía permisos. El bootstrap automático es single-repository; una tarea que requiera otro repositorio debe detenerse para una autorización/preparación multi-repo explícita. El supervisor general conserva su soporte multi-repositorio declarado en `authorized_repositories`.

`SUPERVISED AUTONOMOUS RUN` y `AUTO_CONTINUE` son prompts internos de una ejecución ya supervisada y nunca deben abrir otro bootstrap.

## Lanzamiento

Para uso manual o diagnóstico, preparar fuera de Git, normalmente bajo `.codex/runtime/<task-id>/`:

1. `prompt.md`;
2. `task-contract.json`;
3. `completion-report.json` (puede crearlo/actualizarlo el agente).

Ejemplo:

```powershell
npm run agent:run -- `
  --prompt-file .codex/runtime/mi-tarea/prompt.md `
  --contract .codex/runtime/mi-tarea/task-contract.json `
  --completion-report .codex/runtime/mi-tarea/completion-report.json
```

Los logs del supervisor se guardan en `.codex/runtime/<task-id>/supervisor/`, ruta ignorada por Git.

## Contrato obligatorio

El repositorio primario debe declarar:

- `base_ref`;
- `base_sha`;
- `working_branch`;
- `allowed_paths` no vacío;
- criterios de aceptación;
- checks;
- operaciones autorizadas.

`main` es la rama productiva de OrangeFamily y no puede utilizarse como `working_branch` en modo unattended.

OrangeFamily no tiene actualmente un staging operativo. No se introduce una rama o flujo de staging artificial para este supervisor.

## Multi-repositorio

Cuando una tarea real cruce provider/consumer, cada repositorio adicional debe declararse explícitamente en `authorized_repositories`:

```json
{
  "authorized_repositories": [
    {
      "name": "provider",
      "path": "C:\\ruta\\al\\repositorio",
      "base_ref": "origin/main",
      "base_sha": "0123456789abcdef0123456789abcdef01234567",
      "working_branch": "feat/mi-tarea",
      "allowed_paths": ["src/**"],
      "role": "provider"
    }
  ]
}
```

Cada entrada se valida como raíz Git, con ref/SHA, branch y scope propios. Los cambios de cualquier repositorio autorizado cuentan como progreso. `--add-dir` nunca autoriza una ruta nueva: solo puede referirse a repositorios ya declarados.

## Clasificación de estados

No son terminales por sí mismos:

- QA pendiente que el agente puede ejecutar;
- bug ordinario dentro del scope;
- test, lint o build afectado corregible;
- tooling todavía no investigado;
- sesión o credenciales locales supuestamente ausentes sin comprobar helpers/configuración;
- navegador gestionado ausente si existe una alternativa segura disponible;
- error de runtime/HMR no reproducido en entorno limpio;
- frontera provider/consumer ya autorizada;
- fallos baseline no introducidos por el diff.

El flujo esperado es diagnosticar, aplicar cambio mínimo, re-test y continuar.

HARD_STOP se reserva a:

- decisión humana material;
- autorización necesaria ausente;
- riesgo destructivo;
- riesgo de seguridad;
- conflicto Git real;
- incapacidad técnica demostrada después de recovery razonable.

## Seguridad unattended

El loop no utiliza `--approve-for-me`, `--dangerously-bypass-approvals-and-sandbox` ni ampliaciones implícitas de permisos.

Aunque aparezcan en `authorized_operations`, el supervisor rechaza dentro del loop:

- push a `main`;
- deploy;
- release;
- tags;
- operaciones Git destructivas/force;
- escritura o migración de base de datos de producción;
- operaciones VPS productivas.

Estas acciones se realizan fuera del loop después de COMPLETE mediante el flujo interactivo expresamente autorizado.

## Recovery

Ante un blocker recuperable, el supervisor pide investigar antes de repetir ciegamente:

- helpers y presencia de claves de configuración sin mostrar secretos;
- mecanismos de autenticación de test/local;
- feature flags/settings;
- navegadores del sistema cuando proceda;
- baseline frente a regresión;
- runtime limpio ante errores HMR;
- workflow completo provider -> consumer;
- checks dirigidos antes del gate global.

## Evidencia y secretos

El fingerprint de progreso incorpora todos los repositorios autorizados, el completion report y el resultado del gate.

Los stdout/stderr persistidos se redactan para patrones habituales de:

- passwords;
- API keys;
- access/refresh/auth/session/bearer/CSRF tokens;
- JWT;
- Authorization;
- Cookie/Set-Cookie;
- DATABASE_URL;
- private/client secrets;
- credenciales embebidas en URLs;
- estructuras JSON anidadas y JSON serializado dentro de strings.

## Completion gate

El supervisor importa la función determinista de completion al arrancar y la reutiliza in-process. No ejecuta después de cada turno un script de gate que el propio agente pueda haber modificado durante esa ejecución.

COMPLETE exige evidencia de criterios de aceptación, fronteras semánticas requeridas, checks obligatorios y validación visual cuando corresponda.

## Exit codes

- `0`: COMPLETE;
- `3`: HARD_STOP o recovery agotado;
- `5`: límite temporal, de iteraciones o estancamiento;
- `6`: no fue posible recuperar el thread de Codex.

Un límite operativo no debe relanzarse a ciegas: revisar primero `latest-state.json` y los logs redactados de la última iteración.
