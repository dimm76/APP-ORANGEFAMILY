# OrangeFamily API

## Principio

OrangeFamily dispondrá de una única API Node consumida por:

- el frontend React;
- la futura aplicación Android;
- futuras automatizaciones e integraciones autorizadas.

No existirán APIs específicas para cada cliente.

---

## Responsabilidades

La API será responsable de:

- autenticación;
- autorización;
- validación de inputs;
- reglas de negocio;
- acceso a PostgreSQL;
- ownership y permisos;
- integraciones externas;
- gestión de archivos;
- automatizaciones;
- respuestas y errores controlados.

React nunca accederá directamente a PostgreSQL.

---

## Diseño

La API deberá:

- organizarse por dominios funcionales;
- reutilizar middleware y servicios existentes;
- evitar duplicación de lógica;
- validar todos los datos recibidos;
- limitar la información devuelta;
- mantener contratos consistentes;
- permitir evolución sin romper clientes existentes.

---

## Seguridad

Cada endpoint protegido deberá validar:

- identidad autenticada;
- permisos;
- ownership;
- acceso al recurso solicitado;
- integridad de los datos recibidos.

No debe confiarse en identificadores, roles o permisos enviados por el frontend.

---

## Respuestas

Las respuestas deberán ser consistentes y devolver:

- estado de la operación;
- datos necesarios;
- mensajes controlados;
- errores sin información interna sensible.

No deberán exponerse:

- errores SQL;
- rutas internas;
- credenciales;
- secretos;
- trazas completas en producción.

---

## Estado actual

La API de OrangeFamily todavía no está implementada.

Las rutas y contratos se documentarán cuando se revise la infraestructura reutilizable y comience el desarrollo del backend.