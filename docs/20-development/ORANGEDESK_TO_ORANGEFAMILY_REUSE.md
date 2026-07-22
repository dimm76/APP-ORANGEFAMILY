reutilización de OrangeDesk en OrangeFamily

Estamos construyendo OrangeFamily reutilizando la infraestructura técnica y visual consolidada de APP-ORANGEDESK, pero sin trasladar la lógica de negocio del CRM.

No se trata de copiar toda la aplicación de OrangeDesk, sino de avanzar módulo a módulo:

revisar documentación y código real de ambos proyectos;
identificar componentes, servicios y patrones reutilizables;
copiarlos únicamente cuando aporten valor;
adaptarlos al modelo familiar de OrangeFamily;
aplicar siempre cambio mínimo;
no arrastrar lógica específica de clientes, contratos, facturación u otros dominios CRM.
Arquitectura de OrangeFamily
Frontend: React + Ionic
Backend: Node.js
Base de datos: PostgreSQL
API compartida para web y futura aplicación Android
Repositorio: dimm76/APP-ORANGEFAMILY
Rama principal: main

Rutas locales:

OrangeFamily:
C:\Users\dimm7\local-sites\APP-ORANGEFAMILY

OrangeDesk:
C:\Users\dimm7\local-sites\APP-ORANGEDESK
Regla visual

La documentación de OrangeFamily ya establece que se reutilizará el sistema visual de OrangeDesk:

docs/10-architecture/UI-STYLE-GUIDE.md

Esto incluye:

Ionic;
tokens CSS;
clases od-*;
estilos compactos;
componentes visuales;
patrones de tablas, filtros, formularios, modales e iconos.

OrangeFamily sigue siendo un producto independiente, pero no debe inventar un segundo sistema visual si OrangeDesk ya dispone del patrón necesario.

Trabajo completado
1. Modelo inicial de identidad y autenticación

Se creó y ejecutó en orangefamily_local la migración:

docs/30-database/migration/20260722120000_initial_identity_and_auth.sql

Tablas creadas:

families
persons
family_memberships
auth_users
auth_sessions
auth_password_reset_tokens
audit_logs

Relación principal:

auth_users
  → persons
  → family_memberships
  → families

OrangeFamily no utiliza la tabla profiles de OrangeDesk.

2. Backend de autenticación reutilizado

Se reutilizó y adaptó la autenticación técnica de OrangeDesk:

backend/src/auth.js
backend/src/passwordCrypto.js
backend/scripts/bootstrap-admin.js
backend/app.js
backend/package.json
backend/.env.example

Funcionalidades disponibles:

POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
GET  /api/health

Características:

contraseñas con scrypt;
sesiones mediante cookie HttpOnly;
cookie of_session;
SameSite=Lax;
token de sesión almacenado mediante hash SHA-256;
bloqueo después de intentos fallidos;
auditoría;
bootstrap transaccional de usuario, persona, familia y membresía owner.

El backend funciona en:

http://localhost:3001

El healthcheck devuelve conexión correcta con PostgreSQL.

3. Usuario inicial

El usuario administrador se crea con:

$env:BOOTSTRAP_ADMIN_EMAIL="..."
$env:BOOTSTRAP_ADMIN_PASSWORD="..."
$env:BOOTSTRAP_ADMIN_FIRST_NAME="Diego"
$env:BOOTSTRAP_ADMIN_LAST_NAME="Medina"
$env:BOOTSTRAP_ADMIN_FAMILY_NAME="Familia Medina"

npm run bootstrap-admin

La variable correcta de familia es:

BOOTSTRAP_ADMIN_FAMILY_NAME

No BOOTSTRAP_FAMILY_NAME.

4. Frontend de autenticación reutilizado

Se copiaron y adaptaron desde OrangeDesk:

src/app/app-login.css
src/app/authContext.js
src/app/AuthGate.jsx
src/app/LoginPage.jsx
src/shared/api/authApi.js

También se modificaron:

src/App.jsx
src/main.jsx
src/index.css
package.json
package-lock.json

Se instalaron:

@ionic/react
ionicons

El frontend usa:

AuthGate para comprobar la sesión;
LoginPage si no existe usuario autenticado;
credentials: "include" en las llamadas;
IonApp, IonPage, IonContent, IonInput, IonButton, etc.;
el layout 30/70 y el CSS del login de OrangeDesk;
el nombre visual OrangeFamily.
5. Problemas corregidos

El login inicialmente aparecía sin estilos por dos causas:

CSS inicial de Vite

src/index.css contenía estilos incompatibles:

modo oscuro automático;
#root con ancho fijo;
centrado global;
títulos globales;
tokens morados;
estilos nativos que pisaban Ionic.

Se sustituyó por una base global compatible con OrangeDesk/Ionic.

Ionic no estaba inicializado

Aunque Ionic estaba instalado y sus CSS importados, faltaba:

import { setupIonicReact } from "@ionic/react";

setupIonicReact();

Se añadió en:

src/main.jsx

Después de reiniciar Vite, el login quedó correctamente estilizado.

Estado de las validaciones

Correctas:

npm run build
npx eslint src
git diff --check

npm run lint global falla porque ESLint también analiza el backend CommonJS y la configuración actual no declara correctamente:

require
process
module
Buffer

Eso queda pendiente como tarea separada. No debe mezclarse con la reutilización de módulos.

Git

Se preparó un commit acotado con los archivos de autenticación, identidad y frontend.

No deben incluirse accidentalmente:

backend/.env
README.md
eslint.config.js

backend/.env está correctamente ignorado por .gitignore.

No usar git add . mientras existan archivos no relacionados.

Criterio para los próximos módulos

Cada nueva funcionalidad debe seguir este proceso:

Revisar la documentación relevante en docs/.
Revisar la implementación actual de OrangeFamily.
Localizar el módulo equivalente en APP-ORANGEDESK.
Separar:
infraestructura reutilizable;
interfaz reutilizable;
lógica específica del CRM que debe descartarse.
Identificar exactamente los archivos afectados.
Copiar únicamente los archivos necesarios.
Adaptar nombres, API y modelo de datos al dominio familiar.
No refactorizar módulos ajenos.
No añadir dependencias salvo que formen parte real de la infraestructura reutilizada.
Validar antes de hacer commit.
Principio esencial
Reutilizar infraestructura técnica y visual de OrangeDesk.
Nunca reutilizar automáticamente su lógica de negocio.