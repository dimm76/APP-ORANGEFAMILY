# Rol Invitado

Un invitado es un miembro real de la familia con `family_memberships.role = guest`.

Utiliza la misma creaci√≥n de usuario, autenticaci√≥n, activaci√≥n y email que un familiar.

## Alta

El alta se realiza desde Ajustes ‚Üí Familiares mediante el mismo formulario y email de activaci√≥n.

## M√≥dulos

El rol Invitado solo puede tener acceso a OrangePhotos.

## √Ålbumes

El acceso a √°lbumes concretos se concede mediante ACL a un usuario ya existente. OrangePhotos no crea identidades ni cuentas.

## Aplicaci√≥n

El rol Invitado utiliza las mismas rutas y componentes:

- `/app/orangephotos`
- `/app/orangephotos/albums`
- `/app/orangephotos/albums/:albumId`

No existe portal ni layout independiente.

## Navegaci√≥n

El invitado solo ve Fotos y √Ålbumes. No puede acceder a otros m√≥dulos ni a Ajustes.

## Fase 2

La visualizaci√≥n, selecci√≥n, visor y descarga se integran en OrangePhotos normal. La subida restringida y la papelera de aportaciones propias quedan para la Fase 3.

## AutorizaciÛn de lectura

El rol Invitado accede a los ·lbumes mediante `orange_photo_album_access` con `subject_type = family`, `status = active` y `revoked_at IS NULL`. Las tablas histÛricas de invitados externos no participan en la lectura del nuevo rol Invitado.

## Fase 2 completada

La Fase 2 integra en OrangePhotos normal el listado de ·lbumes accesibles, aportaciones propias, detalle de ·lbum, selecciÛn, visor, descarga individual y descarga ZIP dentro de un ˙nico ·lbum.

La subida restringida y la papelera de aportaciones propias corresponden a la Fase 3.
