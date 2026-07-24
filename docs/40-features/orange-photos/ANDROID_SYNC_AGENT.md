# Agente Android de sincronización de Orange Photos

## Propósito

El agente Android es una APK privada cuya función prevista es detectar y subir automáticamente a OrangeFamily las fotos y los vídeos nuevos del dispositivo.

La aplicación web continúa siendo el gestor y visor principal de Orange Photos.

## Ubicación y tecnología

- Proyecto: `mobile/orange-photos-sync-agent`.
- Implementación: Kotlin nativo.
- Interfaz mínima: Jetpack Compose.

## Arquitectura

```text
Android MediaStore
  → cola local persistente
  → WorkManager
  → API Node de OrangeFamily
  → PostgreSQL y Wasabi
```

Android nunca debe acceder directamente a PostgreSQL ni a Wasabi. Node mantiene la autenticación, autorización, validaciones, ownership, lógica de negocio y acceso a datos y almacenamiento.

## API compartida

El agente utiliza la misma API Node que la aplicación web. No se crearán APIs específicas para Android salvo que una necesidad funcional real requiera ampliar el contrato compartido para todos los clientes.

La autenticación reutiliza los endpoints existentes:

- `POST /api/auth/login`;
- `GET /api/auth/me`;
- `POST /api/auth/logout`.

## Seguridad

- No almacenar la contraseña.
- Conservar únicamente la sesión entregada por Node.
- Proteger la sesión mediante Android Keystore.
- Excluir los datos de sesión de copias de seguridad y transferencias del dispositivo.
- Invalidar la sesión local cuando cambie el entorno o el host configurado.
- No incluir nunca credenciales de Wasabi en la APK.

## Entornos

- Desarrollo: API local.
- Emulador Android: `10.0.2.2` como acceso al equipo anfitrión.
- Dispositivo físico: IP LAN del ordenador o `adb reverse`.
- Producción: HTTPS.
- La URL concreta de producción debe obtenerse de la configuración real de despliegue antes de implementar; no queda fijada en este documento.
- HTTP cleartext solo puede permitirse en builds de debug.

## Primera fase

La primera fase queda limitada a:

- login;
- restauración y comprobación de sesión;
- pantalla mínima de estado;
- cierre de sesión;
- configuración diferenciada de debug y release.

## Fase posterior de sincronización

Una fase posterior deberá abordar:

- permiso de acceso a fotos y vídeos;
- detección de elementos nuevos;
- cola local persistente;
- subida automática;
- reintentos;
- restricciones de red;
- notificaciones;
- comprobación de duplicados.

## Fuera del alcance inicial

- Galería conjunta de contenido local y nube.
- Borrado de archivos del móvil.
- Sincronización bidireccional.
- Edición de fotografías.
- Acceso directo a Wasabi.
- Importación histórica automática.

## Criterios funcionales previstos

- Sincronizar inicialmente el contenido de Cámara.
- Admitir fotos y vídeos.
- Procesar únicamente elementos nuevos desde la activación.
- Conservar los archivos originales.
- No eliminar contenido local.
- Evitar duplicados.
- Registrar errores y aplicar reintentos controlados.

## Estado actual

- El proyecto Android está creado.
- El build inicial es correcto.
- La autenticación todavía no está implementada.
- La sincronización automática todavía no está implementada.

## Documentos relacionados

- [Orange Photos](README.md).
- [Almacenamiento de Orange Photos](STORAGE.md).
- [Estado de API y autenticación](../../20-development/API_AND_AUTH_STATUS.md).
- [Arquitectura de la API](../../10-architecture/API.md).
- [Seguridad y protección de datos](../../20-development/SECURITY_AND_DATA_PROTECTION.md).
- [Despliegue de producción](../../50-operations/PRODUCTION_DEPLOYMENT.md).
