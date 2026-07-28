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

OrangeFamily dispone de una API Node operativa, implementada parcialmente y en evolución por módulos. Orange Photos ya utiliza rutas implementadas; sus contratos específicos se documentan junto al módulo.
# Comprobación masiva de almacenamiento de Orange Photos

`POST /api/orange-photos/check-storage-status` requiere sesión. Acepta
`{"items":[{"client_id":"external:image:123","hash":"<sha256>","hash_algorithm":"sha256","size_bytes":123,"display_name":"IMG.jpg"}]}`
con entre 1 y 200 elementos. Devuelve por `client_id` los estados `backed_up`,
`not_found`, `possible_match` o `remote_missing` y, solo para una coincidencia
propia, `remote_photo_id`.

Node obtiene familia y propietario de la sesión y consulta PostgreSQL en un
número constante de consultas por lote. No devuelve owner ajeno, storage key,
bucket, URL ni metadatos privados y no realiza `HEAD` contra Wasabi.

`remote_missing` se reserva en el contrato, pero el esquema actual no conserva
un estado físico fiable que permita producirlo; por ahora el endpoint devuelve
`backed_up`, `possible_match` o `not_found`.
