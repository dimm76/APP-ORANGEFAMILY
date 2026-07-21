# Cursor

## Uso

Cursor se utilizará para desarrollo local, revisión y ejecución de cambios concretos en OrangeFamily.

Debe respetar la documentación existente y el estado real del repositorio.

---

## Antes de modificar

Cursor deberá:

1. revisar los archivos indicados;
2. buscar componentes y utilidades reutilizables;
3. identificar dependencias del cambio;
4. confirmar que el alcance es compatible con el código existente;
5. aplicar CAMBIO MÍNIMO.

---

## Prohibiciones

Cursor no debe:

- inventar funcionalidades;
- ampliar el alcance;
- modificar archivos no relacionados;
- refactorizar por iniciativa propia;
- añadir dependencias sin aprobación;
- duplicar lógica existente;
- cambiar arquitectura;
- actualizar `CHANGELOG.md`;
- cambiar la versión de `package.json`;
- crear tags.

---

## Cambios adicionales

Si detecta que el cambio solicitado requiere una modificación adicional, deberá explicarla antes de realizarla.

No debe resolver silenciosamente problemas fuera del scope.

---

## Validación

Después del cambio deberá indicar:

- archivos afectados;
- resumen de la implementación;
- pruebas o comprobaciones realizadas;
- errores encontrados;
- aspectos pendientes de validación.