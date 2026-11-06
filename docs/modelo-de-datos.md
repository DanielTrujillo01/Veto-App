# Veto · Modelo de datos (historias esenciales)

Basado **solo** en el Product Backlog. Cubre las 55 historias marcadas como **Esenciales**.

| Archivo                            | Para qué sirve                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `db/migrations/0001_baseline.sql`  | El modelo: 25 tablas, 14 tipos enumerados, 4 vistas, 16 triggers. PostgreSQL 15+.                                                   |
| `db/tests/veto_pruebas.sql`        | 63 pruebas de las reglas (47 casos que deben ser rechazados y 16 comprobaciones). Corre en una transacción y termina en `ROLLBACK`. |
| `docs/diagramas_er.html` / `.md`   | Diagramas entidad-relación por módulo. El `.html` se abre en el navegador.                                                          |
| `docs/archivo/modelo-v1-completo/` | La primera versión (más grande, con el documento del cliente). Solo por si la necesitas.                                            |

---

## 1. Alcance: cómo decidí qué es "esencial"

El backlog no escribe la prioridad en cada historia: la **codifica con el color** de su identificador. La leyenda del propio documento dice:

| Color    | Significado  |
| -------- | ------------ |
| Verde    | **Esencial** |
| Azul     | Condicional  |
| Amarillo | Opcional     |

Con eso salen **55 historias esenciales**. Revisé el color de las 95 historias directamente en el archivo. Tres historias tienen un tono de verde algo distinto (HU-015, HU-090 y HU-092) y las traté como esenciales. **Conviene que confirmes esta lectura** contra la hoja de priorización que adjuntaron como evidencia.

**Incluidas (55):**
HU-001, 002, 006, 007 · 008–011 · 012–017 · 018–022 · 024, 025, 026, 028 · 029, 031, 032, 034 · 037, 042, 043 · 044–050 · 052, 054 · 065, 066, 067 · 070, 073, 074 · 078, 080, 082, 083, 086, 087, 090, 092, 093, 094

**Excluidas del alcance inicial (40), por grupos:**

| Grupo                      | Historias                                                                                                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acceso avanzado            | 003 Google, 004 recuperar contraseña, 005 segundo factor                                                                                                                                              |
| Monetización completa      | 055–060 suscripciones, comisión, plan Pro, descuentos                                                                                                                                                 |
| Reseñas                    | 061–064                                                                                                                                                                                               |
| PQRS                       | 068, 069                                                                                                                                                                                              |
| Correos y recordatorios    | 051, 053 (las notificaciones internas 052 y 054 sí entran)                                                                                                                                            |
| Detalle de cita y consulta | 023 confirmación automática, 027 ordenar, 030 motivo de la cita, 033 recomendaciones al cerrar, 035, 036, 038 signos vitales, 039 diagnóstico y tratamiento, 040 anexos, 041 controles de seguimiento |
| Dashboards extra           | 071, 072, 075, 076, 077                                                                                                                                                                               |
| Adopción complementaria    | 079 aprobar fundaciones, 081, 084 varias fotos, 085, 088, 089, 091, 095                                                                                                                               |

### Extensión implementada después: recuperación de contraseña (HU-004)

HU-004 se incorporó después de definir el baseline de 55 historias esenciales. Para mantener
compatibilidad con las bases existentes, no agrega tablas ni columnas: reutiliza `desafio_2fa`,
definida en la migración de verificación en dos pasos.

La tabla ya contiene `token_hash`, `usuario_id`, `expira_en` y `creado_en`, suficientes para
persistir enlaces de verificación y tokens temporales de restablecimiento. La aplicación identifica
los registros de recuperación mediante prefijos `hu004:` dentro de `token_hash`; los hashes reales
de tokens siguen siendo no reversibles. Los códigos TOTP aceptados y los intentos fallidos también
se registran como desafíos temporales, de modo que se pueden invalidar o limitar sin alterar el
esquema. Los registros de recuperación antiguos se purgan al solicitar una nueva recuperación.

No se introduce un campo `totp_ultimo_contador_recuperacion`: la prevención de reutilización del
código TOTP se implementa con un desafío temporal en la misma tabla, que vence al terminar la
ventana de 30 segundos del código.

---

## 2. Decisión: relacional (PostgreSQL)

Las historias esenciales describen relaciones fuertes y reglas que deben cumplirse siempre:

- La cita depende de tutor, mascota, servicio y aliado. Las llaves foráneas impiden combinaciones inválidas.
- Dos citas no pueden ocupar al mismo veterinario a la vez (HU-029, 031).
- Una consulta cerrada no se edita; se corrige con una anotación que registra quién y cuándo (HU-042).
- El stock debe descontarse y devolverse de forma consistente (HU-046, 049).
- Los dashboards y reportes por fecha, servicio, aliado, especie y estado son consultas SQL (HU-070, 073, 074).

Solo uso `jsonb` en las respuestas del formulario de adopción (HU-090), para poder cambiar el formulario sin migrar. Las fotos viven en almacenamiento externo; la base guarda la URL, y la API solo acepta URLs `http`/`https` (`urlImagenSchema` en `@veto/shared`).

---

## 3. Estructura

| Módulo                              | Tablas                                                                  | Historias                             |
| ----------------------------------- | ----------------------------------------------------------------------- | ------------------------------------- |
| **Usuarios y aliados**              | `usuario`, `aliado`, `veterinario`, `sede`, `aliado_especie`            | 001, 002, 006, 007, 012–016, 021, 078 |
| **Mascotas**                        | `mascota`, `mascota_foto` + vista `v_historial_mascota`                 | 008–011                               |
| **Servicios y horarios**            | `servicio`, `servicio_regla_precio`, `horario`, `bloqueo_agenda` (0007) | 016, 018–022                          |
| **Citas**                           | `cita`, `historial_estado`                                              | 029, 031, 032, 034                    |
| **Registro de consulta**            | `consulta`, `consulta_anotacion` + vista `v_consulta_detalle` (0003)    | 014, 017, 037, 042, 043               |
| **Productos y pedidos**             | `producto`, `producto_foto`, `pedido`, `pedido_item`                    | 044–050                               |
| **Adopción**                        | `mascota_adopcion`, `solicitud_adopcion` + vista `v_catalogo_adopcion`  | 078, 080, 082, 083, 087, 090, 092–094 |
| **Notificaciones y administración** | `notificacion`, `accion_admin`                                          | 048, 052, 054, 065–067                |
| **Reportes**                        | vistas `v_citas_reporte`, `v_ventas_productos`                          | 070, 073, 074                         |
| **Catálogos**                       | `especie`, `tipo_servicio`, `categoria_producto`                        | 018, 026, 044                         |

La extensión HU-004 pertenece al módulo `identidad` y reutiliza `usuario` y `desafio_2fa`; no
requiere una nueva entidad en el esquema.

Detalles de diseño:

1. **Un solo `aliado` con un tipo** (clínica, veterinario independiente, tienda o fundación). Los datos extra de la fundación (ciudad, ubicación, año) son columnas de `aliado` que solo se exigen cuando el tipo es fundación.
2. **Un usuario tiene un rol** (`TUTOR`, `ALIADO`, `VETERINARIO`, `EQUIPO_VETO`). El aliado apunta a la cuenta que lo administra; el veterinario tiene su propia cuenta (HU-014).
3. **El historial clínico no es una tabla**: es el conjunto de consultas de la mascota. La vista `v_historial_mascota` lo arma, así no se duplican datos entre cita e historial.
4. **El estado de aliados y cuentas** (HU-065, 067) está en `aliado.estado` y `usuario.estado`; cada cambio queda en `accion_admin` con responsable, fecha y motivo.
5. **El catálogo de adopción** se lee desde `v_catalogo_adopcion`, que no incluye a la fundación (HU-087).

---

## 4. Reglas que la base hace cumplir

| Regla                                                                                                                | Mecanismo                                      |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Correo único (sin importar mayúsculas), celular de 10 dígitos                                                        | `UNIQUE` sobre `citext` + `CHECK`              |
| Campos obligatorios de mascota: nombre, especie y sexo (HU-008)                                                      | `NOT NULL`                                     |
| La tienda no ofrece servicios; solo las fundaciones activas publican mascotas                                        | Trigger `fn_validar_tipo_aliado`               |
| Sin horarios solapados; sin citas solapadas del mismo veterinario                                                    | `EXCLUDE USING gist`                           |
| Sin citas duplicadas por doble clic                                                                                  | Índice único parcial                           |
| Citas solo a futuro, con servicio disponible y especie atendida por el aliado                                        | Trigger `fn_cita_validar`                      |
| Solo el aliado (administrador o veterinario) finaliza o marca "no asistió" (HU-032)                                  | Trigger `fn_cita_validar`                      |
| Reprogramar conserva la fecha anterior (HU-034)                                                                      | Se registra en `historial_estado`              |
| Cita finalizada o cancelada ya no cambia                                                                             | Trigger `fn_cita_validar`                      |
| Estado inicial de la cita según la confirmación del aliado: automática → AGENDADA, manual → PENDIENTE (HU-023)       | Trigger `fn_cita_validar`                      |
| Una cita pendiente también ocupa el espacio; solo el aliado la acepta (→ AGENDADA) o la rechaza (→ CANCELADA)        | Trigger + `EXCLUDE` e índice                   |
| Una cita no cae en un bloqueo del calendario; los bloqueos de un veterinario no se solapan (HU-022)                  | Trigger + `EXCLUDE`                            |
| No se bloquea ni se recorta el horario si deja citas vigentes sin cubrir (HU-022)                                    | Triggers de bloqueo y de horario               |
| Precio según peso, edad o especie; sin regla o sin dato → precio base (HU-020)                                       | Función `fn_precio_servicio`                   |
| Consulta cerrada no se edita ni se borra; se corrige con anotación (HU-042)                                          | Triggers + tabla de solo inserción             |
| Pedido: valida producto activo, descuenta stock, lo devuelve al cancelar; no se cancela tras despachar (HU-046, 049) | Triggers `fn_pedido_item` y `fn_pedido_estado` |
| Solicitud de adopción: una activa por tutor y mascota; rechazar exige motivo (HU-090, 094)                           | Índice único parcial + `CHECK`                 |
| Fundación: datos completos y no en blanco, año válido, logo con URL http(s) (HU-078)                                 | `CHECK` + trigger `fn_fundacion_anio_valido`   |
| Una cuenta de Google se vincula a una sola cuenta de Veto, y al revés (HU-003)                                       | `PK` + `UNIQUE` en `cuenta_google`             |
| Quién cambió el estado de cita, pedido, solicitud o publicación                                                      | `historial_estado` (solo inserción)            |

Para que `historial_estado` y la regla "solo el aliado finaliza" funcionen, la aplicación debe ejecutar al inicio de cada transacción:

```sql
SET LOCAL app.usuario_id = '<uuid del usuario autenticado>';
```

---

## 5. Decisiones y puntos a confirmar

| #   | Tema                                   | Qué hice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Aprobación de fundaciones** (HU-079) | El Equipo Veto decide solo sobre solicitudes `PENDIENTE`: aprobar cambia `aliado.estado` a `ACTIVO`; rechazar lo cambia a `RECHAZADO`. Ambas decisiones quedan en `accion_admin`; la fundación consulta su estado en la API. El trigger de adopción permite publicar únicamente a aliados `ACTIVO`. No se definió motivo de rechazo ni reenvío en el alcance.                                                                                                                             |
| 2   | **Consulta clínica reducida**          | Solo guarda la anamnesis (HU-037). Signos vitales, diagnóstico, tratamiento y anexos (038–040) son opcionales o condicionales y no están. Si el equipo decide agregarlos, son columnas o una tabla más.                                                                                                                                                                                                                                                                                   |
| 3   | **Estados del pedido**                 | HU-047 no los lista. Propuse: pendiente → confirmado → despachado → entregado, con cancelado.                                                                                                                                                                                                                                                                                                                                                                                             |
| 4   | **Duración del servicio**              | `servicio.duracion_min` no está en ninguna historia, pero sin ella no se puede calcular qué horas están libres ni evitar solapamientos.                                                                                                                                                                                                                                                                                                                                                   |
| 5   | **Recomendaciones**                    | HU-033 es condicional, pero HU-011 y HU-054 (esenciales) las mencionan, así que hay una columna `cita.recomendaciones`.                                                                                                                                                                                                                                                                                                                                                                   |
| 6   | **Pagos**                              | Ninguna historia esencial incluye pago, así que no hay tablas de pago ni factura.                                                                                                                                                                                                                                                                                                                                                                                                         |
| 7   | **Logística de pedidos** (HU-050)      | El backlog la deja "por definir"; no hay dirección ni envío.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 8   | **Eliminar cuenta** (HU-006)           | Política adoptada: baja lógica (`estado = ELIMINADA`, `eliminado_en`) + anonimización de los datos personales (nombre, celular, correo `eliminado+<id>@veto.invalid`, contraseña inutilizable), borrado de todas las sesiones y cancelación de las citas futuras. Se conservan mascotas, citas pasadas, consultas y pedidos por trazabilidad clínica y comercial. El correo original queda libre. Por ahora solo los tutores se autoeliminan; aliados y veterinarios, con el Equipo Veto. |
| 9   | **Catálogos**                          | Los valores iniciales de `especie`, `tipo_servicio` y `categoria_producto` son ejemplos.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | **Veterinario independiente**          | Es un `aliado` más una fila en `veterinario` con su misma cuenta, para poder asignarle citas y horarios.                                                                                                                                                                                                                                                                                                                                                                                  |
| 11  | **Horario mensual**                    | Se modela con la vigencia (`vigente_desde` / `vigente_hasta`) de un horario semanal.                                                                                                                                                                                                                                                                                                                                                                                                      |

**Confirmación de citas (HU-023).** HU-023 estaba entre las excluidas; se agregó después. Cada aliado Vet tiene
`modo_confirmacion` (`AUTOMATICA` por defecto o `MANUAL`). La cita nace `AGENDADA` (confirmada) o `PENDIENTE`
según ese modo, lo decide el trigger `fn_cita_validar` y no quien reserva. La cita pendiente ocupa el
espacio igual que una confirmada. Cambiar el modo solo afecta a las reservas nuevas. Aceptar o rechazar
una cita pendiente ya está permitido en la base de datos; falta el endpoint, que va con la agenda del aliado.

**Servicios (HU-018).** Un servicio nunca se borra: se desactiva (`activo = false`) y deja de
listarse como disponible; la base rechaza nuevas citas sobre él, y las citas existentes conservan su
precio. Si un servicio ya tiene citas, la API no permite cambiar su tipo ni su modalidad.

**Registro de fundaciones (HU-078).** Una fundación es un `aliado` de tipo `FUNDACION` más la cuenta que la administra
(rol `ALIADO`), creados en una sola transacción. Nace `PENDIENTE`: el Equipo Veto la aprueba o rechaza en HU-079 y solo
una fundación `ACTIVO` publica mascotas. El tipo y el estado no los elige quien se registra. Nombre, ciudad, contacto,
descripción, ubicación y año de fundación son obligatorios; el logo es opcional y guarda solo la URL. La base ya exigía
que esos datos no fueran nulos; la migración 0008 agrega que no sean solo espacios, que el año no sea futuro y que el
logo sea una URL web. Esas restricciones se crean `NOT VALID`: rigen para todo lo que se guarde desde ahora, sin
rechazar filas que ya existían. «Contacto» es texto libre (correo, teléfono o ambos); el nombre del representante es
opcional y, si no se indica, la cuenta usa el nombre de la fundación.

**Inicio de sesión con Google (HU-003).** Es opcional: sin `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` la API lo
informa (`GET /identidad/google/disponible`) y la web oculta el botón. Usa el flujo de código de autorización de
OpenID Connect con PKCE. Una cuenta de Google se identifica por su `sub` (no por el correo) y se guarda en
`cuenta_google`, con una sola cuenta de Google por cuenta de Veto y al revés. `google_estado_oauth` guarda cada intento
(hash del `state`, `nonce` y verificador PKCE) y se consume una sola vez; `google_pendiente` guarda lo que falta antes
de abrir sesión. Se guardan solo hashes de los tokens. Decisiones a confirmar:

- **Un correo que ya tiene cuenta no se vincula solo por coincidir.** Aunque Google confirme el correo, en Veto el
  correo no se verifica al registrarse; si alguien se hubiera registrado antes con el correo de otra persona y se
  vinculara sin más, conservaría el acceso. Por eso quien llega con Google debe demostrar que la cuenta es suya con
  su contraseña (y su código de Google Authenticator si tiene 2FA); cinco fallos invalidan la solicitud.
- **Quien entra por primera vez crea la cuenta de tutor completando el celular**, porque Google no lo entrega y es
  obligatorio (HU-001). La cuenta queda sin contraseña utilizable (`password_hash = 'GOOGLE'`), así que solo entra con
  Google. Como no hay contraseña con la que confirmar acciones delicadas, **eliminar la cuenta se confirma volviendo a pasar por
  Google**: la API manda a Google con `prompt=login`, y si vuelve la misma cuenta de Google vinculada (con la sesión
  aún abierta) emite una constancia de 5 minutos y de un solo uso (`google_reautenticacion`), que se gasta dentro de la
  misma transacción que anonimiza la cuenta. Cambiar el correo queda bloqueado en estas cuentas: su correo es el de
  Google y el ingreso se hace por el `sub`, no por el correo.
- **Google no salta la verificación en dos pasos**: si la cuenta la tiene activa, la API entrega el desafío y la web lo
  completa con el endpoint de 2FA que ya existía.
- Al eliminar la cuenta (HU-006) un trigger suelta la cuenta de Google y descarta sus solicitudes pendientes.
- Cancelar, rechazar o un error de Google redirige a la web con `google=error&motivo=...` y nunca abre sesión.

**Calendario de disponibilidad (HU-022).** La disponibilidad de un aliado Vet es la de sus veterinarios (el independiente
tiene su propio perfil de veterinario, decisión 10). Se compone de tres cosas: el horario semanal con vigencia
(`horario`, decisión 11), los **bloqueos** puntuales (`bloqueo_agenda`: vacaciones, permisos, un día libre) y las citas
vigentes. Un bloqueo le gana al horario. El horario con `veterinario_id` nulo (horario general del aliado) no se usa:
las reservas se validan contra el horario de cada veterinario. Reglas que hace cumplir la base:

- Un intervalo válido tiene fin posterior al inicio; ni los horarios ni los bloqueos del mismo veterinario se solapan
  (los contiguos sí se permiten).
- No se reserva ni se reprograma una cita fuera del horario o dentro de un bloqueo.
- No se puede bloquear un intervalo, ni recortar, mover o borrar el horario, si eso deja una cita vigente
  (`PENDIENTE` o `AGENDADA`, futura) fuera de la atención: primero se reprograma o se cancela. La comprobación del horario
  se hace al confirmar la transacción para que se pueda reemplazar el horario completo de una vez.
- Reservar, bloquear y cambiar el horario del mismo veterinario se serializan con un candado, así que dos operaciones
  simultáneas nunca dejan una cita dentro de un bloqueo o fuera del horario.

El calendario que ve el tutor no se guarda: se calcula en cada consulta (horario menos bloqueos menos citas vigentes,
en espacios consecutivos de la duración del servicio) y por eso refleja los cambios al instante. Las horas del horario
son "hora de pared" y se interpretan en la zona horaria de la base, igual que la regla que valida las reservas.

Lo que queda en la aplicación: los permisos por rol y el envío efectivo de notificaciones.

---

## 6. Cómo usarlo

```bash
pnpm db:migrate   # crea el esquema en la base configurada por DATABASE_URL (Supabase o local)
```

Para verificar las reglas (no deja datos):

```bash
pnpm db:test
```

Debe terminar con `=== TODAS LAS PRUEBAS PASARON ===`. La migración crea el esquema `veto` y sus tablas automáticamente. La API se conecta con `search_path = veto, public`; si usas otro cliente SQL, ejecuta `SET search_path TO veto, public;`.

Los cambios al modelo se hacen con migraciones nuevas (`0002_...sql`), nunca editando la `0001`. Ver el README de la raíz.
