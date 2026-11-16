# Proceso A · Contexto actual del proyecto Veto

**Versión:** 1.0
**Fecha de revisión:** 2026-11-16
**Alcance:** documentación de contexto obtenida del código, las migraciones y la documentación
existente del repositorio. No introduce ni modifica comportamiento del producto.

> Esta guía refleja la estructura encontrada en esta revisión. Para contratos HTTP, consultar
> [`../api-backend.md`](./api-backend.md); para decisiones históricas de arquitectura, consultar
> [`../adr/0001-arquitectura.md`](../../adr/0001-arquitectura.md). Si una descripción antigua contradice
> el código y las migraciones actuales, estos últimos son la referencia para el comportamiento
> implementado.

## 1. Resumen del sistema

Veto es una plataforma para tutores de mascotas, clínicas, veterinarios independientes, tiendas,
fundaciones y el Equipo Veto. El repositorio es un monorepo pnpm con una aplicación web, una API,
un prototipo visual, contratos compartidos y una base de datos PostgreSQL.

La solución está organizada como un **monolito modular**: la API NestJS se despliega como una
aplicación y divide el código por dominio. La web consume la API mediante HTTP; el acceso a
PostgreSQL lo realiza la API.

## 2. Arquitectura y tecnologías

| Componente            | Tecnología y responsabilidad                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Workspace             | pnpm 10.34.9; Node.js 22 o superior.                                                                              |
| Web de producción     | Next.js 16, React 19, TypeScript y Tailwind CSS 4; App Router en `frontend/web/`.                                 |
| Prototipo de interfaz | React 19, Vite 8, TypeScript y Tailwind CSS 4 en `frontend/figma/`; no es la aplicación web de producción.        |
| API                   | NestJS 11, TypeScript, Swagger/OpenAPI, Zod y `pg` en `apps/api/`.                                                |
| Contratos compartidos | `@veto/shared`: esquemas Zod, tipos y enums usados por la API y la web; no contiene lógica de negocio.            |
| Persistencia          | PostgreSQL 17 en el entorno Docker local. SQL versionado en `db/migrations/`; el modelo define el esquema `veto`. |
| Calidad               | ESLint, Prettier, Jest (API), Vitest (web y shared) y CI de GitHub Actions.                                       |

### Flujo y límites entre componentes

1. El navegador usa la aplicación Next.js.
2. Las solicitudes web al backend pasan por `frontend/web/src/lib/api.ts`, usan la URL
   `NEXT_PUBLIC_API_URL`, envían credenciales de sesión y deshabilitan la caché HTTP.
3. La API valida entradas con esquemas de `@veto/shared`, aplica autenticación/autorización y
   ejecuta consultas SQL parametrizadas con `pg`.
4. Las reglas que deben sostenerse incluso frente a escrituras SQL directas están reforzadas en
   PostgreSQL mediante claves, restricciones, funciones y triggers.
5. `DatabaseService.withUser()` envuelve en una transacción las escrituras atribuidas a una persona
   y establece `app.usuario_id` para la auditoría y las reglas de la base.

### Organización relevante

| Ruta                     | Contenido                                         |
| ------------------------ | ------------------------------------------------- |
| `apps/api/src/modules/`  | Módulos de dominio de la API.                     |
| `apps/api/src/database/` | Pool PostgreSQL y transacciones de usuario.       |
| `apps/api/src/config/`   | Lectura y validación de configuración.            |
| `frontend/web/src/app/`  | Páginas de la aplicación Next.js.                 |
| `frontend/web/src/lib/`  | Cliente de API, sesión y presentación de errores. |
| `frontend/figma/src/`    | Prototipo Figma Make.                             |
| `packages/shared/src/`   | Tipos y validaciones compartidos.                 |
| `db/migrations/`         | Migraciones SQL aplicadas por `db/migrate.mjs`.   |
| `db/tests/`              | Pruebas SQL de reglas de la base.                 |
| `docs/adr/`              | Decisiones de arquitectura.                       |

## 3. Módulos y cobertura HTTP

En esta revisión se contrastaron las declaraciones de rutas de los controladores con
[`../api-backend.md`](./api-backend.md): hay **89 rutas de aplicación**, además de
`GET /api/health` (90 en total).

| Área                                                         | Rutas actuales | Observación de alcance                                                                |
| ------------------------------------------------------------ | -------------: | ------------------------------------------------------------------------------------- |
| Identidad, sesión, recuperación de contraseña, TOTP y Google |             22 | Incluye las rutas de registro de tutor y operaciones de cuenta.                       |
| Aliados, fundaciones, clínicas, veterinarios y sedes         |             21 | Incluye revisión de fundaciones, perfil y configuración del aliado.                   |
| Servicios, precios, horarios, disponibilidad y bloqueos      |             18 | Incluye consulta de disponibilidad y gestión de agenda.                               |
| Mascotas                                                     |              5 | Catálogo de especies y operaciones del tutor.                                         |
| Consultas clínicas                                           |              2 | Lectura de consultas del veterinario autenticado.                                     |
| Reservas y ciclo de vida de citas                            |             10 | Selección temporal, resumen, confirmación, detalle, cierre, historial e inasistencia. |
| Adopciones                                                   |              6 | Catálogo, detalle y gestión de publicaciones con medios.                              |
| Comercio                                                     |              1 | Catálogo público de productos con orden opcional.                                     |
| Administración de fundaciones                                |              4 | Acciones de Equipo Veto.                                                              |
| Salud                                                        |              1 | `GET /api/health`.                                                                    |

Los módulos `reservas` y `gestion-citas` exponen rutas para selección de horario, confirmación, detalle, finalización e inasistencia. `adopcion` publica el catálogo y permite a las fundaciones administrar publicaciones; `comercio` expone el catálogo público de productos. No se encontraron rutas HTTP para operar pedidos, gestionar solicitudes de adopción, consultar reportes ni leer notificaciones.

## 4. Modelo de datos vigente

El esquema es relacional y usa SQL directo; no hay un ORM. La migración base crea 25 tablas para
los dominios esenciales y las migraciones posteriores agregan 10 tablas. El estado acumulado de las
migraciones revisadas contiene **35 tablas**, **15 tipos enumerados** y **6 vistas**.

| Dominio                    | Tablas actuales                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Catálogos                  | `especie`, `tipo_servicio`, `categoria_producto`                                                                                                                                                       |
| Identidad y organizaciones | `usuario`, `sesion`, `cuenta_google`, `google_estado_oauth`, `google_reautenticacion`, `google_pendiente`, `desafio_2fa`, `recuperacion_contrasena`, `aliado`, `aliado_especie`, `veterinario`, `sede` |
| Mascotas                   | `mascota`, `mascota_foto`                                                                                                                                                                              |
| Servicios y agenda         | `servicio`, `servicio_regla_precio`, `horario`, `bloqueo_agenda`                                                                                                                                       |
| Citas e historia clínica   | `cita`, `seleccion_horario`, `historial_estado`, `consulta`, `consulta_anotacion`                                                                                                                      |
| Comercio                   | `producto`, `producto_foto`, `pedido`, `pedido_item`                                                                                                                                                   |
| Adopción                   | `mascota_adopcion`, `mascota_adopcion_media`, `solicitud_adopcion`                                                                                                                                     |
| Administración y avisos    | `accion_admin`, `notificacion`                                                                                                                                                                         |

Vistas definidas por las migraciones: `v_historial_mascota`, `v_catalogo_adopcion`,
`v_citas_reporte`, `v_ventas_productos`, `v_consulta_detalle` y `v_cita_detalle`.

Las migraciones también registran tipos ENUM, índices y reglas SQL. El inventario anterior cuenta
las declaraciones encontradas en los archivos versionados; no representa una inspección de una
instancia de base de datos en ejecución.

### Reglas que el modelo de datos aplica

- Correo único sin distinguir mayúsculas; el número de celular debe tener diez dígitos.
- Llaves foráneas y restricciones de tipo/propiedad para limitar relaciones inválidas.
- No se permite solapar citas vigentes del mismo veterinario; la disponibilidad considera horarios,
  bloqueos y citas.
- El estado inicial de una cita se decide según el modo de confirmación del aliado: automática o
  manual. Una cita pendiente también ocupa el horario.
- La función `fn_precio_servicio` calcula el precio aplicable según las reglas configuradas; el
  precio base cubre los casos sin regla aplicable o sin datos suficientes.
- Una consulta cerrada y los registros de auditoría/anotación son inmutables conforme a las reglas
  de la base.
- Las operaciones de pedido y sus ítems actualizan el stock bajo las restricciones del esquema.
- La base limita solicitudes activas duplicadas de adopción y exige motivo para ciertos rechazos.
- La publicación de mascotas de adopción y los cambios de estado de aliados están sujetos a la
  condición de fundación/aliado activo y a la auditoría correspondiente.

Estas reglas se describen con más detalle en [`../modelo-de-datos.md`](../../modelo-de-datos.md). Ese
documento presenta el modelo de las historias esenciales; las ocho tablas añadidas por migraciones
posteriores y los totales anteriores reflejan el estado acumulado del repositorio actual.

## 5. Reglas de negocio relevantes

1. **Identidad y permisos:** las operaciones privadas requieren sesión; los permisos se verifican
   por rol y por relación con el recurso. Los veterinarios se obtienen del perfil autenticado, no de
   un identificador arbitrario del cliente.
2. **Propiedad de datos:** el tutor solo accede a sus mascotas. Para recursos privados ajenos o
   inexistentes, el backend puede responder `404` para no revelar su existencia.
3. **Cuenta del aliado:** las fundaciones se registran como pendientes y su aprobación/rechazo
   corresponde a `EQUIPO_VETO`; las decisiones se registran en la auditoría.
4. **Servicios:** un servicio se desactiva en vez de borrarse; las citas ya creadas conservan el
   precio guardado.
5. **Agenda y reservas:** la selección temporal de horario no bloquea el cupo. La confirmación revalida disponibilidad, especie atendida y datos de la mascota; el estado inicial depende de la configuración del aliado. El cierre solo admite citas agendadas cuya hora de inicio ya llegó; se registra en el historial y genera una notificación al tutor.
6. **Registro clínico:** una consulta cerrada no se modifica directamente; el esquema contempla
   anotaciones para correcciones.
7. **Trazabilidad:** los cambios de estado deben quedar asociados al actor mediante la transacción
   con `withUser()`.
8. **Adopción y comercio:** las fundaciones activas pueden publicar y administrar mascotas en adopción con transiciones de estado definidas; el catálogo público solo muestra publicaciones disponibles. El catálogo de productos es público y permite ordenar resultados. La operación de pedidos aún no tiene rutas HTTP.

Las reglas de negocio documentadas por el modelo incluyen decisiones de alcance y supuestos del
backlog; deben distinguirse de las reglas que ya tienen una ruta de API que las exponga.

## 6. Índice de historias de usuario (HU)

No se encontró un catálogo fuente de HUs con sus títulos y estado de entrega. El índice disponible
en [`../modelo-de-datos.md`](../../modelo-de-datos.md) indica 95 historias y agrupa 55 como esenciales
y 40 como excluidas/condicionales u opcionales, según la prioridad inferida de un archivo de
backlog no incluido aquí. Por ello, esta lista sirve como **índice de referencias**, no como una
certificación de prioridad ni de implementación.

### HUs marcadas como esenciales en el modelo

`HU-001`, `002`, `006`, `007`; `008–011`; `012–017`; `018–022`; `024–026`; `028–029`;
`031–032`; `034`; `037`; `042–043`; `044–050`; `052`; `054`; `065–067`; `070`; `073–074`;
`078`; `080`; `082–083`; `086–087`; `090`; `092–094`.

### HUs agrupadas como excluidas/condicionales u opcionales en el modelo

| Área descrita en el modelo | HUs                                                 |
| -------------------------- | --------------------------------------------------- |
| Acceso avanzado            | `HU-003–005`                                        |
| Monetización               | `HU-055–060`                                        |
| Reseñas                    | `HU-061–064`                                        |
| PQRS                       | `HU-068–069`                                        |
| Correos y recordatorios    | `HU-051`, `053`                                     |
| Detalle de cita y consulta | `HU-023`, `027`, `030`, `033`, `035–036`, `038–041` |
| Dashboards adicionales     | `HU-071–072`, `075–077`                             |
| Adopción complementaria    | `HU-079`, `081`, `084–085`, `088–089`, `091`, `095` |

### Evidencia de implementación y discrepancias

Los nombres de pruebas de API vigentes incluyen, entre otros, `hu001-hu007-registro`,
`hu003-google`, `hu004-recuperacion-contrasena`, `hu009-varias-mascotas`, `hu013-veterinarios`,
`hu015-sedes`, `hu020-precios`, `hu078-registro-fundacion` y `hu079-fundaciones`.
Las pruebas de API recientes incluyen `hu029-seleccion-horario`, `hu030-motivo-cita`, `hu031-reservar-cita` y `hu032-hu033-cierre-de-cita`; también hay pruebas de adopción y de los contratos compartidos de reserva y gestión de citas.

La prioridad histórica no equivale al estado del código: por ejemplo, el modelo agrupa `HU-003`,
`HU-004`, `HU-023` y `HU-079` entre las excluidas, mientras que el repositorio actual contiene
implementación y pruebas relacionadas con ellas. La clasificación debe confirmarse contra el
backlog oficial antes de usarla para planificar entregas.

[`../HU.md`](../HUs/HU.md) contiene una plantilla/instrucción para analizar una HU individual; no es el
índice maestro ni el conjunto de historias individuales.

## 7. Convenciones de desarrollo y errores

### API y validación

- Prefijo global `/api`; solicitudes y respuestas JSON, salvo navegaciones OAuth.
- Contratos de entrada y respuestas comparten nombres en español y propiedades `camelCase`.
- Las entradas se validan con `validar()` y esquemas Zod de `@veto/shared`.
- Error de validación: HTTP `400` con `{ "message": "Revisa los datos ingresados", "errores": { "campo": "mensaje" } }`.
- Los demás errores utilizan el formato de excepciones NestJS: `{ "message": "...", "error": "...", "statusCode": n }`.
- Códigos documentados por la API: `400` datos inválidos, `401` sesión/credencial no válida,
  `403` rol o permiso insuficiente, `404` recurso no disponible para el actor, `409` conflicto de
  negocio y `503` dependencia externa no disponible.
- `esErrorPg()` permite reconocer errores PostgreSQL para los códigos de unicidad, llave foránea,
  `CHECK` y exclusión; su traducción HTTP se maneja según la operación.
- No hay un envoltorio general `{ data }`; los contratos de identidad usan objetos como `{ usuario }`.
- Sesión por cookie `veto_session` `HttpOnly`; CORS permite credenciales desde `WEB_ORIGIN`.
- Google OAuth usa navegación/redirect del navegador y cookies temporales, no un flujo ordinario de
  `fetch`.

### Persistencia y autorización

- El código accede con `pg` y SQL parametrizado; no se usa un ORM.
- Las escrituras atribuidas a un usuario pasan por `DatabaseService.withUser(usuarioId, fn)`.
- Usar guardias de autenticación/rol y comprobar propiedad del recurso dentro de la consulta o
  servicio; no aceptar al actor desde el body o un header.
- Los módulos de dominio son responsables de sus tablas. Las migraciones ya aplicadas no se editan:
  cada cambio de esquema se agrega en un archivo nuevo de `db/migrations/`.

### Web, pruebas y colaboración

- Las llamadas de la web pasan por `frontend/web/src/lib/api.ts`; la interfaz consume los errores
  mediante `ApiError`.
- Formularios usan los esquemas compartidos cuando están disponibles.
- La guía de contribución define commits Conventional Commits en español, ramas por HU cuando
  aplica, formato Prettier y revisión por pull request.
- Comandos de validación del workspace: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`,
  `pnpm test`; para cambios SQL, `pnpm db:migrate` y `pnpm db:test`.

### Configuración sensible al flujo actual

La API requiere `DATABASE_URL`; también admite `API_PORT` y `WEB_ORIGIN`. Google OAuth se habilita
con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. La recuperación por correo actual usa `SMTP_URL`
y `SMTP_FROM`. Las variables se validan en `apps/api/src/config/env.ts`; sus valores reales deben
mantenerse fuera de la documentación y del control de versiones.

## 8. Límites y actualización de este contexto

- Esta revisión fue estática: se contrastaron controladores, migraciones, paquetes y documentación.
  Los conteos de rutas y objetos de base se obtuvieron de los archivos versionados, no de un
  despliegue en ejecución.
- `docs/modelo-de-datos.md` se enfoca en las historias esenciales del modelo base; su conteo no
  incluye las tablas agregadas por todas las migraciones posteriores.
- No se halló un backlog fuente con títulos/estados de todas las HUs. Los nombres de archivos de
  pruebas y las referencias en documentación no bastan para declarar una HU completa.
- Cuando cambien controladores, migraciones, módulos, paquetes o convenciones, actualizar esta
  guía y el inventario `../api-backend.md`. Mantener intactos los demás documentos existentes salvo
  autorización expresa.
