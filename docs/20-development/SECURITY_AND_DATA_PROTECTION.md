# Security and Data Protection

## Objetivo

Definir los criterios mínimos de seguridad y protección de datos de OrangeFamily.

OrangeFamily gestionará información privada de una unidad familiar. La seguridad y la privacidad son requisitos centrales del producto.

---

## Cuándo consultar este documento

Consultar este documento cuando una tarea afecte a:

- autenticación;
- usuarios;
- personas;
- roles;
- permisos;
- API;
- base de datos;
- documentos;
- fotografías o vídeos;
- información financiera;
- datos personales;
- datos de menores;
- integraciones;
- almacenamiento;
- producción;
- secretos;
- variables de entorno;
- migraciones de datos.

---

## Principios

La seguridad es un requisito central, no una mejora opcional.

No deben aceptarse soluciones inseguras por rapidez.

No debe asumirse que una solución válida en local es automáticamente válida para producción.

No debe confiarse en datos enviados desde el frontend.

La autenticación, autorización, propiedad y acceso a los recursos deben validarse siempre en el backend.

---

## Secretos

No versionar:

- contraseñas;
- tokens;
- claves privadas;
- API keys;
- credenciales de base de datos;
- secretos de firma;
- credenciales de servicios externos;
- hashes reales de usuarios, salvo decisión explícita y justificada;
- archivos `.env`.

No mostrar secretos en respuestas, commits, logs o documentación.

Los archivos de ejemplo solo deben contener valores ficticios.

---

## Datos sensibles

Tratar como sensibles:

- identidad de personas;
- emails y teléfonos;
- datos de menores;
- roles y permisos;
- relaciones familiares;
- documentos personales;
- información financiera;
- cuentas y movimientos;
- fotografías y vídeos;
- información médica;
- viviendas y propiedades;
- actividades y localizaciones;
- cualquier dato exportable o asociable a una persona.

---

## API y base de datos

Las APIs deben:

- validar todas las entradas;
- aplicar autenticación y autorización en backend;
- verificar ownership y relaciones;
- devolver errores controlados;
- no exponer errores internos de PostgreSQL;
- no devolver más información de la necesaria;
- evitar accesos cruzados no autorizados;
- evitar actualizaciones masivas no controladas;
- mantener separación clara entre recursos y permisos.

React nunca accederá directamente a PostgreSQL.

---

## Autenticación y autorización

No debe debilitarse la autenticación por conveniencia.

No debe confiarse únicamente en el frontend para proteger datos.

No debe asumirse que un usuario autenticado puede acceder a cualquier recurso.

Los cambios en autenticación, permisos, ownership o acceso a datos requieren revisión previa de la documentación y del código real.

---

## Producción

Antes de producción deben revisarse:

- variables de entorno;
- CORS;
- HTTPS;
- gestión de secretos;
- logs;
- errores expuestos;
- permisos;
- acceso a archivos;
- aislamiento de datos;
- políticas de acceso;
- copias de seguridad;
- recuperación;
- configuración de PostgreSQL;
- almacenamiento externo;
- despliegue;
- acceso al VPS.

---

## Regla final

Si una decisión tiene implicaciones de seguridad o privacidad, debe indicarse explícitamente antes de implementarla.

Los cambios sensibles requieren revisar la documentación y el código real.