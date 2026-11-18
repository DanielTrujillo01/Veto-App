# Entorno local de Veto

El entorno de Docker Compose usa una base PostgreSQL propia en un volumen local. No lee .env ni copia archivos de entorno a las imágenes. La API apunta explícitamente al servicio db; las migraciones y el seed están restringidos a esa base.

## Arrancar

Desde la raíz del repositorio:

    docker compose up --build -d

Abre la web en http://localhost:3000, Swagger en http://localhost:3001/api/docs y el buzón local de recuperación de contraseña en http://localhost:8025.

Para levantar también el prototipo Figma:

    docker compose --profile prototype up --build -d figma

El prototipo está en http://localhost:8443.

## Cuentas locales

Todas las cuentas de demostración usan la contraseña VetoLocal2026!

| Rol                       | Correo                         |
| ------------------------- | ------------------------------ |
| Tutor                     | tutor@veto.local               |
| Administrador de clínica  | clinica@veto.local             |
| Veterinario de clínica    | veterinario@veto.local         |
| Veterinario independiente | vet.independiente@veto.local   |
| Administrador de tienda   | tienda@veto.local              |
| Fundación activa          | fundacion@veto.local           |
| Fundación pendiente       | fundacion.pendiente@veto.local |
| Equipo Veto               | equipo@veto.local              |

Los datos incluyen perfiles y aliados activos, una fundación pendiente para revisión, dos mascotas del tutor, clínicas y veterinario independiente con sedes, servicios, horarios semanales, productos, mascotas disponibles para adopción, una cita futura y una notificación.

La recuperación de contraseña se prueba con Mailpit y no envía correos reales. El inicio con Google requiere credenciales OAuth externas y queda desactivado en este entorno.

## Base de datos

El servicio publica PostgreSQL en localhost:5440 con la base veto. migrate aplica las migraciones y seed inserta datos de demostración antes de iniciar API y web. El seed es idempotente: volver a iniciar Compose no duplica datos ni reinicia registros existentes.

Para ejecutar las pruebas SQL:

    docker compose exec api pnpm db:test

Los tests del workspace pueden ejecutarse dentro del contenedor API:

    docker compose exec api pnpm test
    docker compose exec api pnpm typecheck
    docker compose exec api pnpm build

Para detener el entorno sin eliminar datos:

    docker compose down

El volumen se conserva. El seed no borra datos ni modifica registros ya creados.
