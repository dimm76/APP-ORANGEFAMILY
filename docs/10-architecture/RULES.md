# OrangeFamily Architecture Rules

## Arquitectura

OrangeFamily utiliza:

- React para el frontend;
- Node.js para el backend y la API;
- PostgreSQL para persistencia;
- GitHub para versionado;
- VPS con Plesk para producción.

---

## Separación de responsabilidades

### React

Responsable de:

- interfaz;
- navegación;
- componentes;
- estado visual;
- llamadas a la API.

React nunca accede directamente a PostgreSQL.

### Node

Responsable de:

- reglas de negocio;
- autenticación;
- autorización;
- validación;
- API;
- automatizaciones;
- integraciones;
- acceso a datos.

### PostgreSQL

Responsable de:

- almacenamiento;
- relaciones;
- integridad;
- restricciones;
- rendimiento.

---

## Cambio mínimo

Toda modificación deberá:

- limitarse al objetivo solicitado;
- evitar refactorizaciones ajenas;
- evitar cambios en módulos no relacionados;
- conservar el comportamiento existente;
- minimizar el número de archivos modificados.

---

## Reutilización

Antes de crear un nuevo:

- componente;
- hook;
- helper;
- servicio;
- endpoint;
- middleware;
- utilidad;

debe comprobarse si ya existe una solución reutilizable.

No debe duplicarse lógica.

---

## Evolución

- No implementar funcionalidades futuras antes de necesitarlas.
- Diseñar para permitir su incorporación posterior.
- Evitar sobrediseño.
- Priorizar soluciones claras y mantenibles.
- No añadir dependencias sin una necesidad justificada y aprobación expresa.

---

## Seguridad

Siempre deben validarse:

- inputs;
- autenticación;
- permisos;
- ownership;
- acceso a recursos.

Nunca se confiará únicamente en datos o validaciones del frontend.

---

## Documentación y código

La documentación oficial vive en `docs/`.

Antes de cambios importantes:

1. revisar la documentación relevante;
2. revisar el código real;
3. identificar decisiones existentes;
4. aplicar el cambio mínimo.

Si documentación y código discrepan, debe señalarse antes de decidir cuál modificar.

---

## Android

La futura aplicación Android utilizará la misma API Node que React.

No se crearán endpoints específicos para Android.

---

## Inteligencia artificial

Las entidades importantes deberán permitir futuras automatizaciones y asistentes inteligentes.

Esto no justifica implementar anticipadamente funcionalidades de IA.