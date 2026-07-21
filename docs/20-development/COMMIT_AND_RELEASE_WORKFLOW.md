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