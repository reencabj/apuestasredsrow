# EL CLUB DE LA PERREA

App de apuestas de Reds Row: peleas, multiplicadores actualizados, reparto con 10% para la casa, contactos recordados y archivo de peleas.

## Publicación

En Settings > Pages elegir GitHub Actions. Al subir cambios a main, el workflow ejecuta las pruebas y publica únicamente index.html y src.

Dirección: https://clubdelaperrea.reenz.site/

## Supabase

La URL y clave pública están configuradas. La clave pública está diseñada para usarse en el navegador; los permisos se controlan en la base de datos.

Seguir [SUPABASE.md](SUPABASE.md) para instalar las tablas, crear cuentas y autorizar usuarios. Sin la instalación, iniciar sesión no permite cargar el tablero.

Las cuentas autorizadas comparten los datos, con actualización cada 5 segundos. Los conflictos de guardado se rechazan para evitar sobrescribir cambios.

Los datos del navegador local no pasan automáticamente a GitHub Pages. Importarlos requiere acceder desde el navegador/origen donde están guardados, conectado al mismo proyecto de Supabase.

## Pruebas

Con Node.js instalado, ejecutar `npm test`. No requiere instalar paquetes para las pruebas.
