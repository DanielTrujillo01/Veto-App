# Módulos de la API

Cada carpeta es un módulo de dominio (monolito modular). Los módulos reflejan la división del
modelo de datos (`docs/modelo-de-datos.md`).

| Módulo           | Qué hace                                                                           | Tablas propias                                                   | Historias                                |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `identidad`      | Cuentas, registro e inicio de sesión                                               | usuario                                                          | HU-001, 002, 006                         |
| `aliados`        | Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes | aliado, veterinario, sede, aliado_especie                        | HU-007, 012–016, 021, 078                |
| `mascotas`       | Mascotas del tutor y su historial                                                  | mascota, mascota_foto, especie                                   | HU-008–011                               |
| `servicios`      | Servicios, precios, horarios y búsqueda/descubrimiento                             | servicio, servicio_regla_precio, horario, tipo_servicio          | HU-018–022, 024–028                      |
| `citas`          | Agendamiento y ciclo de vida de la cita                                            | cita, historial_estado                                           | HU-029, 031, 032, 034                    |
| `clinica`        | Registro de consulta y anotaciones de corrección                                   | consulta, consulta_anotacion                                     | HU-017, 037, 042, 043                    |
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
