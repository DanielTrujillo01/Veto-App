# Módulos de la API

Cada carpeta es un módulo de dominio (monolito modular). Los módulos reflejan la división del
modelo de datos (`docs/modelo-de-datos.md`).

| Módulo           | Qué hace                                                                                | Tablas propias                                                                         | Historias                                |
| ---------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------- |
| `identidad`      | Cuentas, registro, inicio de sesión y recuperación de contraseña                        | usuario, cuenta_google, google_estado_oauth, google_pendiente, recuperacion_contrasena | HU-001–004, 006                          |
| `aliados`        | Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes      | aliado, veterinario, sede, aliado_especie                                              | HU-007, 012–016, 021, 023, 078–079       |
| `mascotas`       | Mascotas del tutor y su historial                                                       | mascota, mascota_foto, especie                                                         | HU-008–011                               |
| `servicios`      | Servicios, precios, horarios y búsqueda/descubrimiento                                  | servicio, servicio_regla_precio, horario, bloqueo_agenda, tipo_servicio                | HU-016, 018–022, 024–028                 |
| `citas`          | Agendamiento y ciclo de vida de la cita                                                 | cita, historial_estado, seleccion_horario                                              | HU-029–034                               |
| `gestion-citas`  | El aliado cierra la cita (finalizada o no asistió) con recomendaciones y aviso al tutor | — (escribe en `citas` y `notificaciones` vía sus servicios)                            | HU-032, 033                              |
| `reservas`       | Flujo con que el tutor reserva una cita (fecha y hora, mascota y motivo, confirmar)     | — (escribe en `citas` vía `CitasService`)                                              | HU-029, 030, 031                         |
| `clinica`        | Registro de consulta y anotaciones de corrección                                        | consulta, consulta_anotacion                                                           | HU-014, 017, 037, 042, 043               |
| `comercio`       | Productos y pedidos                                                                     | producto, producto_foto, pedido, pedido_item, categoria_producto                       | HU-044–050                               |
| `adopcion`       | Mascotas en adopción y solicitudes                                                      | mascota_adopcion, mascota_adopcion_media, solicitud_adopcion                           | HU-080, 082, 084, 086, 087, 090, 092–094 |
| `admin`          | Moderación, revisión de fundaciones y estado de cuentas del Equipo Veto                 | accion_admin                                                                           | HU-065–067, 079                          |
| `reportes`       | Dashboards y reportes (solo lectura sobre las vistas)                                   | v_citas_reporte, v_ventas_productos                                                    | HU-070, 073, 074                         |
| `notificaciones` | Notificaciones internas de la aplicación                                                | notificacion                                                                           | HU-048, 052, 054 (crea las de HU-032)    |

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
- **Recuperación de contraseña (HU-004):** configura `SMTP_URL` y `SMTP_FROM` en `.env`. La web
  solicita un código con `POST /api/identidad/recuperacion/solicitar` `{ correo }`, lo verifica con
  `POST /api/identidad/recuperacion/verificar` `{ correo, codigo }` y cambia la contraseña mediante
  `POST /api/identidad/recuperacion/restablecer` `{ contrasena }`. Al verificar, la API entrega el
  token temporal en una cookie `HttpOnly`, no legible por JavaScript. Los códigos vencen en diez
  minutos, admiten cinco intentos y solo se puede pedir uno cada sesenta segundos. La respuesta a la
  solicitud no revela si el correo tiene una cuenta; el cambio cierra las sesiones activas. La web
  consulta `GET /api/identidad/recuperacion/disponible` antes de mostrar el flujo.
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
  La API responde siempre con una redirección a `WEB_ORIGIN/ingresar?google=<resultado>`:
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
- **Publicación de mascotas en adopción (HU-080):** una fundación autenticada y `ACTIVO` publica con
  `POST /api/adopciones` enviando `nombre`, `especieId`, `edadMeses`, `sexo`, `tamano` y `ubicacion`;
  `descripcion` es opcional. La API valida todos los campos, crea la publicación en estado inicial
  `DISPONIBLE` y nunca acepta el id de la fundación desde el cliente. El catálogo público se consulta
  con `GET /api/adopciones/catalogo`: lee únicamente `v_catalogo_adopcion`, por lo que solo muestra
  publicaciones `DISPONIBLE` de fundaciones `ACTIVO` y no expone datos que identifiquen la fundación.
- **Gestión de publicaciones (HU-082):** la fundación administra sus publicaciones con
  `GET /api/adopciones/mis-publicaciones`, `PUT /api/adopciones/:id` y
  `PATCH /api/adopciones/:id/estado`. La edición exige los mismos datos obligatorios de HU-080 y
  solo afecta publicaciones propias. Los estados permitidos siguen el flujo
  `DISPONIBLE → PAUSADA | EN_PROCESO | RETIRADA`, `PAUSADA → DISPONIBLE | RETIRADA` y
  `EN_PROCESO → DISPONIBLE | ADOPTADA | RETIRADA`; `ADOPTADA` y `RETIRADA` son terminales.
  El catálogo público solo lee publicaciones `DISPONIBLE`, por lo que pausar, retirar, iniciar un
  proceso o marcar como adoptada impide nuevas solicitudes y las oculta del catálogo.
- **Fotos y video de adopción (HU-084):** `POST /api/adopciones` y `PUT /api/adopciones/:id`
  reciben `fotos` como una lista ordenada de URLs `http`/`https` (máximo 10) y `videoUrl` como
  una URL opcional. La API solo guarda estas URLs en `mascota_adopcion_media`; nunca recibe ni
  almacena archivos binarios. La lista se reemplaza dentro de la misma transacción, por lo que un
  error de validación o persistencia no deja medios parcialmente guardados. Las respuestas del
  listado privado y del catálogo incluyen `fotos` en el orden enviado y `videoUrl` cuando existe;
  el proveedor externo de almacenamiento/CDN es responsable de validar el contenido y el tamaño
  del archivo antes de entregar la URL.
- **Listado de mascotas de la fundación (HU-085):** `GET /api/adopciones/mis-publicaciones`
  devuelve únicamente las publicaciones asociadas a la fundación autenticada e incluye su estado
  actual. Acepta el filtro opcional `?estado=DISPONIBLE|PAUSADA|EN_PROCESO|ADOPTADA|RETIRADA`;
  sin filtro devuelve todas. El estado se consulta directamente en la base, por lo que refleja
  cambios recientes de edición o transición.

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
  `veterinarioId`. **HU-031 debe reservar uno de esos espacios con su `veterinarioId`** y mostrar el `estado`
  que devuelve el `INSERT` (la elección del tutor la guarda HU-029, abajo). Un cambio de horario o un bloqueo responde 409 si deja citas vigentes sin
  cubrir; la respuesta del bloqueo lista esas citas (`citas`). Lee las citas ocupadas solo a través de
  `CitasService.ocupadosEntre` y `vigentesEnIntervalo`.
- **Reservar una cita (HU-029, 030, 031)** vive en el módulo `reservas`, que orquesta disponibilidad (`servicios`),
  veterinarios y especies (`aliados`), mascotas y citas. Es un módulo aparte porque `servicios` ya depende de `citas`
  y ponerlo en cualquiera de los dos crearía una dependencia circular. El tutor (rol `TUTOR`) arma **una reserva en
  curso** (tabla `seleccion_horario`, del módulo `citas`; una por tutor, se conserva 60 minutos desde el último paso y
  sobrevive a recargar la página) y al final la confirma. Los pasos:
  1. **Fecha y hora (HU-029):** `PUT /api/reservas/seleccion` con `{ servicioId, veterinarioId, inicio }` (el `inicio` con
     zona horaria, tal como lo devolvió `GET /api/aliados/:aliadoId/disponibilidad`; el `fin` lo calcula la API con la
     duración del servicio). Solo se acepta un espacio exacto de los que ofrece el calendario de ese veterinario. Si
     no: **400** `{ razon: "PASADO" }` si la hora ya pasó; **409** `{ razon: "OCUPADO" }` si otra cita (pendiente o
     agendada) ya lo ocupa; **409** `{ razon: "NO_DISPONIBLE" }` si el aliado no atiende así (fuera del horario,
     bloqueado, a mitad de un espacio o con otra duración). Cada una trae `message` para mostrar. Elegir otro horario
     reemplaza el anterior y conserva la mascota y el motivo ya escritos.
  2. **Mascota y motivo (HU-030, HU-031):** `PATCH /api/reservas/seleccion` con `{ mascotaId?, motivo? }` (al menos uno;
     solo cambia lo que se envía). La mascota debe ser del tutor (400 `errores.mascotaId`) y de una especie que el aliado
     atienda (409 `codigo: "ESPECIE_NO_ATENDIDA"`). El **motivo** es texto libre de **hasta 500 caracteres**
     (`MOTIVO_CITA_MAX_CARACTERES`): se recortan los espacios de las puntas, un texto vacío o `null` lo quita, y si
     pasa el límite responde **400** con `errores.motivo` = «El motivo admite máximo 500 caracteres (escribiste N)».
     Los caracteres se cuentan como los ve la persona (un emoji es uno), igual que la base. Para el contador de la web
     están `contarCaracteres` y `caracteresRestantesDelMotivo` en `@veto/shared`. El motivo es **opcional**
     (decisión a confirmar; basta con exigirlo en `ReservaService.confirmar` si el equipo lo pide).
  3. **Revisar (HU-031):** `GET /api/reservas/resumen` devuelve los datos principales (fecha y hora, servicio, veterinario,
     mascota, motivo, aliado), el `precio` para esa mascota y el `estadoInicial` en que quedará la cita (`AGENDADA` o
     `PENDIENTE`, según cómo confirma sus citas el aliado). `listo` es `true` solo si se puede confirmar; si no,
     `pendientes` dice qué falta o ya no sirve (`campo`: `horario`, `mascotaId`, `reserva`). No crea nada.
     `GET /api/reservas/seleccion` devuelve lo elegido en cualquier paso, **vuelto a comprobar** (`vigente: false` con la
     `razon` si otra persona tomó el espacio, el aliado lo bloqueó o la hora pasó); `citaId` viene lleno si ya se confirmó.
  4. **Confirmar (HU-031):** `POST /api/reservas`, sin cuerpo (todo sale de la reserva en curso; lo que llegue en el
     cuerpo se ignora). Vuelve a validar todo dentro de una transacción y crea la cita con mascota, servicio, aliado,
     veterinario, fecha, hora y motivo: **201** con el detalle de la cita. El **estado** (`AGENDADA` o `PENDIENTE`) y las
     reglas de horario, bloqueos, solapamiento y especie los fija y valida la base; el `precio` es el de
     `fn_precio_servicio` en ese momento (queda como instantánea). Errores: 404 sin reserva en curso, 400 si falta la
     mascota (`errores.mascotaId`) o la hora ya pasó (`razon`), 409 con `razon` (`OCUPADO`, `NO_DISPONIBLE`) o con
     `codigo` (`ESPECIE_NO_ATENDIDA`, `DUPLICADA` con `citaId`, `YA_CONFIRMADA`).
     **Sin duplicados (doble clic o reintento):** la confirmación bloquea la reserva en curso del tutor, así que dos
     peticiones seguidas se turnan y la segunda recibe **200** con la misma cita y `repetida: true`; el reintento tardío
     (la reserva ya venció) también. Para reservar otra cita hay que volver a elegir fecha y hora (`PUT`): eso reinicia
     la reserva, conserva la mascota y deja el motivo vacío. Además la base impide dos citas vigentes en el mismo espacio
     y dos iguales (misma mascota, servicio y hora). `DELETE /api/reservas/seleccion` descarta la reserva en curso (204).
     **Elegir no reserva el espacio**: solo la confirmación lo ocupa, y si dos tutores confirman el mismo a la vez,
     uno recibe 409 `OCUPADO`.
- **Ver una cita y su motivo (HU-030):** `GET /api/citas/:citaId` (roles `TUTOR`, `ALIADO`, `VETERINARIO`) devuelve la
  cita con el motivo, el precio, la mascota, el servicio, el aliado y el veterinario. Lo ven el tutor de la cita, el
  administrador del aliado y los veterinarios activos de ese aliado (las mismas personas que la base reconoce como «el
  aliado» al finalizar una cita); para cualquier otra persona responde 404, igual que si no existiera. El Equipo Veto
  no lo ve (403). Lee la vista `v_cita_detalle` (migración 0013). Las listas de citas (mis citas, agenda del aliado) no
  existen todavía: deben mostrar el motivo leyendo de esa vista.
- **Cerrar una cita (HU-032, 033)** vive en el módulo `gestion-citas` (aparte de `citas` por la misma razón que
  `reservas`: sus endpoints necesitan los guards de identidad, e identidad ya depende de `citas`). Lo hace el
  **administrador del aliado** o uno de sus **veterinarios activos** (roles `ALIADO` y `VETERINARIO`; es la misma
  definición de «el aliado» que usa `fn_cita_validar`), solo sobre citas de ese aliado:
  - `PATCH /api/citas/:citaId/finalizar` con cuerpo opcional `{ recomendaciones? }`. No lleva observación (si llega, se ignora).
  - `PATCH /api/citas/:citaId/no-asistio` con cuerpo opcional `{ observacion? }`.
    La **observación** (solo en `no-asistio`, máx. 500 caracteres) es una nota interna: queda en `historial_estado.motivo`
    (la columna ya existía) y solo la ve el aliado. Al finalizar no hay observación: lo clínico va en la consulta (HU-037 y
    siguientes) y lo que el tutor debe saber, en las recomendaciones. Las **recomendaciones** (HU-033, máx. 2000, `RECOMENDACIONES_MAX_CARACTERES`) se guardan en
    `cita.recomendaciones` **en la misma sentencia** que el cambio de estado y las ve el tutor en `GET /api/citas/:citaId`
    (campo `recomendaciones`, `null` mientras no haya). Texto vacío o `null` significa «sin observación / sin
    recomendaciones». Respuesta **200**: la cita ya actualizada (la misma forma de `GET /api/citas/:citaId`) más
    `actualizadoEn` y `actualizadoPor`; no hay sobre `{ success, message, data }`, como en el resto de la API.
    **Reglas**, en este orden: 404 `CITA_NO_ENCONTRADA` → 403 `SIN_PERMISOS_CITA` (el permiso se revisa antes que el estado,
    para que un ajeno no sepa cómo está la cita) → 409 `ESTADO_CITA_INVALIDO` (solo se cierra una cita `AGENDADA`; no
    `PENDIENTE`, ni las ya `FINALIZADA`, `NO_ASISTIO` o `CANCELADA`; trae `estadoActual`) → 422 `CITA_NO_FINALIZABLE` (la hora de
    inicio de la cita todavía no llega; se compara con el reloj de la base, `inicio <= now()`, dentro de la sentencia).
    Además 400 `DATOS_INVALIDOS` (con `errores` por campo: el aviso dice cuántos caracteres escribió), 401 `NO_AUTENTICADO` y
    500 `ERROR_INTERNO` (mensaje genérico; el detalle solo queda en el registro del servidor). Todas las respuestas de
    error de estos endpoints llevan `codigo` y `message` (filtro `CodigosDeErrorFilter`, reutilizable).
    **Transacción:** todo ocurre a nombre de quien actúa (`app.usuario_id`, que ya fija `DatabaseService.withUser`): se
    bloquea la cita (`FOR UPDATE`), se revisa todo, se actualiza —`fn_cita_validar` valida la transición sin que se
    repita su lógica, y el trigger anota estado anterior, nuevo, responsable, fecha y observación en el historial— y por
    último se avisa al tutor. Si algo falla, no queda nada a medias. Dos cierres simultáneos de la misma cita: uno gana y
    el otro recibe 409.
    **Aviso al tutor:** `NotificacionesService.crearSinRomper` crea la `notificacion` (`CITA_FINALIZADA` o
    `CITA_NO_ASISTIO`, con `referencia_id` = la cita) **después de aplicar el cambio de estado y dentro de la misma
    transacción, protegida por un `SAVEPOINT`**: si la notificación falla se pierde solo el aviso (queda en el registro) y
    el cambio de estado se confirma igual; si el cambio no se confirma, tampoco queda el aviso. Leerlas y marcarlas como
    leídas son las historias 052 y 054 (todavía no existen endpoints de lectura).
    `GET /api/citas/:citaId/historial` (tutor, aliado, veterinarios) lista los cambios de estado de la cita; la observación
    de una inasistencia solo la ven el aliado y sus veterinarios. `NO_ASISTIO` queda como estado final igual que `FINALIZADA` (decisión a
    confirmar; es lo que ya hace `fn_cita_validar`).
