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
