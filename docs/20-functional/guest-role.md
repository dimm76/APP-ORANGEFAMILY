# Rol Invitado

Un invitado es un miembro real de la familia con `family_memberships.role = guest`.

Utiliza la misma creación de usuario, autenticación, activación y email que un familiar.

## Alta

El alta se realiza desde Ajustes → Familiares mediante el mismo formulario y email de activación.

## Módulos

El rol Invitado solo puede tener acceso a OrangePhotos.

## Álbumes

El acceso a álbumes concretos se concede mediante ACL a un usuario ya existente. OrangePhotos no crea identidades ni cuentas.

## Aplicación

El rol Invitado utiliza las mismas rutas y componentes:

- `/app/orangephotos`
- `/app/orangephotos/albums`
- `/app/orangephotos/albums/:albumId`

No existe portal ni layout independiente.

## Navegación

El invitado solo ve Fotos y Álbumes. No puede acceder a otros módulos ni a Ajustes.

## Fase 2

La visualización, selección, visor y descarga se integran en OrangePhotos normal. La subida restringida y la papelera de aportaciones propias quedan para la Fase 3.

## Autorizaci�n de lectura

El rol Invitado accede a los �lbumes mediante `orange_photo_album_access` con `subject_type = family`, `status = active` y `revoked_at IS NULL`. Las tablas hist�ricas de invitados externos no participan en la lectura del nuevo rol Invitado.

## Fase 2 completada

La Fase 2 integra en OrangePhotos normal el listado de �lbumes accesibles, aportaciones propias, detalle de �lbum, selecci�n, visor, descarga individual y descarga ZIP dentro de un �nico �lbum.

La subida restringida y la papelera de aportaciones propias corresponden a la Fase 3.
# Rol Invitado

Un invitado es un miembro real de la familia con `family_memberships.role = guest`.

## Fase 3

El invitado puede importar fotos y vídeos, acceder únicamente a álbumes concedidos, añadir aportaciones cuando `allow_contributions = true`, visualizar, descargar y enviar a la papelera únicamente sus propias aportaciones.

El invitado no puede crear álbumes o categorías, compartir, modificar fotos ajenas, marcar fotos ajenas como favoritas ni eliminar fotos ajenas. En selecciones mixtas se informa de los elementos propios que se eliminarán y los ajenos que se omitirán.

La propiedad de una foto importada siempre procede de la sesión autenticada; el frontend no puede elegir `owner_user_id`.

No declarar la Fase 3 completada hasta realizar la prueba manual.