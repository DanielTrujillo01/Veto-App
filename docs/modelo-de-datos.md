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

**Excluidas (40), por grupos:**

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

---

## 2. Decisión: relacional (PostgreSQL)

Las historias esenciales describen relaciones fuertes y reglas que deben cumplirse siempre:

- La cita depende de tutor, mascota, servicio y aliado. Las llaves foráneas impiden combinaciones inválidas.
- Dos citas no pueden ocupar al mismo veterinario a la vez (HU-029, 031).
- Una consulta cerrada no se edita; se corrige con una anotación que registra quién y cuándo (HU-042).
- El stock debe descontarse y devolverse de forma consistente (HU-046, 049).
- Los dashboards y reportes por fecha, servicio, aliado, especie y estado son consultas SQL (HU-070, 073, 074).

Solo uso `jsonb` en las respuestas del formulario de adopción (HU-090), para poder cambiar el formulario sin migrar. Las fotos viven en almacenamiento externo; la base guarda la URL.

---

## 3. Estructura

| Módulo                              | Tablas                                                                 | Historias                             |
| ----------------------------------- | ---------------------------------------------------------------------- | ------------------------------------- |
| **Usuarios y aliados**              | `usuario`, `aliado`, `veterinario`, `sede`, `aliado_especie`           | 001, 002, 006, 007, 012–016, 021, 078 |
| **Mascotas**                        | `mascota`, `mascota_foto` + vista `v_historial_mascota`                | 008–011                               |
| **Servicios y horarios**            | `servicio`, `servicio_regla_precio`, `horario`                         | 016, 018–022                          |
| **Citas**                           | `cita`, `historial_estado`                                             | 029, 031, 032, 034                    |
| **Registro de consulta**            | `consulta`, `consulta_anotacion`                                       | 017, 037, 042, 043                    |
| **Productos y pedidos**             | `producto`, `producto_foto`, `pedido`, `pedido_item`                   | 044–050                               |
| **Adopción**                        | `mascota_adopcion`, `solicitud_adopcion` + vista `v_catalogo_adopcion` | 078, 080, 082, 083, 087, 090, 092–094 |
| **Notificaciones y administración** | `notificacion`, `accion_admin`                                         | 048, 052, 054, 065–067                |
| **Reportes**                        | vistas `v_citas_reporte`, `v_ventas_productos`                         | 070, 073, 074                         |
| **Catálogos**                       | `especie`, `tipo_servicio`, `categoria_producto`                       | 018, 026, 044                         |

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
| Precio según peso, edad o especie; sin regla o sin dato → precio base (HU-020)                                       | Función `fn_precio_servicio`                   |
| Consulta cerrada no se edita ni se borra; se corrige con anotación (HU-042)                                          | Triggers + tabla de solo inserción             |
| Pedido: valida producto activo, descuenta stock, lo devuelve al cancelar; no se cancela tras despachar (HU-046, 049) | Triggers `fn_pedido_item` y `fn_pedido_estado` |
| Solicitud de adopción: una activa por tutor y mascota; rechazar exige motivo (HU-090, 094)                           | Índice único parcial + `CHECK`                 |
| Quién cambió el estado de cita, pedido, solicitud o publicación                                                      | `historial_estado` (solo inserción)            |

Para que `historial_estado` y la regla "solo el aliado finaliza" funcionen, la aplicación debe ejecutar al inicio de cada transacción:

```sql
SET LOCAL app.usuario_id = '<uuid del usuario autenticado>';
```

---

## 5. Decisiones y puntos a confirmar

| #   | Tema                                               | Qué hice                                                                                                                                                                                                |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Aprobación de fundaciones** (HU-079 es opcional) | HU-080 exige una fundación "autorizada". Dejé `aliado.estado` con `PENDIENTE` por defecto; el Equipo Veto lo pasa a `ACTIVO` (HU-067). No hay flujo de rechazo con motivo.                              |
| 2   | **Consulta clínica reducida**                      | Solo guarda la anamnesis (HU-037). Signos vitales, diagnóstico, tratamiento y anexos (038–040) son opcionales o condicionales y no están. Si el equipo decide agregarlos, son columnas o una tabla más. |
| 3   | **Estados del pedido**                             | HU-047 no los lista. Propuse: pendiente → confirmado → despachado → entregado, con cancelado.                                                                                                           |
| 4   | **Duración del servicio**                          | `servicio.duracion_min` no está en ninguna historia, pero sin ella no se puede calcular qué horas están libres ni evitar solapamientos.                                                                 |
| 5   | **Recomendaciones**                                | HU-033 es condicional, pero HU-011 y HU-054 (esenciales) las mencionan, así que hay una columna `cita.recomendaciones`.                                                                                 |
| 6   | **Pagos**                                          | Ninguna historia esencial incluye pago, así que no hay tablas de pago ni factura.                                                                                                                       |
| 7   | **Logística de pedidos** (HU-050)                  | El backlog la deja "por definir"; no hay dirección ni envío.                                                                                                                                            |
| 8   | **Eliminar cuenta** (HU-006)                       | Marca `estado = ELIMINADA` y `eliminado_en`. La política de conservación de datos no está definida en el backlog.                                                                                       |
| 9   | **Catálogos**                                      | Los valores iniciales de `especie`, `tipo_servicio` y `categoria_producto` son ejemplos.                                                                                                                |
| 10  | **Veterinario independiente**                      | Es un `aliado` más una fila en `veterinario` con su misma cuenta, para poder asignarle citas y horarios.                                                                                                |
| 11  | **Horario mensual**                                | Se modela con la vigencia (`vigente_desde` / `vigente_hasta`) de un horario semanal.                                                                                                                    |

Lo que queda en la aplicación: calcular los espacios libres del calendario, los permisos por rol y el envío efectivo de notificaciones.

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
