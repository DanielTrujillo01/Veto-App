# Veto · Modelo de datos

Base de datos del piloto Bogotá. Construido a partir del Product Backlog (HU-001 a HU-095) y del levantamiento de requisitos del cliente.

| Archivo                                 | Para qué sirve                                                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `veto_schema.sql`                       | El modelo: 53 tablas, 31 tipos enumerados, 7 vistas, 56 triggers y datos semilla. PostgreSQL 15+.                                               |
| `veto_pruebas.sql`                      | 70 pruebas que comprueban las reglas (51 casos que deben ser rechazados y 19 comprobaciones). Corre en una transacción y termina en `ROLLBACK`. |
| `diagramas_er.html` / `diagramas_er.md` | Diagramas entidad-relación por módulo, generados desde el esquema real. El `.html` se abre en el navegador; el `.md` se ve en GitHub o VS Code. |

---

## 1. Decisión: modelo relacional (PostgreSQL)

**Elegí relacional.** Lo que el cliente pidió es, casi línea por línea, lo que una base relacional hace bien:

| Lo que dice el cliente                                                                                       | Por qué pide relacional                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cita depende de tutor, mascota, servicio y aliado; historia depende de cita y mascota (7.5)                  | Son relaciones fuertes con llaves foráneas. La base impide una cita con una mascota que no es del tutor.                                                           |
| Pagos, stock, comisiones, facturación DIAN                                                                   | Necesitan transacciones ACID. Pagar un pedido descuenta el stock en la misma operación, o no pasa nada.                                                            |
| Historia clínica cerrada no se edita; se corrige con una anotación que registra quién y cuándo (6.7, HU-042) | Se garantiza con triggers y tablas de solo inserción. Es una obligación legal, no solo de la app.                                                                  |
| Dos citas no pueden ocupar al mismo veterinario a la vez (HU-031)                                            | PostgreSQL lo resuelve con una restricción de exclusión sobre rangos de tiempo. En una base documental esto se hace a mano y con riesgo de condiciones de carrera. |
| Dashboards y reportes con filtros por fecha, servicio, aliado, especie y estado (E18)                        | Es SQL con joins y agregaciones; las vistas ya incluidas lo muestran.                                                                                              |
| Ley 1581, trazabilidad de quién modificó qué (12.7)                                                          | Auditoría y anonimización centralizadas en la base.                                                                                                                |

**Dónde sí usé flexibilidad tipo documento:** PostgreSQL permite columnas `jsonb`, y las uso solo donde la estructura puede cambiar sin migraciones: respuestas del formulario de adopción, beneficios del plan Pro (aún sin definir), datos de las notificaciones, respuesta del proveedor de facturación, parámetros de la plataforma y la copia de los datos del dueño en la consulta.

**Qué no pondría en la base:** fotos, anexos clínicos, PDFs y videos. Van en almacenamiento de objetos (S3, Cloud Storage…) y la base guarda solo la URL o la clave. Los anexos clínicos van en un bucket privado.

**Cuándo reconsiderarlo:** con el piloto (decenas de usuarios) PostgreSQL alcanza de sobra. Si el chat o las notificaciones crecen mucho, esas dos tablas podrían moverse a un almacén aparte sin tocar el resto del modelo.

---

## 2. Estructura del modelo

Diagramas completos en `diagramas_er.html`. Resumen por módulo:

| Módulo                         | Tablas                                                                                                                                                               | Historias                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Cuentas y acceso**           | `usuario`, `identidad_externa` (Google), `token_verificacion` (recuperar contraseña / 2FA), `equipo_veto`, `consentimiento` (Ley 1581), `parametro_plataforma`       | HU-001..006, 051                |
| **Aliados**                    | `aliado` (clínica, veterinario independiente, tienda o fundación), `aliado_documento`, `miembro_aliado`, `veterinario`, `sede`, `fundacion_perfil`, `aliado_especie` | HU-007, 012..016, 021, 078..079 |
| **Mascotas y oferta**          | `mascota`, `mascota_foto`, `servicio`, `servicio_regla_precio`, `horario_atencion`, `excepcion_agenda` + catálogos `especie`, `tipo_servicio`                        | HU-008..010, 018..023           |
| **Citas e historia clínica**   | `cita`, `consulta`, `signos_vitales`, `consulta_anexo`, `control_seguimiento`, `consulta_anotacion`                                                                  | HU-017, 029..043                |
| **Productos y pedidos**        | `producto`, `producto_foto`, `pedido`, `pedido_item`, `categoria_producto`                                                                                           | HU-044..050                     |
| **Monetización**               | `plan`, `suscripcion`, `pago`, `reembolso`, `comision_config`, `comision`, `factura_electronica`                                                                     | HU-055..060                     |
| **Comunicación y reseñas**     | `resena`, `conversacion`, `mensaje`, `notificacion`, `pqrs`, `pqrs_seguimiento`                                                                                      | HU-051..054, 061..064, 068..069 |
| **Adopción**                   | `mascota_adopcion`, `adopcion_media`, `solicitud_adopcion`                                                                                                           | HU-078..095                     |
| **Administración y auditoría** | `accion_administrativa`, `auditoria`, `historial_estado`                                                                                                             | HU-063, 065..067                |

### Decisiones de diseño que conviene conocer

1. **Un solo concepto de "aliado" con un tipo.** Clínica, veterinario independiente, tienda y fundación comparten `aliado` (verificación, suspensión, documentos). Lo que es propio de cada uno va en tablas satélite (`fundacion_perfil`, `veterinario`). Un veterinario independiente es un aliado con un único veterinario.
2. **Usuario ≠ rol.** `usuario` es la cuenta. Ser tutor es tener mascotas. Pertenecer a un aliado es `miembro_aliado` (administrador de la clínica, veterinario, operador). El Equipo Veto está en `equipo_veto` con su rol (admin, verificador, soporte).
3. **La historia clínica no es una tabla, es el conjunto de consultas.** Cada `consulta` cuelga de una `cita` y de una `mascota`. La vista `v_historial_mascota` arma el historial que ve el tutor, así no hay datos duplicados entre cita e historial (HU-035).
4. **Fotos del momento.** `cita.precio_acordado`, `pedido_item.precio_unitario` y `consulta.propietario_snapshot` guardan el valor vigente al momento de la operación. Si el precio o los datos del dueño cambian después, lo histórico no se altera.
5. **Estados cerrados como ENUM, listas abiertas como tablas.** Estados de cita, pedido, pago, etc. son tipos enumerados (máquinas de estado estables). Especies, tipos de servicio y categorías son tablas, para que el negocio pueda ampliarlas sin migrar.
6. **Anonimato de fundaciones por diseño.** `mascota_adopcion` no guarda dirección; la vista `v_catalogo_adopcion` no expone la fundación. Si la app pública solo lee esa vista, no hay forma de filtrar datos por error.

---

## 3. Reglas del cliente que la base garantiza

| Regla (fuente)                                                                                         | Cómo se hace cumplir                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Correo y cédula únicos; celular de 10 dígitos; correo válido (6.4, 6.6)                                | `UNIQUE` sobre `citext` + `CHECK`                                             |
| Matrícula profesional y documento del aliado únicos (6.6)                                              | `UNIQUE`                                                                      |
| Solo aliados verificados publican; filtro por especie solo muestra quien la atiende (5.1)              | Vistas filtran por verificación; trigger de cita valida `aliado_especie`      |
| La tienda no ofrece servicios de salud (5.7)                                                           | Trigger `fn_validar_tipo_aliado`                                              |
| Fundación no aprobada no publica mascotas (HU-079)                                                     | Mismo trigger, con modo `verificado`                                          |
| Estados de cita y transiciones válidas; solo el aliado finaliza (5.4, HU-032)                          | Trigger `fn_cita_validar`                                                     |
| Sin citas solapadas del mismo veterinario; sin horarios solapados (HU-016, 031)                        | `EXCLUDE USING gist`                                                          |
| Sin duplicados por doble clic o reintento (HU-031, 090)                                                | `clave_idempotencia` única por tutor                                          |
| Servicio con citas pasadas se desactiva, no se borra (7.6)                                             | Columna `activo` + llaves foráneas sin cascada                                |
| Precio variable por peso, edad o especie; sin regla o sin dato → precio base (HU-020)                  | Función `fn_precio_servicio`                                                  |
| Consulta cerrada no se edita ni se borra; corrección = nueva anotación con autor y fecha (6.7, HU-042) | Triggers + `consulta_anotacion` de solo inserción                             |
| Campos obligatorios de la historia: motivo, diagnóstico presuntivo, fecha (6.2)                        | `NOT NULL` + `CHECK` al cerrar                                                |
| Reseña solo tras cita finalizada, una por cita (HU-061)                                                | Trigger + `UNIQUE (cita_id)`                                                  |
| Pago apunta a una sola cosa; sin datos de tarjeta (6.10)                                               | `CHECK (num_nonnulls(...) = 1)`; solo referencia de pasarela                  |
| Comisión entre 2 % y 5 %, verificable y con redondeo definido (HU-056)                                 | `CHECK` de rango y de `monto = round(base × %)`                               |
| Pedido no se cancela tras despacho; el stock se descuenta al pagar y se devuelve al cancelar (HU-049)  | Trigger `fn_pedido_estado`                                                    |
| Un tutor no tiene dos solicitudes de adopción activas para la misma mascota (HU-090)                   | Índice único parcial                                                          |
| Quién cambió qué y cuándo, en citas, pagos y clínica (12.7)                                            | `historial_estado` y `auditoria` (solo inserción), llenadas por trigger       |
| Eliminar cuenta sin perder historia clínica (7.6, Ley 1581)                                            | `fn_anonimizar_usuario`; la auditoría de `usuario` no guarda datos personales |

**Para que la trazabilidad funcione**, la aplicación debe ejecutar al inicio de cada transacción:

```sql
SET LOCAL app.usuario_id = '<uuid del usuario autenticado>';
```

---

## 4. Lo que queda en la aplicación (no en la base)

- **Cálculo de espacios libres** para el calendario: la base impide solapamientos, pero decidir qué horas ofrecer (horario − excepciones − citas) es lógica de la app.
- **Permisos por rol** (qué ve cada actor, HU-014, 036, 050): la base ofrece la estructura; hacerlos cumplir es de la capa de autorización.
- **Recordatorios y correos**: la base guarda la cola (`notificacion`, con `programada_para` y `clave_dedupe`); un proceso en segundo plano la envía y cancela los recordatorios obsoletos.
- **Integraciones**: pasarela de pago, proveedor DIAN, Google y WhatsApp.
- **Si la plataforma cobra o solo conecta** (5.5): hay una bandera `aliado.cobro_por_plataforma`, pero el flujo lo define la app.

---

## 5. Supuestos y puntos a confirmar con el cliente

Lo que añadí por necesidad técnica o porque el cliente aún no lo definió. Conviene validarlo antes de cerrar el modelo:

| #   | Tema                                                    | Qué asumí                                                                                                                   | A confirmar                                                                                                                                                                                                   |
| --- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Duración del servicio                                   | `servicio.duracion_min` (30 por defecto)                                                                                    | No está en los requisitos, pero sin duración no se puede calcular qué horas están libres.                                                                                                                     |
| 2   | Estados del pedido                                      | Pendiente de pago → Pagado → Confirmado → En preparación → Despachado → Entregado / Cancelado                               | HU-047 dice "estados definidos por el negocio" y no los lista.                                                                                                                                                |
| 3   | Listas de anamnesis                                     | Estado mental: alerta, deprimido, excitado, estupor, coma. Condición corporal: caquéctico, delgado, ideal, sobrepeso, obeso | 6.5 pide listas cerradas pero no da los valores. Validar con los veterinarios.                                                                                                                                |
| 4   | Conservación de datos (6.9)                             | Los datos clínicos no se borran                                                                                             | Está "indefinido" y hay una tensión real: Ley 1581 permite suprimir datos, y una historia clínica cerrada es inmutable (`propietario_snapshot` contiene datos del dueño). **Debe resolverse con un abogado.** |
| 5   | Política de cancelación                                 | Solo la columna `cita.penalidad`                                                                                            | Falta la regla (plazos, montos) que el cliente mencionó en 3.8.                                                                                                                                               |
| 6   | Liquidación a aliados                                   | No hay tabla de liquidaciones                                                                                               | Si Veto cobra el pago, hará falta registrar lo que se le paga al aliado. Depende de 5.5.                                                                                                                      |
| 7   | Medicamentos con fórmula                                | Solo la bandera `requiere_formula`                                                                                          | 5.7 dice que requieren una definición aparte.                                                                                                                                                                 |
| 8   | Veterinario en varias clínicas                          | Un veterinario pertenece a un solo aliado                                                                                   | El requisito dice que el perfil "depende de la clínica".                                                                                                                                                      |
| 9   | Servicios sin veterinario asignado                      | Sin veterinario no hay control de solapamiento (p. ej. peluquería con varios peluqueros)                                    | Hay que definir cuántas citas simultáneas admite un aliado.                                                                                                                                                   |
| 10  | Dashboard del aliado (HU-072) y beneficios Pro (HU-058) | Solo hay `plan.beneficios` en JSON y vistas genéricas                                                                       | El propio backlog los marca "por definir".                                                                                                                                                                    |
| 11  | Servicios de veterinarios a fundaciones                 | No modelado                                                                                                                 | Aparece en el requerimiento innovador, pero ninguna HU lo desarrolla.                                                                                                                                         |
| 12  | Ubicación                                               | Latitud/longitud como números, localidad como texto                                                                         | Para búsquedas por cercanía, PostGIS sería el siguiente paso. Para "solo el mapa de Bogotá" no hace falta.                                                                                                    |

---

## 6. Cómo usarlo

```bash
createdb veto
psql -d veto -v ON_ERROR_STOP=1 -f veto_schema.sql
```

Para verificar las reglas en una base de prueba (no deja datos):

```bash
psql -d veto -v ON_ERROR_STOP=1 -f veto_pruebas.sql
```

Debe terminar con `=== TODAS LAS PRUEBAS PASARON ===`.

En la conexión de la aplicación, usar `SET search_path TO veto, public;` (o fijarlo con `ALTER ROLE ... SET search_path`).
