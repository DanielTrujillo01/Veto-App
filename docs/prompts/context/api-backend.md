# API backend de Veto

Inventario de las rutas HTTP implementadas por la API NestJS. La documentación se basa en los
controladores, servicios y esquemas Zod actuales del repositorio: 89 rutas de aplicación y
`GET /api/health`.

## Información general

- **Prefijo:** todas las rutas de aplicación empiezan por `/api`.
- **Desarrollo local:** `http://localhost:3001/api` (el puerto se configura con `API_PORT`).
- **Formato:** solicitudes y respuestas JSON, salvo las rutas de navegación OAuth de Google.
- **Autenticación:** cookie de sesión `veto_session`, `HttpOnly`, `SameSite=Lax`. En el navegador,
  las solicitudes autenticadas deben incluir credenciales (`credentials: 'include'`).
- **Documentación interactiva:** `/api/docs` (Swagger UI) y `/api/docs-json` (documento OpenAPI
  generado). Son rutas de documentación, no forman parte del inventario de 75 controladores.
- **Identificadores:** los parámetros de ruta UUID se validan; un UUID inválido genera `400`.
- **Fechas y horas:** las respuestas entregan los instantes en hora de Colombia, con desfase (`2026-12-07T08:00:00.000-05:00`),
  no en UTC. Al enviar se acepta con `-05:00` o con `Z` (es el mismo instante). Las fechas sin hora (`AAAA-MM-DD`) y las horas
  del día (`08:00`, horarios de atención) no cambian y son siempre de Colombia.

### Errores comunes

Los errores siguen el formato de NestJS:

```json
{
  "message": "Descripción del error",
  "error": "Bad Request",
  "statusCode": 400
}
```

Los errores de validación de los esquemas Zod incluyen un mapa de campos:

```json
{
  "message": "Revisa los datos ingresados",
  "errores": {
    "correo": "El correo no es válido"
  }
}
```

El estado HTTP depende de la operación. En general: `400` entrada inválida, `401` sesión o
credencial ausente/inválida, `403` rol o permiso insuficiente, `404` recurso inexistente o ajeno,
`409` conflicto de negocio y `503` dependencia externa no disponible. Las rutas que crean recursos
responden `201`; las demás responden `200`, excepto donde se indique `202`, `302` o `204`.

## Formas de datos compartidas

Los ejemplos muestran la estructura esperada; los campos marcados como opcionales pueden omitirse.
Las validaciones concretas, límites y valores enumerados indicados aquí se aplican además de la
validación general descrita arriba.

| Objeto               | Estructura y restricciones principales                                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Usuario`            | `{ id, nombre, celular, correo, rol }`. La contraseña nunca se devuelve.                                                                                                                                                                                       |
| `RegistroTutor`      | `{ nombre, celular, correo, contrasena }`. `celular`: 10 dígitos; `contrasena`: 8–128 caracteres.                                                                                                                                                              |
| `Login`              | `{ correo, contrasena }`.                                                                                                                                                                                                                                      |
| `Codigo2FA`          | `{ codigo }`, seis dígitos.                                                                                                                                                                                                                                    |
| `Desafio2FA`         | `{ desafio, codigo }`, ambos obligatorios; el código tiene seis dígitos.                                                                                                                                                                                       |
| `EditarPerfil`       | Al menos uno de `{ nombre?, celular?, correo? }`; si se cambia el correo se puede enviar `contrasenaActual`. No admite propiedades adicionales.                                                                                                                |
| `EliminarCuenta`     | `{ confirmacion: "ELIMINAR", contrasena? }`. Las cuentas que solo usan Google confirman mediante una reautenticación previa.                                                                                                                                   |
| `RegistroAliado`     | `{ tipo, nombre, celular, correo, contrasena, nombreAliado?, descripcion?, contacto?, ciudad?, ubicacion? }`. `tipo`: `CLINICA`, `VET_INDEPENDIENTE` o `TIENDA`; clínicas y tiendas requieren `ciudad` y `ubicacion`.                                          |
| `RegistroFundacion`  | `{ nombre, ciudad, contacto, descripcion, ubicacion, anioFundacion, logoUrl?, representante?, celular, correo, contrasena }`. `anioFundacion` puede llegar como número o texto numérico; `logoUrl` debe ser URL HTTP(S). Tipo y estado los asigna el servidor. |
| `Sede` (entrada)     | `{ nombre, direccion, ciudad }`, todos obligatorios.                                                                                                                                                                                                           |
| `Mascota` (entrada)  | `{ nombre, especieId, sexo, raza?, fechaNacimiento?, edadMeses?, color?, pesoKg?, chip?, fotos? }`. `sexo`: `MACHO` o `HEMBRA`; fecha ISO `AAAA-MM-DD`; no se permiten a la vez fecha y edad; máximo 5 fotos URL HTTP(S).                                      |
| `Servicio` (entrada) | `{ tipoServicioId, nombre, modalidad, duracionMin, precioBase, descripcion?, sedeId? }`. `modalidad`: `EN_SEDE` o `A_DOMICILIO`; `sedeId` es obligatorio para `EN_SEDE`; duración de 5 a 480 minutos y múltiplo de 5.                                          |
| `ReglaPrecio`        | `{ especieId?, pesoMinKg?, pesoMaxKg?, edadMinMeses?, edadMaxMeses?, precio, prioridad? }`. Los filtros pueden ser `null`; rangos inclusivos; `prioridad` predeterminada a `0`.                                                                                |
| `Horario`            | `{ diaSemana, horaInicio, horaFin, vigenteDesde?, vigenteHasta? }`; día ISO de semana `1`–`7`, hora `HH:MM`, fin posterior al inicio.                                                                                                                          |
| `Bloqueo`            | `{ inicio, fin, motivo? }`; fechas-horas con zona horaria, fin posterior al inicio y duración máxima de 366 días.                                                                                                                                              |
| `EspeciesAliado`     | `{ especieIds: number[] }`; selección completa, sin duplicados, de 1 a 50 especies.                                                                                                                                                                            |
| `ConfirmacionCitas`  | `{ modo: "AUTOMATICA" \| "MANUAL" }`.                                                                                                                                                                                                                          |

### Tipos de respuesta de recursos

- **Mascota:** `{ id, nombre, especieId, especie, sexo, raza, fechaNacimiento, edadMeses, color, pesoKg, chip, fotos, creadoEn }`. Los campos no informados se devuelven como `null`; `fotos` es una lista.
- **Servicio:** `{ id, aliadoId, tipoServicioId, tipoServicio, nombre, descripcion, modalidad, sedeId, duracionMin, precioBase, activo, creadoEn }`.
- **Sede:** `{ id, aliadoId, nombre, direccion, ciudad, activa }`.
- **Fundación:** `{ id, tipo: "FUNDACION", nombre, ciudad, contacto, descripcion, ubicacion, anioFundacion, logoUrl, estado, creadoEn }`. Las respuestas de la propia fundación incluyen también `representante`, `correo` y `celular`.
- **Consulta resumida:** `{ id, citaId, fecha, servicio, mascota: { id, nombre, especie }, motivoConsulta, estado, cerradaEn }`.
- **Detalle de consulta:** consulta resumida más `{ citaFin, descripcionPropietario, estadoMental, condicionCorporal, comportamiento, estadoGeneral, creadaEn }`.
- Los nombres de propiedades de JSON son `camelCase`. Las fechas se devuelven como cadenas de fecha/hora ISO cuando el servicio las serializa.

## Rutas

### Salud

| Método y ruta     | Acceso  | Entrada                   | Respuesta correcta                                                                                       |
| ----------------- | ------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET /api/health` | Público | Sin parámetros ni cuerpo. | `200 { "status": "ok", "db": "up" }`. Si no responde la base: `503 { "status": "error", "db": "down" }`. |

### Identidad, sesión y seguridad

| Método y ruta                               | Acceso                                 | Entrada                                                                                                  | Respuesta correcta                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/usuarios`                        | Público                                | `RegistroTutor`.                                                                                         | `201 { "usuario": Usuario }`.                                                                                                                                                 |
| `POST /api/identidad/login`                 | Público                                | `Login`.                                                                                                 | Sin 2FA: `200 { "usuario": Usuario }` y cookie `veto_session`. Con 2FA: `202 { "requiere2fa": true, "desafio": string, "expiraEn": fecha }`. Credenciales incorrectas: `401`. |
| `POST /api/identidad/login/2fa`             | Público, requiere el desafío del login | `Desafio2FA`.                                                                                            | `200 { "usuario": Usuario }` y cookie `veto_session`. Desafío/código incorrecto o vencido: `401`.                                                                             |
| `GET /api/identidad/me`                     | Sesión                                 | Sin cuerpo.                                                                                              | `200 { "usuario": Usuario }`.                                                                                                                                                 |
| `PATCH /api/identidad/me`                   | Sesión                                 | `EditarPerfil`.                                                                                          | `200 { "usuario": Usuario }` actualizado. Cambiar correo puede requerir `contrasenaActual`; correo duplicado: `409`.                                                          |
| `DELETE /api/identidad/me`                  | Sesión                                 | `EliminarCuenta`; para cuenta Google sin contraseña, enviar solo `confirmacion` después de reautenticar. | `200 { "mensaje": string }`; elimina datos personales, revoca sesiones y limpia cookies de sesión/reautenticación.                                                            |
| `GET /api/identidad/2fa`                    | Sesión                                 | Sin cuerpo.                                                                                              | `200 { "activado": boolean, "activadoEn": fecha \| null }`.                                                                                                                   |
| `POST /api/identidad/2fa/activar`           | Sesión                                 | Sin cuerpo.                                                                                              | `200 { "activado": false, "secreto": string, "uri": string }`. Ya activado: `409`.                                                                                            |
| `POST /api/identidad/2fa/activar/confirmar` | Sesión                                 | `{ "codigo": "123456" }`.                                                                                | `200 { "activado": true, "activadoEn": fecha }`. Código inválido: `401`.                                                                                                      |

### Recuperación de contraseña

La implementación actual usa un código enviado por correo y una cookie temporal `HttpOnly`.
No hay un flujo de recuperación mediante enlace y TOTP en los controladores actuales.

#### Código enviado al correo

| Método y ruta                                  | Acceso                    | Entrada                                                                                   | Respuesta correcta                                                                            |
| ---------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /api/identidad/recuperacion/disponible`   | Público                   | Sin parámetros ni cuerpo.                                                                 | `200 { "disponible": boolean }`.                                                              |
| `POST /api/identidad/recuperacion/solicitar`   | Público                   | `{ "correo": string }`.                                                                   | `202 { "mensaje": string }`. El mensaje no revela si existe una cuenta con ese correo.        |
| `POST /api/identidad/recuperacion/verificar`   | Público                   | `{ "correo": string, "codigo": "123456" }`.                                               | `200 { "mensaje": string }` y cookie `veto_password_recovery` `HttpOnly`, válida 10 minutos.  |
| `POST /api/identidad/recuperacion/restablecer` | Cookie temporal del flujo | `{ "contrasena": string }` (8–128 caracteres); el token se lee de la cookie, no del JSON. | `200 { "mensaje": string }`; consume la cookie de recuperación y cierra las sesiones activas. |

El código y el token temporal vencen en 10 minutos. Se permiten hasta cinco intentos de
verificación y se espera 60 segundos entre solicitudes de código. La recuperación requiere que el
transporte de correo esté disponible; se configura con `SMTP_URL` y `SMTP_FROM`. Las respuestas de
solicitud no revelan si el correo pertenece a una cuenta activa.

### Inicio de sesión con Google

Las rutas de inicio, retorno y reautenticación son **navegaciones del navegador**, no solicitudes
`fetch`: redirigen entre Veto y Google. Las cookies temporales del flujo son `HttpOnly`.

| Método y ruta                            | Acceso                    | Entrada                                                                                         | Respuesta correcta                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/identidad/google/disponible`   | Público                   | Sin entrada.                                                                                    | `200 { "disponible": boolean }`.                                                                                                                                                                      |
| `GET /api/identidad/google`              | Público                   | Navegación; sin cuerpo.                                                                         | `302` hacia Google; al finalizar, redirige a `WEB_ORIGIN/ingresar?google=...`.                                                                                                                        |
| `GET /api/identidad/google/callback`     | Retorno de Google         | Query OAuth `code`, `state` o `error`.                                                          | `302` a la web con `google=ok\|2fa\|vincular\|registro\|error`; puede agregar `motivo`. En `ok` establece `veto_session`; en `2fa`, el desafío va en el fragmento URL. No devuelve tokens en el JSON. |
| `GET /api/identidad/google/estado`       | Sesión                    | Sin cuerpo.                                                                                     | `200 { "vinculada": boolean, "sinContrasena": boolean }`.                                                                                                                                             |
| `GET /api/identidad/google/reautenticar` | Sesión                    | Navegación; sin cuerpo.                                                                         | `302` hacia Google y de regreso a la web. Si resulta satisfactoria crea cookie `veto_reauth` de un solo uso y cinco minutos.                                                                          |
| `GET /api/identidad/google/pendiente`    | Cookie temporal del flujo | Sin cuerpo; requiere cookie `veto_google_pendiente`.                                            | `200 { "pendiente": null \| { "tipo": "VINCULAR", "correo": string, "nombre": string, "requiereCodigo": boolean } \| { "tipo": "REGISTRO", "correo": string, "nombre": string } }`.                   |
| `POST /api/identidad/google/vincular`    | Cookie temporal del flujo | `{ "contrasena": string, "codigo"?: "123456" }`; `codigo` se requiere cuando la cuenta usa 2FA. | `200 { "usuario": Usuario }` y cookie `veto_session`; consume la solicitud pendiente.                                                                                                                 |
| `POST /api/identidad/google/completar`   | Cookie temporal del flujo | `{ "celular": "3001234567" }`. Nombre y correo vienen de Google.                                | `201 { "usuario": Usuario }` y cookie `veto_session`; consume la solicitud pendiente.                                                                                                                 |
| `DELETE /api/identidad/google/pendiente` | Cookie temporal del flujo | Sin cuerpo.                                                                                     | `204` sin cuerpo; elimina la solicitud pendiente y su cookie.                                                                                                                                         |

Motivos de error posibles en la redirección: `cancelado`, `proveedor`, `correo_no_verificado`,
`estado`, `cuenta_inactiva`, `cuenta_vinculada`, `cuenta_distinta` y `no_disponible`.

### Aliados, clínicas y fundaciones

| Método y ruta                             | Acceso                                            | Entrada                                                                                     | Respuesta correcta                                                                                                                                                                                                                                                           |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/aliados/busqueda/nombre`        | Sesión con rol `TUTOR`                            | Query requerido `nombre` (texto no vacío).                                                  | `200` lista de hasta 10 `{ "id", "nombre", "tipo" }` de aliados activos; coincidencia exacta sensible a mayúsculas y acentos; solo `CLINICA`, `VET_INDEPENDIENTE` y `TIENDA`; sin resultados devuelve `[]`. Entrada inválida: `400`. Sin sesión: `401`; rol distinto: `403`. |
| `GET /api/aliados/clinicas`               | Público                                           | Sin entrada.                                                                                | `200` lista `{ "id", "nombre", "descripcion" }[]` de clínicas activas.                                                                                                                                                                                                       |
| `POST /api/aliados`                       | Público                                           | `RegistroAliado`. Las fundaciones usan la ruta específica de registro de fundación.         | `201 { "usuario": Usuario, "aliado": { "id", "tipo", "nombre", "descripcion", "contacto", "ciudad", "ubicacion", "estado", "creadoEn" } }`. Correo duplicado: `409`.                                                                                                         |
| `GET /api/aliados/me`                     | Sesión con rol `ALIADO`                           | Sin cuerpo.                                                                                 | `200 { "aliado": { "id", "tipo", "nombre", "descripcion", "contacto", "ciudad", "ubicacion", "estado", "creadoEn" } }`.                                                                                                                                                      |
| `GET /api/aliados/me/fundacion`           | Sesión con rol `ALIADO`                           | Sin cuerpo.                                                                                 | `200 { "fundacion": { "id": string, "estado": EstadoAliado } }`.                                                                                                                                                                                                             |
| `POST /api/aliados/fundaciones`           | Público                                           | `RegistroFundacion`.                                                                        | `201 { "usuario": Usuario, "fundacion": Fundación }`; nace con estado `PENDIENTE`. Datos inválidos: `400` con errores por campo; correo duplicado: `409`.                                                                                                                    |
| `GET /api/aliados/me/fundacion/datos`     | Sesión con rol `ALIADO`                           | Sin cuerpo.                                                                                 | `200 { "fundacion": Fundación & { "representante", "correo", "celular" } }`.                                                                                                                                                                                                 |
| `GET /api/aliados/:aliadoId/especies`     | Público; aliado activo                            | `aliadoId` UUID.                                                                            | `200` lista `{ "id": number, "nombre": string }[]`.                                                                                                                                                                                                                          |
| `PUT /api/aliados/:aliadoId/especies`     | Sesión de administrador de aliado `ALIADO` activo | `aliadoId` UUID; `{ "especieIds": number[] }`, selección completa no vacía, sin duplicados. | `200` lista de especies `{ "id", "nombre" }[]` guardada.                                                                                                                                                                                                                     |
| `GET /api/aliados/:aliadoId/confirmacion` | Público; aliado activo que recibe citas           | `aliadoId` UUID.                                                                            | `200 { "modo": "AUTOMATICA" \| "MANUAL", "estadoInicialCita": "AGENDADA" \| "PENDIENTE" }`.                                                                                                                                                                                  |
| `PUT /api/aliados/:aliadoId/confirmacion` | Administrador de aliado `ALIADO` activo           | `{ "modo": "AUTOMATICA" \| "MANUAL" }`.                                                     | `200` mismo objeto de confirmación. Solo afecta reservas nuevas.                                                                                                                                                                                                             |

### Sedes

Las rutas de gestión requieren sesión del administrador del aliado; el aliado debe ser una clínica
o tienda activa. `sedeId` y `aliadoId` son UUID.

| Método y ruta                                           | Acceso                 | Entrada                                            | Respuesta correcta                                 |
| ------------------------------------------------------- | ---------------------- | -------------------------------------------------- | -------------------------------------------------- |
| `GET /api/aliados/:aliadoId/sedes`                      | Público                | `aliadoId`.                                        | `200` lista de sedes activas (`Sede`).             |
| `GET /api/aliados/:aliadoId/sedes/gestion`              | Administrador `ALIADO` | `aliadoId`.                                        | `200` lista de sedes activas e inactivas (`Sede`). |
| `GET /api/aliados/:aliadoId/sedes/:sedeId`              | Administrador `ALIADO` | `aliadoId`, `sedeId`.                              | `200 Sede`.                                        |
| `POST /api/aliados/:aliadoId/sedes`                     | Administrador `ALIADO` | `Sede` de entrada.                                 | `201 Sede`.                                        |
| `PUT /api/aliados/:aliadoId/sedes/:sedeId`              | Administrador `ALIADO` | `Sede` de entrada; reemplaza los campos editables. | `200 Sede` actualizada.                            |
| `PATCH /api/aliados/:aliadoId/sedes/:sedeId/desactivar` | Administrador `ALIADO` | `aliadoId`, `sedeId`; sin cuerpo.                  | `200 Sede` con `activa: false`.                    |

### Veterinarios

| Método y ruta                                                    | Acceso                                        | Entrada                                                                                 | Respuesta correcta                                                                                                                                       |
| ---------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/aliados/:clinicaId/veterinarios`                       | Público                                       | `clinicaId` UUID.                                                                       | `200 { "id", "nombre", "descripcion", "veterinarios": { "id", "nombre", "fotoUrl", "descripcion" }[] }`. Solo incluye veterinarios y cuentas activos.    |
| `POST /api/aliados/:clinicaId/veterinarios`                      | Sesión; debe administrar la clínica           | `{ nombre, celular, correo, contrasena, fotoUrl?, descripcion? }`.                      | `201` perfil/cuenta del veterinario creado.                                                                                                              |
| `PUT /api/aliados/:clinicaId/veterinarios/:veterinarioId/perfil` | Administrador de la clínica                   | `{ fotoUrl?, descripcion? }`; enviar al menos uno. `null` o texto vacío quita el valor. | `200` perfil actualizado, visible en la ficha pública: `{ "id", "usuarioId", "aliadoId", "fotoUrl", "descripcion" }`.                                    |
| `GET /api/veterinarios/me`                                       | Sesión de veterinario activo en aliado activo | Sin cuerpo.                                                                             | `200 PerfilVeterinario`: `{ "id", "usuario": { "id", "nombre", "correo", "celular" }, "aliado": { "id", "nombre", "tipo" }, "fotoUrl", "descripcion" }`. |

### Mascotas

Las rutas de gestión requieren sesión con rol `TUTOR`; los UUID de mascota se validan y la mascota
debe pertenecer al tutor autenticado.

| Método y ruta                | Acceso  | Entrada                                                                                        | Respuesta correcta                                                    |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET /api/mascotas/especies` | Público | Sin entrada.                                                                                   | `200` catálogo de especies.                                           |
| `POST /api/mascotas`         | Tutor   | `Mascota` de entrada.                                                                          | `201 Mascota`. Chip ya registrado: `409`; especie desconocida: `400`. |
| `GET /api/mascotas`          | Tutor   | Sin entrada.                                                                                   | `200 Mascota[]` del tutor.                                            |
| `GET /api/mascotas/:id`      | Tutor   | `id` UUID.                                                                                     | `200 Mascota` propia; si no existe o no pertenece al tutor: `404`.    |
| `PUT /api/mascotas/:id`      | Tutor   | `Mascota` de entrada completa; opcionales omitidos quedan vacíos y `fotos` reemplaza la lista. | `200 Mascota` actualizada.                                            |

### Servicios, precios y cotizaciones

Las rutas de gestión requieren sesión de administrador `ALIADO` activo y el aliado debe ser clínica
o veterinario independiente. `aliadoId` y `servicioId` son UUID.

| Método y ruta                                                    | Acceso                 | Entrada                                                                                                                                                                                                 | Respuesta correcta                                                                                            |
| ---------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/servicios/tipos`                                       | Público                | Sin entrada.                                                                                                                                                                                            | `200` catálogo de tipos de servicio.                                                                          |
| `GET /api/servicios`                                             | Público                | Filtros opcionales `especieId` (especie atendida, 1–32767), `tipoServicioId` (1–32767), `modalidad` (`EN_SEDE` o `A_DOMICILIO`) y `orden` (`nombre`, `precio_asc`, `precio_desc`). Se combinan con AND. | `200 ServicioConReglas[]` con servicios disponibles; `200 []` sin coincidencias; parámetros inválidos: `400`. |
| `GET /api/aliados/:aliadoId/servicios`                           | Público                | Query opcional `especieId` (entero positivo).                                                                                                                                                           | `200 Servicio[]` disponibles para reservar; lista vacía si no atiende la especie.                             |
| `GET /api/aliados/:aliadoId/servicios/gestion`                   | Administrador `ALIADO` | `aliadoId`.                                                                                                                                                                                             | `200 Servicio[]`, incluye activos e inactivos.                                                                |
| `GET /api/aliados/:aliadoId/servicios/:servicioId`               | Administrador `ALIADO` | `aliadoId`, `servicioId`.                                                                                                                                                                               | `200 Servicio` para gestión.                                                                                  |
| `POST /api/aliados/:aliadoId/servicios`                          | Administrador `ALIADO` | `Servicio` de entrada.                                                                                                                                                                                  | `201 Servicio`.                                                                                               |
| `PUT /api/aliados/:aliadoId/servicios/:servicioId`               | Administrador `ALIADO` | `Servicio` de entrada completa.                                                                                                                                                                         | `200 Servicio` actualizado. Si ya hay citas no permite cambiar tipo ni modalidad (`409`).                     |
| `GET /api/aliados/:aliadoId/servicios/:servicioId/reglas-precio` | Administrador `ALIADO` | `aliadoId`, `servicioId`.                                                                                                                                                                               | `200 ReglaPrecio[]`.                                                                                          |
| `PUT /api/aliados/:aliadoId/servicios/:servicioId/reglas-precio` | Administrador `ALIADO` | `{ "reglas": ReglaPrecio[] }`; reemplaza toda la lista; `[]` elimina las reglas.                                                                                                                        | `200 ReglaPrecio[]` guardadas.                                                                                |
| `PATCH /api/aliados/:aliadoId/servicios/:servicioId/desactivar`  | Administrador `ALIADO` | Sin cuerpo.                                                                                                                                                                                             | `200 Servicio` actualizado con `activo: false`.                                                               |
| `PATCH /api/aliados/:aliadoId/servicios/:servicioId/activar`     | Administrador `ALIADO` | Sin cuerpo.                                                                                                                                                                                             | `200 Servicio` actualizado con `activo: true`.                                                                |
| `GET /api/servicios/:servicioId`                                 | Público                | `servicioId` UUID.                                                                                                                                                                                      | `200 Servicio` disponible; si no existe o no está disponible: `404`.                                          |
| `GET /api/servicios/:servicioId/cotizacion`                      | Tutor                  | Query requerido `mascotaId` (UUID); servicio disponible.                                                                                                                                                | `200 { "servicioId": string, "mascotaId": string, "precioBase": number, "precio": number }`.                  |

### Horarios, disponibilidad y bloqueos

| Método y ruta                                                                   | Acceso                                                             | Entrada                                                                                                                                  | Respuesta correcta                                                                                                                                                           |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/aliados/:clinicaId/veterinarios/:veterinarioId/horarios`              | Sesión del administrador de la clínica o veterinario independiente | `{ "horarios": Horario[] }`; al menos uno. Reemplaza el horario completo.                                                                | `200` lista `{ "id", "veterinarioId", "diaSemana", "horaInicio", "horaFin", "vigenteDesde", "vigenteHasta" }[]`. Solapamientos o incompatibilidad con citas vigentes: `409`. |
| `GET /api/aliados/:clinicaId/veterinarios/:veterinarioId/horarios`              | Sesión del administrador de la clínica o veterinario independiente | Parámetros UUID; sin cuerpo.                                                                                                             | `200` misma lista de horarios.                                                                                                                                               |
| `GET /api/aliados/:aliadoId/disponibilidad`                                     | Público                                                            | Query requerido `servicioId`, `desde`, `hasta`; `veterinarioId` opcional. Fechas ISO `AAAA-MM-DD`, intervalo inclusivo de hasta 31 días. | `200 { "aliadoId", "servicioId", "duracionMin", "espacios": { "veterinarioId", "veterinarioNombre", "inicio", "fin" }[] }`.                                                  |
| `POST /api/aliados/:aliadoId/veterinarios/:veterinarioId/bloqueos`              | Administrador `ALIADO`                                             | `Bloqueo` de entrada.                                                                                                                    | `201 BloqueoAgenda`: `{ "id", "veterinarioId", "inicio", "fin", "motivo" }`. Cruce con otro bloqueo o citas vigentes: `409` (puede incluir `citas`).                         |
| `GET /api/aliados/:aliadoId/veterinarios/:veterinarioId/bloqueos`               | Administrador `ALIADO`                                             | Parámetros UUID; sin cuerpo.                                                                                                             | `200 BloqueoAgenda[]` vigentes y futuros.                                                                                                                                    |
| `DELETE /api/aliados/:aliadoId/veterinarios/:veterinarioId/bloqueos/:bloqueoId` | Administrador `ALIADO`                                             | Parámetros UUID; sin cuerpo.                                                                                                             | `204` sin cuerpo.                                                                                                                                                            |

### Consultas clínicas

Requiere sesión y perfil de veterinario activo asociado a un aliado activo. La API toma el veterinario
de la sesión: no acepta un veterinario arbitrario en URL o cuerpo.

| Método y ruta                            | Acceso                  | Entrada                                                                                                                 | Respuesta correcta                                                                           |
| ---------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /api/veterinarios/me/consultas`     | Veterinario autenticado | Query opcional `estado=ABIERTA\|CERRADA`, `pagina` (predeterminada `1`) y `limite` (predeterminado `20`, máximo `100`). | `200 { "items": ConsultaResumen[], "total": number, "pagina": number, "limite": number }`.   |
| `GET /api/veterinarios/me/consultas/:id` | Veterinario autenticado | `id` UUID.                                                                                                              | `200` detalle de consulta propia (`ConsultaDetalle`); si no existe o no le pertenece: `404`. |

### Revisión de fundaciones (Equipo Veto)

Todas estas rutas requieren sesión con rol `EQUIPO_VETO`; `fundacionId` es UUID.

| Método y ruta                                        | Entrada                    | Respuesta correcta                                                                             |
| ---------------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `GET /api/admin/fundaciones/pendientes`              | Sin cuerpo.                | `200 { "fundaciones": FundaciónRevision[] }`.                                                  |
| `GET /api/admin/fundaciones/:fundacionId`            | `fundacionId`.             | `200 { "fundacion": FundaciónRevision }`, con los datos enviados y contacto del representante. |
| `PATCH /api/admin/fundaciones/:fundacionId/aprobar`  | `fundacionId`; sin cuerpo. | `200 { "fundacion": { "id": string, "estado": "ACTIVO" } }`.                                   |
| `PATCH /api/admin/fundaciones/:fundacionId/rechazar` | `fundacionId`; sin cuerpo. | `200 { "fundacion": { "id": string, "estado": "RECHAZADO" } }`.                                |

La decisión solo se aplica a solicitudes `PENDIENTE` y se registra en la auditoría administrativa.

### Reservas y ciclo de vida de citas (HU-029 a HU-033)

Las rutas de reserva requieren sesión con rol `TUTOR`. La selección de horario se conserva por tutor durante 60 minutos desde el último paso; aún no bloquea el espacio, por lo que la API vuelve a validar la disponibilidad al confirmar.

| Método y ruta                         | Acceso                                                      | Entrada y respuesta                                                                                                                                                                                                                                                                                                               |
| ------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PUT /api/reservas/seleccion`         | Tutor                                                       | `{ servicioId, veterinarioId, inicio }`, con fecha-hora y zona horaria de uno de los espacios disponibles. Guarda la selección; hora pasada: `400` con razón `PASADO`; espacio ocupado o no disponible: `409` (`OCUPADO` o `NO_DISPONIBLE`). Elegir otro horario reemplaza el anterior y conserva mascota y motivo.               |
| `PATCH /api/reservas/seleccion`       | Tutor                                                       | `{ mascotaId?, motivo? }`, al menos uno. Actualiza solo lo enviado. El motivo se recorta y admite hasta 500 caracteres; vacío o `null` lo quita. La mascota debe ser propia y de una especie atendida. Sin horario seleccionado: `404`; especie incompatible: `409 ESPECIE_NO_ATENDIDA`; reserva confirmada: `409 YA_CONFIRMADA`. |
| `GET /api/reservas/seleccion`         | Tutor                                                       | Devuelve selección, vigencia y, si dejó de ser válida, su razón (`PASADO`, `OCUPADO`, `NO_DISPONIBLE`). Incluye `citaId` cuando se confirmó. Sin selección o vencida: `404`.                                                                                                                                                      |
| `DELETE /api/reservas/seleccion`      | Tutor                                                       | Descarta la selección; `204` sin cuerpo.                                                                                                                                                                                                                                                                                          |
| `GET /api/reservas/resumen`           | Tutor                                                       | Devuelve servicio, horario, veterinario, mascota, motivo, precio y estado esperado (`AGENDADA` o `PENDIENTE`), junto con `listo` y `pendientes`. No crea la cita; sin selección: `404`.                                                                                                                                           |
| `POST /api/reservas`                  | Tutor                                                       | Sin cuerpo; confirma lo guardado. Revalida disponibilidad y campos, y crea la cita (`201`). Si se repite una confirmación ya procesada, devuelve la misma cita con `200` y `repetida: true`. Conflictos: `409` con razón o código de negocio; horario pasado o faltan datos obligatorios: `400`.                                  |
| `GET /api/citas/:citaId`              | Tutor, aliado o veterinario                                 | Detalle de una cita, incluido el motivo. Solo lo ve el tutor propietario, el administrador del aliado o un veterinario activo asociado; recurso inexistente o ajeno: `404`.                                                                                                                                                       |
| `PATCH /api/citas/:citaId/finalizar`  | Administrador del aliado o veterinario activo de ese aliado | Cuerpo opcional `{ recomendaciones? }` (máximo 2000 caracteres). Cambia `AGENDADA` a `FINALIZADA`; las recomendaciones las ve el tutor en el detalle. El inicio de la cita debe haber llegado.                                                                                                                                    |
| `PATCH /api/citas/:citaId/no-asistio` | Administrador del aliado o veterinario activo de ese aliado | Cuerpo opcional `{ observacion? }` (máximo 500 caracteres). Cambia `AGENDADA` a `NO_ASISTIO`; la observación es interna y solo la ve el aliado.                                                                                                                                                                                   |
| `GET /api/citas/:citaId/historial`    | Tutor, aliado o veterinario                                 | Historial cronológico de estados. La observación de inasistencia se oculta al tutor; una persona ajena recibe `404`.                                                                                                                                                                                                              |

Los cierres solo admiten citas `AGENDADA` y cuya hora de inicio ya llegó (hora de la base de datos). Errores de cierre incluyen `400 DATOS_INVALIDOS`, `401 NO_AUTENTICADO`, `403 SIN_PERMISOS_CITA`, `404 CITA_NO_ENCONTRADA`, `409 ESTADO_CITA_INVALIDO`, `422 CITA_NO_FINALIZABLE` y `500 ERROR_INTERNO`; llevan `codigo` y `message`. Estado, historial y recomendaciones se guardan en una transacción. Se intenta crear la notificación al tutor en esa misma transacción; si falla la notificación, se registra el error y se conserva el cierre.

### Adopciones (HU-080, HU-082, HU-084, HU-085 y HU-088)

| Método y ruta                           | Acceso                                  | Entrada y respuesta                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/adopciones`                  | Fundación con sesión `ALIADO`, aprobada | Publica con `nombre`, `especieId`, `edadMeses`, `sexo`, `tamano`, `ubicacion`; `descripcion`, `fotos` y `videoUrl` son opcionales. Estado inicial `DISPONIBLE`.                                                                                                                                                                          |
| `GET /api/adopciones/catalogo`          | Público                                 | Catálogo anónimo `DISPONIBLE` de fundaciones activas. Filtros opcionales: `especieId`, `edadMinMeses`/`edadMaxMeses` (rango inclusivo; puede enviarse uno o ambos), `tamano` y `ubicacion` (igualdad exacta). Los filtros se combinan con AND; devuelve `200 []` si no hay coincidencias. Parámetros inválidos o rango invertido: `400`. |
| `GET /api/adopciones/mis-publicaciones` | Fundación con sesión `ALIADO`           | Lista publicaciones propias. Admite `?estado=DISPONIBLE\|PAUSADA\|EN_PROCESO\|ADOPTADA\|RETIRADA`.                                                                                                                                                                                                                                       |
| `PUT /api/adopciones/:id`               | Fundación con sesión `ALIADO`           | Edita una publicación propia con los campos de publicación; los medios se reemplazan en la misma transacción.                                                                                                                                                                                                                            |
| `PATCH /api/adopciones/:id/estado`      | Fundación con sesión `ALIADO`           | Cambia el estado de una publicación propia conforme a las transiciones permitidas. `ADOPTADA` y `RETIRADA` son terminales.                                                                                                                                                                                                               |
| `GET /api/adopciones/:mascotaId`        | Tutor autenticado                       | Detalle de una publicación, sin datos de la fundación.                                                                                                                                                                                                                                                                                   |

`fotos` acepta hasta 10 URLs HTTP(S) y `videoUrl` una URL opcional. La API guarda referencias a medios, no archivos binarios. Solo fundaciones aprobadas pueden publicar.

El catálogo conserva la lectura desde `v_catalogo_adopcion`, que restringe a publicaciones disponibles de fundaciones activas y no expone sus identificadores ni datos de contacto.

### Catálogo de productos

| Método y ruta                   | Acceso  | Entrada y respuesta                                                                                                                                                                                                               |
| ------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/productos/categorias` | Público | Lista `{ id, nombre }` de `categoria_producto`, ordenada por id.                                                                                                                                                                  |
| `GET /api/productos`            | Público | Filtros opcionales `categoriaId` (entero positivo), `nombre` (coincidencia parcial, ignora mayúsculas/acentos y normaliza espacios) y `orden=nombre\|precio_asc\|precio_desc`. Se combinan; devuelve `ProductoCatalogo[]` o `[]`. |

Los filtros conservan disponibilidad actual (`activo`, moderación `PUBLICADO`, aliado `ACTIVO`) y fotos publicadas. `nombre` solo consulta `producto.nombre`; un texto vacío normalizado se omite. Las entradas inválidas devuelven `400`.

### Búsqueda general por palabra clave (HU-025)

| Método y ruta                      | Acceso            | Entrada y respuesta                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/busqueda?nombre={texto}` | Tutor autenticado | Busca parcialmente por nombre en clínicas, aliados veterinarios independientes, tiendas, perfiles veterinarios activos, productos publicados y servicios disponibles. Ignora mayúsculas, acentos y espacios redundantes. Devuelve `{ resultadosPorCategoria: [{ categoria, resultados: [{ id, nombre }] }] }`, con máximo 10 resultados por categoría. Sin coincidencias devuelve `{ resultadosPorCategoria: [] }`. Adopción queda excluida. |

La búsqueda usa SQL parametrizado, normaliza la consulta y los nombres en lectura, y no modifica los datos almacenados. El endpoint exacto de HU-024 permanece sin cambios. La extensión PostgreSQL `unaccent` se habilita mediante la migración `0015_hu025_busqueda_unaccent.sql`.
