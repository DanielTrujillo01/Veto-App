# Módulos de la API

Cada carpeta es un módulo de dominio (monolito modular). Los módulos reflejan la división del
modelo de datos (`docs/modelo-de-datos.md`).

| Módulo           | Qué hace                                                                           | Tablas propias                                                   | Historias                                |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `identidad`      | Cuentas, registro e inicio de sesión                                               | usuario                                                          | HU-001, 002, 006                         |
| `aliados`        | Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes | aliado, veterinario, sede, aliado_especie                        | HU-007, 012–016, 021, 023, 078           |
| `mascotas`       | Mascotas del tutor y su historial                                                  | mascota, mascota_foto, especie                                   | HU-008–011                               |
| `servicios`      | Servicios, precios, horarios y búsqueda/descubrimiento                             | servicio, servicio_regla_precio, horario, tipo_servicio          | HU-016, 018–022, 024–028                 |
| `citas`          | Agendamiento y ciclo de vida de la cita                                            | cita, historial_estado                                           | HU-029, 031, 032, 034                    |
| `clinica`        | Registro de consulta y anotaciones de corrección                                   | consulta, consulta_anotacion                                     | HU-014, 017, 037, 042, 043               |
| `comercio`       | Productos y pedidos                                                                | producto, producto_foto, pedido, pedido_item, categoria_producto | HU-044–050                               |
| `adopcion`       | Mascotas en adopción y solicitudes                                                 | mascota_adopcion, solicitud_adopcion                             | HU-080, 082, 083, 086, 087, 090, 092–094 |
| `admin`          | Moderación y estado de cuentas del Equipo Veto                                     | accion_admin                                                     | HU-065, 066, 067                         |
| `reportes`       | Dashboards y reportes (solo lectura sobre las vistas)                              | v_citas_reporte, v_ventas_productos                              | HU-070, 073, 074                         |
| `notificaciones` | Notificaciones internas de la aplicación                                           | notificacion                                                     | HU-048, 052, 054                         |

## Reglas

1. **Un módulo, sus tablas.** Solo el módulo dueño escribe en sus tablas. Si otro módulo necesita
   algo, llama a un servicio que el dueño exporte; no hace SQL sobre tablas ajenas.
2. **Estructura sugerida dentro de cada módulo:** `*.controller.ts` (HTTP), `*.service.ts`
   (lógica), `*.repository.ts` (SQL), `dto/` (esquemas de `@veto/shared`).
3. **Escrituras a nombre de un usuario** siempre con `DatabaseService.withUser(usuarioId, ...)`,
   para que la base registre quién hizo el cambio.
4. **Validación de entrada** con los esquemas Zod de `@veto/shared`.
5. **Permisos:** cada endpoint debe comprobar rol y pertenencia (por ejemplo, un tutor solo ve sus
   mascotas).

## Contrato común de la API

- **Respuestas en camelCase**, sin envoltorio `{ data }`. Las de identidad envuelven al usuario:
  `{ usuario }` (login, `/me`, registro de tutor); el registro de aliado devuelve `{ usuario, aliado }`.
- **Errores de validación (400):** `{ message: 'Revisa los datos ingresados', errores: { campo: mensaje } }`,
  generados por `validar()`. Los demás errores usan las excepciones de Nest (`{ message, error, statusCode }`).
- **Registro:** `POST /api/usuarios` (tutor, HU-001) y `POST /api/aliados` (clínica, veterinario
  independiente o tienda, HU-007) reciben `contrasena` (no `password`). El aliado queda `PENDIENTE`
  hasta que el Equipo Veto lo active, y mientras tanto no puede gestionar sedes, servicios ni
  veterinarios. Un correo ya registrado responde 409.
- **Cuentas:** solo `identidad` escribe en `usuario`; los demás módulos crean cuentas con
  `IdentidadService.insertUser(client, ...)` dentro de su propia transacción.

## Piezas comunes

- **Autenticación:** `@UseGuards(AuthGuard)` (cookie `veto_session`); el usuario queda en
  `(request as RequestAutenticada).usuario`. Nunca tomes el actor de un header o del body.
- **Roles:** `@UseGuards(AuthGuard, RolesGuard)` + `@Roles('TUTOR')`. Rol incorrecto → 403.
- **Veterinario (HU-014):** `@UseGuards(AuthGuard, VeterinarioGuard)` deja pasar solo a quien tiene
  un perfil de veterinario **activo** en un aliado **activo** (no depende de `usuario.rol`: el
  veterinario independiente es un `ALIADO` con perfil de veterinario). El perfil queda en
  `request.veterinario`; usa siempre ese id, nunca uno de la URL o del cuerpo. Rutas propias:
  `GET /api/veterinarios/me`, `GET /api/veterinarios/me/consultas` y `.../:id`. Para escribir sobre
  una consulta (HU-037, 042) llama primero a `ConsultasService.exigirPropia(client, veterinarioId,
consultaId)`: lanza 404 si no es suya.
- **Pertenencia:** filtra por el dueño en el SQL (`WHERE id = $1 AND tutor_id = $2`); si no es suyo
  responde 404 para no revelar que existe.
- **Validación:** `validar(esquema, body)` de `src/common/validacion.ts` responde 400 con
  `{ message, errores: { campo: mensaje } }`; `esErrorPg(error, PG.UNICO)` traduce errores de PostgreSQL.
- **Servicios exportados entre módulos:** `CitasService` (cancelar citas futuras de un tutor, saber si
  un servicio tiene citas), `AliadosService` (verificar administrador, sede activa, aliado activo),
  `MascotasService.perteneceAlTutor`. Reciben el `client` de la transacción de `withUser`.
- **Mascotas (HU-008–010):** un tutor tiene las mascotas que quiera; cada una es un registro aparte
  y toda lectura o escritura filtra por `id` **y** `tutor_id`, así editar una nunca toca a las demás.
- **Ficha de la clínica (HU-013):** `GET /api/aliados/:clinicaId/veterinarios` (pública) muestra la
  foto y la descripción de los veterinarios activos con cuenta activa; el administrador las cambia con
  `PUT .../veterinarios/:veterinarioId/perfil` (`null` o `""` las quita). La web la muestra en
  `/clinicas/[clinicaId]` sin caché, con la inicial del nombre si no hay foto o no carga.
- **Especies que atiende un aliado (HU-021):** `PUT /api/aliados/:aliadoId/especies` guarda y
  actualiza la selección completa; `GET` (público) es la ficha del aliado. Toda búsqueda o filtro
  por especie (HU-025, 026) debe usar la misma regla: `AliadoEspeciesService.atiendeEspecie(db,
aliadoId, especieId)` (un aliado sin especies configuradas no es compatible con ninguna). La base
  la aplica también al reservar: una cita exige que el aliado atienda la especie de la mascota.
  Ejemplo ya implementado: `GET /api/aliados/:aliadoId/servicios?especieId=N`.
- **Confirmación de citas (HU-023):** `PUT /api/aliados/:aliadoId/confirmacion` con `{ "modo": "AUTOMATICA" | "MANUAL" }`;
  `GET` (público) devuelve `{ modo, estadoInicialCita }` para avisar al tutor. **No calcules el estado de la
  cita en la aplicación**: al hacer `INSERT INTO cita` la base lo fija (`AGENDADA` en automático, `PENDIENTE`
  en manual) y devuelve el estado real con `RETURNING estado`; muéstrale ese al tutor. Una cita `PENDIENTE`
  también ocupa el espacio. Aceptarla es `UPDATE cita SET estado = 'AGENDADA'` y rechazarla,
  `'CANCELADA'` (solo el aliado acepta); cualquier consulta de "citas vigentes" debe incluir ambos estados.

  ## HU-015 · Sedes de clínicas

- `GET /api/aliados/:aliadoId/sedes` expone únicamente las sedes activas de una clínica activa.
- `GET /api/aliados/:aliadoId/sedes/gestion` lista las sedes activas e inactivas al administrador
  autenticado de esa clínica; `GET .../sedes/:sedeId` consulta una sede de su clínica.
- `POST /api/aliados/:aliadoId/sedes`, `PUT .../sedes/:sedeId` y
  `PATCH .../sedes/:sedeId/desactivar` crean, actualizan y desactivan sedes. Las escrituras
  requieren rol `ALIADO`, propiedad de la clínica y clínica activa de tipo `CLINICA`.
- `nombre`, `direccion` y `ciudad` son obligatorios; se recortan espacios externos y se limitan a
  120, 250 y 120 caracteres, respectivamente.
- Una sede inactiva no se incluye en el catálogo público ni en los servicios disponibles para
  reservar. La migración `0003_sede_activa_citas.sql` también rechaza nuevas citas para servicios
  presenciales en esa sede; las citas ya existentes no se modifican.

## HU-020 · Reglas de precio

- `GET /api/aliados/:aliadoId/servicios/:servicioId/reglas-precio` consulta las reglas del servicio
  al aliado autenticado que lo administra.
- `PUT` sobre la misma ruta reemplaza la configuración completa con `{ "reglas": [...] }`; una
  lista vacía quita todas las reglas. Cada regla puede combinar especie, rango de peso y rango de
  edad. Un campo omitido o `null` significa que no restringe por esa dimensión.
- Los límites de peso y edad son inclusivos. Los rangos invertidos, valores fuera de los límites
  numéricos de la base y precios negativos o con más de dos decimales se rechazan.
- `GET /api/servicios/:servicioId/cotizacion?mascotaId=...` requiere un tutor autenticado y una
  mascota propia. Usa `fn_precio_servicio`: prevalece la mayor prioridad, a igual prioridad el
  precio mayor; datos necesarios faltantes o ausencia de regla aplicable devuelven el precio base.
- Las reglas pertenecen al módulo `servicios`; el precio de una cita existente es una instantánea
  y no se modifica al cambiar las reglas.
