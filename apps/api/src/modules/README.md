# Módulos de la API

Cada carpeta es un módulo de dominio (monolito modular). Los módulos reflejan la división del
modelo de datos (`docs/modelo-de-datos.md`).

| Módulo           | Qué hace                                                                           | Tablas propias                                                                     | Historias                                |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- |
| `identidad`      | Cuentas, registro, inicio de sesión y recuperación de contraseña                   | usuario, sesion, desafio_2fa, cuenta_google, google_estado_oauth, google_pendiente | HU-001, 002, 003, 004–006                |
| `aliados`        | Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes | aliado, veterinario, sede, aliado_especie                                          | HU-007, 012–016, 021, 023, 078–079       |
| `mascotas`       | Mascotas del tutor y su historial                                                  | mascota, mascota_foto, especie                                                     | HU-008–011                               |
| `servicios`      | Servicios, precios, horarios y búsqueda/descubrimiento                             | servicio, servicio_regla_precio, horario, tipo_servicio                            | HU-016, 018–022, 024–028                 |
| `citas`          | Agendamiento y ciclo de vida de la cita                                            | cita, historial_estado                                                             | HU-029, 031, 032, 034                    |
| `clinica`        | Registro de consulta y anotaciones de corrección                                   | consulta, consulta_anotacion                                                       | HU-014, 017, 037, 042, 043               |
| `comercio`       | Productos y pedidos                                                                | producto, producto_foto, pedido, pedido_item, categoria_producto                   | HU-044–050                               |
| `adopcion`       | Mascotas en adopción y solicitudes                                                 | mascota_adopcion, solicitud_adopcion                                               | HU-080, 082, 083, 086, 087, 090, 092–094 |
| `admin`          | Moderación, revisión de fundaciones y estado de cuentas del Equipo Veto            | accion_admin                                                                       | HU-065–067, 079                          |
| `reportes`       | Dashboards y reportes (solo lectura sobre las vistas)                              | v_citas_reporte, v_ventas_productos                                                | HU-070, 073, 074                         |
| `notificaciones` | Notificaciones internas de la aplicación                                           | notificacion                                                                       | HU-048, 052, 054                         |

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
- **Recuperación de contraseña (HU-004):** `POST /api/identidad/recuperar-contrasena` envía un enlace
  por SMTP solo a cuentas activas con TOTP. `POST .../verificar` consume ese enlace y exige un código
  TOTP; devuelve un token de cambio de un solo uso, válido 10 minutos. `POST .../completar` actualiza
  el hash de contraseña, consume el token y revoca las sesiones y desafíos existentes en una
  transacción. Reutiliza `desafio_2fa` con hashes de token namespaced por `hu004:` y no requiere
  cambios al esquema existente. Enlaces vencidos, inválidos, reutilizados y códigos incorrectos se
  rechazan; hay un máximo de cinco intentos de código y tres solicitudes por hora. Un código TOTP
  ya aceptado tampoco se puede reutilizar en otra solicitud de recuperación. La respuesta a la
  solicitud no revela si el correo está registrado. Sin TOTP o sin acceso al autenticador se requiere soporte manual. SMTP usa
  las variables documentadas en `.env.example`; Mailpit local está disponible en
  `http://localhost:8025`. Para pruebas reales de bajo volumen se puede configurar Gmail con una
  contraseña de aplicación; está sujeto a límites y no se garantiza como servicio gratuito para
  producción.
- **Registro de fundación (HU-078):** `POST /api/aliados/fundaciones` (público) recibe `nombre`,
  `ciudad`, `contacto`, `descripcion`, `ubicacion`, `anioFundacion`, `logoUrl?` (opcional), `representante?`
  y los datos de la cuenta (`celular`, `correo`, `contrasena`). Crea cuenta y fundación en una
  transacción y responde 201 `{ usuario, fundacion }` con la fundación `PENDIENTE`; tipo y estado no se
  pueden enviar. Un campo faltante o inválido responde 400 con **todos** los errores a la vez
  (`errores: { campo: mensaje }`) para que el formulario conserve lo ya escrito y marque cada campo.
  Correo repetido → 409. La fundación consulta lo guardado, aun pendiente, con
  `GET /api/aliados/me/fundacion/datos` (`{ fundacion }` con sus datos, estado y los de su cuenta).
  `POST /api/aliados` sigue sin aceptar `FUNDACION`.
- **Inicio de sesión con Google (HU-003, opcional):** con `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`
  (y `GOOGLE_REDIRECT_URI` si no es el valor por defecto) en el entorno. Son **navegaciones**, no `fetch`:
  `GET /api/identidad/google` redirige a Google y `GET /api/identidad/google/callback` es donde vuelve.
  La API responde siempre con una redirección a `WEB_ORIGIN/login?google=<resultado>`:
  `ok` (sesión abierta, cookie `veto_session`), `2fa` (la cuenta tiene verificación en dos pasos:
  el desafío va en el fragmento `#desafio=...` y se completa con `POST /api/identidad/login/2fa`),
  `vincular` (el correo ya tiene cuenta), `registro` (primera vez) o `error` con
  `&motivo=cancelado|proveedor|correo_no_verificado|estado|cuenta_inactiva|cuenta_vinculada|no_disponible`.
  Cancelar, rechazar o fallar en Google **nunca** crea una sesión. Para `vincular` y `registro` la web
  consulta `GET /api/identidad/google/pendiente` (`{ pendiente: { tipo, correo, nombre, requiereCodigo? } }`) y termina con
  `POST /api/identidad/google/vincular` `{ contrasena, codigo? }` (200 + sesión) o
  `POST /api/identidad/google/completar` `{ celular }` (201 + sesión); `DELETE .../pendiente` descarta.
  `GET /api/identidad/google/disponible` indica si el botón debe mostrarse.
  **Cuentas que entran solo con Google** (sin contraseña): `GET /api/identidad/google/estado`
  (con sesión) responde `{ vinculada, sinContrasena }`. Si `sinContrasena` es `true`, para eliminar la cuenta
  la web navega a `GET /api/identidad/google/reautenticar` (Google pide las credenciales de nuevo), vuelve
  con `?google=reauth` y una constancia de 5 minutos de un solo uso en la cookie `veto_reauth`; luego llama a
  `DELETE /api/identidad/me` con `{ confirmacion: "ELIMINAR" }` (sin `contrasena`). Sin constancia responde
  401 con `requiereReautenticacion: true`. Para una cuenta con contraseña, `contrasena` sigue siendo
  obligatoria. Cambiar el correo de una cuenta de Google responde 403. Todas las cookies del flujo son
  `HttpOnly` y solo viajan a `/api/identidad/google`.
- **Revisión de fundaciones (HU-079):** `GET /api/admin/fundaciones/pendientes`,
  `GET /api/admin/fundaciones/:fundacionId`, `PATCH .../:fundacionId/aprobar` y
  `PATCH .../:fundacionId/rechazar` son exclusivos de `EQUIPO_VETO`. Una decisión transiciona
  solamente desde `PENDIENTE`: aprobar deja el aliado `ACTIVO`, rechazar lo deja `RECHAZADO`;
  ambas acciones se registran en `accion_admin` dentro de la misma transacción. La fundación
  consulta su propio resultado con `GET /api/aliados/me/fundacion`. Solo aliados `ACTIVO` pueden
  publicar mascotas en adopción; la base de datos rechaza también las publicaciones de fundaciones
  rechazadas.

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
- **Calendario de disponibilidad (HU-022):** el horario semanal se guarda con
  `PUT /api/aliados/:aliadoId/veterinarios/:veterinarioId/horarios` (clínica o veterinario independiente; el
  independiente obtiene su `veterinarioId` en `GET /api/veterinarios/me`). Los días libres y vacaciones son
  bloqueos: `POST | GET /api/aliados/:aliadoId/veterinarios/:veterinarioId/bloqueos` y `DELETE .../:bloqueoId`.
  El tutor consulta `GET /api/aliados/:aliadoId/disponibilidad?servicioId=&desde=&hasta=[&veterinarioId=]`
  (público, máximo 31 días): devuelve los espacios en que el servicio cabe completo, cada uno con su
  `veterinarioId`. **HU-029 debe reservar uno de esos espacios con su `veterinarioId`** y mostrar el `estado`
  que devuelve el `INSERT`. Un cambio de horario o un bloqueo responde 409 si deja citas vigentes sin
  cubrir; la respuesta del bloqueo lista esas citas (`citas`). Lee las citas ocupadas solo a través de
  `CitasService.ocupadosEntre` y `vigentesEnIntervalo`.
