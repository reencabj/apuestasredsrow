# Conectar EL CLUB DE LA PERREA

La URL y la clave pública del proyecto ya están configuradas en `src/supabase-config.js`. La app pide acceso con cuenta. Falta instalar las tablas y autorizar usuarios en el proyecto. Los datos locales no se suben automáticamente y permanecen guardados en el navegador anterior.

1. En el proyecto `hxtmkfhdhohwfqszuaty`, abrir SQL Editor y ejecutar `supabase/setup.sql` una sola vez. Crea un tablero compartido, la lista de miembros y el guardado con control de versión.
2. En Authentication > Users, crear las cuentas de las personas autorizadas (email y contraseña). Desactivar el registro público si no se necesita.
3. Para cada cuenta, copiar su UUID y ejecutar en SQL Editor:

```sql
insert into public.club_members(user_id) values ('UUID-DEL-USUARIO');
```

4. Copiar la clave **publishable** o **anon** del proyecto en `publishableKey` de `src/supabase-config.js`. Usar la URL base `https://hxtmkfhdhohwfqszuaty.supabase.co`, sin `/rest/v1/`. Nunca usar una clave `service_role` o `sb_secret` en la página.
5. Recargar la página e iniciar sesión. Todas las cuentas autorizadas comparten las mismas peleas y contactos, y pueden cargar, borrar, cerrar, reabrir y archivar. No se agrega una vista pública.
6. Si el tablero online está vacío, aparece **Importar apuestas de este navegador**. Importa peleas y contactos del navegador actual y conserva el respaldo local. Ejecutarlo en el navegador donde se cargaron los datos anteriores. Si dos personas importan al mismo tiempo, el control de versión evita que una pise a la otra.
7. Para GitHub Pages subir también los nuevos archivos de `src`. No se necesita servidor propio ni compilación. Se descarga el cliente de Supabase desde esm.sh solo cuando está configurado.

## Comprobación antes de usar con datos reales

- Cuenta autorizada: puede cargar el tablero y guardar cambios.
- Sin iniciar sesión o con una cuenta no incluida en `club_members`: no puede leer ni escribir.
- Dos navegadores: crear una pelea y comprobar que aparece en el otro en unos 5 segundos.
- Cambios simultáneos: un guardado desactualizado muestra un error; pulsar **Actualizar** y repetir. No combina cambios automáticamente.
- Cortar la conexión: un cambio fallido no debe anunciarse como guardado; se conservan los campos de apuesta para repetirlo.
- Archivar y recuperar: reflejar el cambio en ambos navegadores.
- Contactos: un nombre cargado por una cuenta debe poder seleccionarse desde la otra.

## Alcance

Esta primera integración guarda el tablero y contactos como un documento JSON con versión. Es adecuada para el flujo actual: escrituras con conflictos detectados, sincronización cada 5 segundos mientras la pestaña está visible y sin guardado offline. Para muchas cargas simultáneas conviene pasar a tablas por pelea y apuesta. Las comprobaciones unitarias no sustituyen la prueba de permisos y conexiones en el proyecto real.

Para revocar una cuenta, eliminar su fila de `club_members` desde SQL Editor. La autorización se verifica en la base de datos, no solo en la página.
