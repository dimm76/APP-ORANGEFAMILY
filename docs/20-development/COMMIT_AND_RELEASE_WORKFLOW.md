# Commit and Release Workflow

## Principio

Commit y release no son lo mismo.

- Un commit representa un avance técnico.
- Una release representa una versión funcional publicable.

---

## Commit normal

Un commit normal:

- no implica cambio de versión;
- no actualiza `CHANGELOG.md`;
- no modifica la versión de `package.json`;
- no crea tags;
- debe limitarse a los archivos relacionados con la tarea.

Antes del commit deben revisarse:

```bash
git status
git diff

No debe utilizarse git add . automáticamente cuando existan archivos provisionales o cambios ajenos a la tarea.

Se añadirán únicamente los archivos validados.

Ejemplo:

git add ruta/archivo-1 ruta/archivo-2
git commit -m "tipo: descripción"
git push
```

## Flujo de rama de trabajo

El flujo normal es: `main` limpio y actualizado, rama específica,
implementación, checks, stage de archivos concretos, commit, push de la rama,
revisión remota, correcciones si son necesarias, fast-forward a `main` tras la
aprobación y push de `main`. Codex o Cursor pueden ejecutar estas operaciones
cuando estén expresamente autorizados.

### No utilizar al usuario como terminal intermedio

Si el agente ejecutor dispone de shell y permisos suficientes, debe realizar
él mismo las operaciones rutinarias indicadas por ChatGPT. No usar por defecto
`git add .`, force push, rebase, `reset --hard` ni amend; no hacer merge a main
antes de la revisión remota; preferir `--ff-only`. Release y tag siguen siendo
un proceso explícito distinto.

Release

Solo se preparará una release cuando se solicite expresamente.

Antes de preparar una release deben revisarse los cambios desde la última versión:

git log <ultimo_tag>..HEAD --oneline
git diff --stat <ultimo_tag>..HEAD

La documentación de la release debe agrupar los cambios funcionalmente:

Added
Changed
Fixed
Improved

No se deben:

inventar cambios;
documentar cambios no validados;
duplicar versiones;
modificar versiones anteriores;
crear tags antes de confirmar la release.
Cambio de versión

Cuando corresponda:

Actualizar CHANGELOG.md.
Actualizar la versión de package.json.
Crear el commit de release.
Crear el tag.
Subir commit y tag.

Ejemplo:

git add CHANGELOG.md package.json
git commit -m "release: vX.X.X"
git push
git tag vX.X.X
git push origin vX.X.X
Primer commit de OrangeFamily

El primer commit solo se realizará cuando la primera versión documental sea coherente.

Hasta entonces no ejecutar:

git add
git commit
git push

## `docs/20-development/SECURITY_AND_DATA_PROTECTION.md`

El bloque de seguridad sí está adaptado a OrangeFamily y debe ir completo en ese archivo. No debe quedar dentro de `COMMIT_AND_RELEASE_WORKFLOW.md`.

Así que la respuesta es: **sí, se adapta y se conserva, pero en su archivo correcto**.
