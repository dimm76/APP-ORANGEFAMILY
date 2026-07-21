# OrangeFamily Database

## Principio

OrangeFamily utilizará una base de datos PostgreSQL propia e independiente.

No compartirá base de datos ni tablas con OrangeDesk u OrangeTraining.

---

## Responsabilidades

PostgreSQL será responsable de:

- almacenamiento;
- relaciones;
- integridad referencial;
- restricciones;
- índices;
- consistencia;
- rendimiento de las consultas.

La lógica de negocio permanecerá en Node salvo casos técnicamente justificados.

---

## Modelo de datos

El modelo deberá representar el dominio familiar y no la estructura visual de los módulos.

Las entidades podrán relacionarse entre sí.

Ejemplos:

- personas;
- usuarios;
- proyectos;
- documentos;
- fotografías y vídeos;
- cuentas y movimientos;
- viviendas;
- notas;
- eventos.

No se crearán tablas definitivas hasta definir las entidades y relaciones necesarias.

---

## Reglas

- No reutilizar tablas funcionales del CRM.
- No copiar migraciones de OrangeTraining.
- No duplicar datos entre módulos.
- Utilizar claves foráneas cuando corresponda.
- Definir restricciones de integridad.
- Registrar migraciones.
- Evitar eliminar historial sin una decisión funcional explícita.
- Diseñar consultas e índices según necesidades reales.

---

## Migraciones

Las modificaciones del esquema deberán realizarse mediante migraciones versionadas.

Las migraciones deberán:

- tener un propósito concreto;
- limitarse al cambio solicitado;
- evitar cambios destructivos no justificados;
- revisarse antes de aplicarse;
- documentar cualquier transformación relevante.

---

## Estado actual

La base de datos de OrangeFamily todavía no ha sido creada.

La carpeta `docs/30-database/migration/` deberá permanecer sin migraciones heredadas hasta que exista un modelo propio aprobado.
