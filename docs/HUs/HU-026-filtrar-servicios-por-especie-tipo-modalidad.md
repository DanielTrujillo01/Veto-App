## HU-026 – Filtrar servicios por especie, tipo y modalidad

**Como:** tutor.

**Quiero:** filtrar los servicios disponibles por especie, tipo de servicio y modalidad.

**Para:** encontrar servicios que correspondan a lo que necesito.

> **Alcance vigente:** se toma como autoritativa la HU-026 modificada y la nota de alcance del solicitante. El DoD copiado debajo de la versión modificada conserva criterios de la versión original (edad, peso, precio y ubicación) y contradice su título y la nota. En Taiga debe sustituirse por criterios limitados a especie, tipo de servicio y modalidad. No se consideran filtros de edad, peso, precio ni ubicación en esta HU.

### 2. Criterios de aceptación

#### Filtrado del catálogo público

- `GET /api/servicios` acepta opcionalmente `especieId`, `tipoServicioId` y `modalidad`, además del parámetro existente `orden`.
- Cada filtro aplicado se combina con los demás mediante AND: todo servicio devuelto cumple cada valor enviado.
- Sin filtros, el endpoint conserva el comportamiento y orden actuales.
- El catálogo conserva únicamente servicios disponibles según las reglas existentes: aliado activo, servicio activo y publicado y, para modalidad `EN_SEDE`, sede activa y perteneciente al aliado.
- El filtro por especie usa la cobertura del aliado registrada en `aliado_especie`, con la misma semántica funcional del filtro HU-021 del catálogo de servicios de un aliado. No usa las reglas de precio de especie de HU-020.
- Una combinación válida sin resultados devuelve `200` con una lista vacía; un identificador válido que no corresponda a una opción existente tampoco genera un error de recurso inexistente.
- Omitir un filtro desactiva únicamente ese filtro; `?especieId=...&modalidad=...` devuelve el catálogo que cumple ambos, y retirar `modalidad` permite recuperar los resultados que cumplen solo especie.

#### Validación y compatibilidad

- `especieId` y `tipoServicioId`, cuando se envían, deben ser enteros positivos representables por el tipo `smallint` de la base (máximo 32767). Valores mal formados, cero, negativos o fuera de rango producen `400`.
- `modalidad`, cuando se envía, solo acepta `EN_SEDE` o `A_DOMICILIO`; otro valor produce `400`.
- El orden existente (`nombre`, `precio_asc`, `precio_desc`) se conserva. El filtro de precio no forma parte del alcance; ordenar por precio sigue disponible.
- Los parámetros antiguos no incluidos en este alcance (`edad`, `peso`, `precio`, `ubicacion`) no se aplican al resultado y no deben ocasionar error por ser desconocidos, conforme al comportamiento actual no estricto de los esquemas Zod. No se les asigna semántica de filtro.

### 3. Endpoints propuestos

**Listar servicios disponibles con filtros opcionales**

`GET /api/servicios`

Estado: Modificación propuesta del endpoint existente.

Acceso: público, sin sesión requerida; conserva su acceso actual.

Parámetros: `especieId` (entero positivo, opcional), `tipoServicioId` (entero positivo, opcional), `modalidad` (`EN_SEDE` o `A_DOMICILIO`, opcional), `orden` (`nombre`, `precio_asc` o `precio_desc`, opcional; valor por defecto actual `nombre`). Los IDs deben respetar el rango `smallint`.

Cuerpo: no aplica.

Validaciones: validar formato y rango de cada filtro. Combinar filtros presentes mediante AND y mantener el predicado de disponibilidad actual. Para especie, aplicar la cobertura del aliado (`aliado_especie`). Los filtros son opcionales e independientes.

**Respuesta exitosa:**

```json
[
  {
    "id": "2ec7b8ea-c817-47c5-8724-051774038c88",
    "aliadoId": "05db2630-64ce-4403-9954-f64eeab76510",
    "tipoServicioId": 2,
    "tipoServicio": "Consulta general",
    "nombre": "Consulta veterinaria",
    "descripcion": null,
    "modalidad": "A_DOMICILIO",
    "sedeId": null,
    "duracionMin": 30,
    "precioBase": 50000,
    "activo": true,
    "creadoEn": "2026-01-01T10:00:00.000Z",
    "precioDesde": 50000,
    "reglasPrecio": []
  }
]
```

El ejemplo conserva la forma de `ServicioConReglas` actual; sus valores son ilustrativos.

**Errores esperados:** `400` para parámetros inválidos; `500` ante fallo interno de consulta. No se espera `401` ni `403` por tratarse del endpoint público. Una consulta válida sin coincidencias responde `200 []`.

**Catálogo de especies**

`GET /api/mascotas/especies`

Estado: Existente y reutilizable; no requiere modificación para HU-026.

Acceso: público.

Parámetros: ninguno. Cuerpo: no aplica.

Validaciones: ninguna propia de esta HU.

**Respuesta exitosa:** lista existente de `{ "id": 1, "nombre": "Perro" }` (estructura representativa).

**Errores esperados:** errores internos según implementación común; HU-026 no requiere contrato adicional.

**Catálogo de tipos de servicio**

`GET /api/servicios/tipos`

Estado: Existente y reutilizable; no requiere modificación para HU-026.

Acceso: público.

Parámetros: ninguno. Cuerpo: no aplica.

Validaciones: ninguna propia de esta HU.

**Respuesta exitosa:** lista existente de objetos `{ "id": 1, "nombre": "Consulta general" }` (estructura representativa).

**Errores esperados:** errores internos según implementación común; HU-026 no requiere contrato adicional.

No se propone endpoint nuevo. El endpoint `/api/aliados/:aliadoId/servicios?especieId=N` ya existe para HU-021, pero su alcance es listar servicios de un aliado; no sustituye el catálogo global de esta historia. Se reutilizará la semántica de especie sin ampliar accidentalmente ese contrato.

### 4. Errores HTTP esperados

| Código | Situación                                                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `400`  | `especieId` o `tipoServicioId` no es entero positivo dentro del rango permitido, o `modalidad` no pertenece al enum admitido. |
| `500`  | Error inesperado al consultar el catálogo o aplicar los filtros.                                                              |

### 5. Definition of Done (DoD)

- [ ] `GET /api/servicios` acepta y valida `especieId`, `tipoServicioId` y `modalidad`, conservando `orden` y su valor por defecto.
- [ ] Los filtros presentes se combinan con AND y el filtro por especie reutiliza la relación de cobertura del aliado definida para HU-021.
- [ ] Se conserva el criterio vigente de disponibilidad y la forma actual de respuesta `ServicioConReglas`.
- [ ] Parámetros inválidos responden `400`; una consulta válida sin coincidencias responde `200 []`.
- [ ] La omisión o retirada de un filtro devuelve el catálogo sin aplicar ese criterio, sin errores.
- [ ] Pruebas de integración cubren cada filtro, combinaciones, ausencia de filtros, valores inválidos, cero resultados y preservación de disponibilidad/orden.
- [ ] Swagger/OpenAPI y el inventario específico de la operación reflejan los parámetros opcionales y sus valores.
- [ ] No se agregan filtros de edad, peso, precio o ubicación ni cambios de esquema de base de datos.

### 6. Consideraciones técnicas

- **Existente:** `apps/api/src/modules/servicios/servicios.controller.ts` expone el `PublicServiciosController.todos()` en `GET /servicios`, actualmente validado solo con `ordenServiciosSchema`.
- **Existente:** `apps/api/src/modules/servicios/servicios.service.ts` delega `listarTodosDisponibles(orden)` al repositorio.
- **Existente:** `apps/api/src/modules/servicios/servicios.repository.ts` implementa `listarTodosDisponibles`, el predicado de disponibilidad (`aliado.estado = ACTIVO`, servicio activo y publicado, sede válida para `EN_SEDE`), orden por nombre/precio y carga de reglas de precio.
- **Propuesto:** extender el esquema de filtros del catálogo global y los tipos compartidos en `packages/shared/src/servicio.ts` (o un esquema dedicado allí); pasar los filtros por controlador y servicio al repositorio y construir predicados SQL parametrizados. No concatenar valores de usuario en SQL. Mantener el allowlist `ORDENES` existente para el orden.
- **Especie:** existe `filtrarServiciosSchema` en `packages/shared/src/especie.ts` y la ruta HU-021 en `ServiciosController.disponibles()`. No se debe reutilizar el esquema de forma que el filtro global pierda tipo/modalidad, ni modificar el comportamiento de la ruta por aliado. La consulta global debe comprobar la especie atendida por el aliado del servicio mediante `aliado_especie`.
- **Tipos y modalidad:** `servicio.tipo_servicio_id` referencia `tipo_servicio`; `servicio.modalidad` usa `MODALIDADES_SERVICIO` (`EN_SEDE`, `A_DOMICILIO`) en `packages/shared/src/enums.ts`.
- **Opciones para filtros:** `/api/mascotas/especies` y `/api/servicios/tipos` ya ofrecen catálogos públicos. La HU no requiere endpoints nuevos para obtenerlos.
- **Modelo:** las reglas de `servicio_regla_precio` pueden depender de especie, edad y peso, pero pertenecen al cálculo de precio HU-020. No deben confundirse con la especie que el aliado atiende. `sede_id` existe en `servicio`, aunque la nota excluye ubicación como filtro; no se requiere migración.
- **Compatibilidad:** preservar la respuesta, carga de reglas y orden actuales al no enviar filtros. No añadir paginación o límites: la HU no los solicita y el endpoint actual no los define.
- **Pruebas:** ampliar pruebas del catálogo global o crear cobertura de integración específica sin duplicar los casos existentes de HU-021 (`apps/api/test/aliado-especies.spec.ts`) y HU-020 (`apps/api/test/hu020-precios.spec.ts`). Verificar los casos de combinación y que los valores de reglas de precio no alteren la pertenencia por especie.
- **Dependencias:** usa el contrato de cobertura de especies establecido por HU-021 y los catálogos de tipo/especie ya disponibles. No se identifica migración ni dependencia bloqueante de otra HU.
- **Decisiones pendientes:** ninguna para el alcance funcional descrito. Antes de registrar, corregir el DoD antiguo copiado en Taiga para quitar edad, peso, precio y ubicación; conservarlo sin cambio dejaría criterios contradictorios.

### 7. Alcance

**Incluido – Backend:**

- Filtros opcionales por especie atendida, tipo de servicio y modalidad en el catálogo público global existente.
- Combinación AND, validación de parámetros y resultado vacío `200 []`.
- Conservación de disponibilidad, orden y respuesta existentes.
- Pruebas de integración y actualización del contrato Swagger/OpenAPI de esa operación.

**Excluido:**

- Filtros por edad, peso, precio y ubicación.
- Cambios en reglas de precio de HU-020 o en la semántica del filtro por aliado de HU-021.
- Paginación, límites nuevos, cambios de persistencia o migraciones.
- Frontend, UX/UI, Design, controles visuales, navegación e interacción del cliente.

**Estimación total de la HU:** 8 puntos de historia sugeridos (escala Fibonacci modificada). Desglose: UX 0, Diseño 0, Frontend 0, Backend 8. Estimación orientativa para Backend; Taiga debe conservar sus campos propios de prioridad, sprint y responsable según planificación del equipo.
