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
