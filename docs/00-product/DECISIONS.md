## Decisiones abiertas de producto

- Definición exacta de la unidad familiar dentro del sistema.
- Relación entre personas y usuarios.
- Modelo inicial de permisos.
- Gestión de información privada o restringida.
- Incorporación de nuevos miembros.
- Conservación y eliminación de información histórica.
- Alcance inicial de las relaciones entre entidades.
- Posible soporte futuro para más de una unidad familiar.
# PostgreSQL como índice de respaldo para archivos Android

Android compara hashes mediante la API Node; Node consulta PostgreSQL y Android
no lista Wasabi. La navegación normal no comprueba cada objeto físico.
`BACKED_UP` exige hash exacto y estado remoto válido; nombre y tamaño producen
como máximo `POSSIBLE_MATCH`. El borrado local nunca elimina la copia remota.

Esto reduce coste y latencia, evita credenciales Wasabi en Android y centraliza
privacidad, a cambio de mantener hashes/estados fiables en PostgreSQL y disponer
de una verificación separada para inconsistencias del almacenamiento.
