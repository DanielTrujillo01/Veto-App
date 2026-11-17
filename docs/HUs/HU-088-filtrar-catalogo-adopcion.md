## HU-088 – Filtrar el catálogo de mascotas en adopción

**Como:** tutor.

**Quiero:** filtrar el catálogo de mascotas en adopción por tipo de mascota (especie), edad, tamaño y ubicación.

**Para:** encontrar publicaciones de adopción que se ajusten a mis criterios.

> La nota de la HU establece que esta historia filtra el catálogo de mascotas en adopción. La implementación descrita aquí se limita al Backend y mantiene el catálogo público anonimizado.

### 2. Criterios de aceptación

#### Filtrado del catálogo

- El catálogo público acepta filtros opcionales por especie, edad, tamaño y ubicación, con edad expresada mediante un rango de meses y ubicación comparada por coincidencia exacta.
- Los filtros enviados se combinan mediante AND; cada publicación devuelta satisface todos los filtros aplicados.
- Al omitir un filtro, solo deja de aplicarse ese criterio; sin filtros, se conserva el listado actual.
- El catálogo continúa mostrando únicamente publicaciones `DISPONIBLE` de fundaciones `ACTIVO`, de acuerdo con `v_catalogo_adopcion`.
- Los resultados conservan la forma pública actual y no exponen `fundacion_id`, identidad ni datos de contacto de la fundación.
- Si la combinación válida no coincide con publicaciones, la API responde `200` con `[]`. El restablecimiento de controles y los mensajes visuales de estado vacío corresponden al cliente; el Backend permite consultar nuevamente sin los parámetros.

#### Validación

- El filtro de especie referencia el identificador del catálogo existente `especie`; un identificador con formato inválido genera `400`. Un ID sintácticamente válido sin coincidencias devuelve `200 []`.
- El filtro de tamaño solo admite los valores del enum existente `PEQUENO`, `MEDIANO` o `GRANDE`; un valor inválido genera `400`.
- La edad se filtra mediante el rango inclusivo en meses `edadMinMeses`/`edadMaxMeses`; se permite enviar el mínimo, el máximo o ambos. Si se envían ambos, el mínimo no puede superar el máximo.
- La ubicación se compara por igualdad exacta con el texto almacenado en `ubicacion`; no se aplica coincidencia parcial.

### 3. Endpoint implementado

**Consultar el catálogo público de adopción con filtros opcionales**

`GET /api/adopciones/catalogo`

Estado: Implementado sobre el endpoint existente.

Acceso: público, sin sesión requerida, conforme al catálogo existente. La HU identifica al actor como tutor, pero no exige autenticación; no se agrega una barrera de sesión que no esté en el contrato actual.

Parámetros implementados: `especieId` (entero positivo de hasta 32767, opcional), `edadMinMeses` y `edadMaxMeses` (enteros de 0 a 32767, opcionales), `tamano` (`PEQUENO|MEDIANO|GRANDE`, opcional) y `ubicacion` (1–160 caracteres no vacíos, opcional). Los límites de edad son inclusivos; se admite uno o ambos y, si se envían ambos, el mínimo debe ser menor o igual al máximo. `ubicacion` se compara por igualdad exacta con el valor almacenado, sin normalización.

Cuerpo: no aplica.

Validaciones implementadas: los parámetros se validan con el esquema compartido. Especie debe ser un entero positivo; los límites de edad son enteros entre 0 y 32767 y se rechaza `edadMinMeses > edadMaxMeses` cuando ambos están presentes; tamaño debe pertenecer al enum; ubicación debe tener entre 1 y 160 caracteres y no ser solo espacios. Los filtros se combinan con AND y usan valores SQL parametrizados.

**Respuesta exitosa:**

```json
[
  {
    "id": "35f7cab3-a768-45ba-b49a-c07c12d715e0",
    "nombre": "Nube",
    "especieId": 1,
    "especie": "Perro",
    "edadMeses": 18,
    "sexo": "HEMBRA",
    "tamano": "MEDIANO",
    "ubicacion": "Bogotá norte",
    "descripcion": null,
    "fotos": ["https://cdn.example.test/nube.jpg"],
    "videoUrl": null
  }
]
```

Ejemplo ilustrativo de la forma pública existente `MascotaAdopcionPublica`; los valores no representan datos reales.

**Errores esperados:** `400` para valores de query inválidos (incluido un rango invertido); `500` ante error inesperado de consulta. Una consulta válida sin coincidencias responde `200 []`. No se esperan `401`/`403` por el acceso público actual.

**Consultar opciones de especie**

`GET /api/mascotas/especies`

Estado: Existente y reutilizable.

Acceso: público.

Parámetros y cuerpo: ninguno.

Validaciones: no requiere cambios para esta HU.

**Respuesta exitosa:** catálogo de especies existente, con objetos `{ "id": 1, "nombre": "Perro" }`.

**Errores esperados:** error interno según el manejo común de la API.

No se requiere un endpoint nuevo. El endpoint público del catálogo de adopción ya existe; esta HU extendió su query opcional sin sustituirlo ni crear una segunda ruta. La consulta pública debe seguir leyendo `v_catalogo_adopcion` para conservar el anonimato.

### 4. Errores HTTP esperados

| Código | Situación                                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| `400`  | Identificador de especie mal formado, tamaño fuera del enum, edad inválida o rango invertido, o ubicación inválida. |
| `500`  | Error inesperado al consultar o filtrar el catálogo.                                                                |

### 5. Definition of Done (DoD)

- [x] El contrato documenta el rango inclusivo de edad en meses, permite mínimo, máximo o ambos, y define ubicación por coincidencia exacta.
- [x] `GET /api/adopciones/catalogo` acepta los filtros aprobados de especie, edad, tamaño y ubicación sin requerir sesión.
- [x] Los filtros se combinan correctamente y solo devuelven publicaciones que cumplen todos los criterios.
- [x] Sin parámetros se conserva el catálogo actual; al omitir un filtro se recuperan coincidencias sin ese criterio.
- [x] Se conservan el filtro de publicaciones disponibles y fundaciones activas, y la respuesta no expone datos de fundación.
- [x] Los parámetros inválidos responden `400`; una consulta válida sin resultados responde `200 []`.
- [x] Pruebas de integración cubren cada filtro, combinaciones, consulta sin filtros, retiro de filtros, validaciones y anonimato; la suite existente de adopción cubre disponibilidad de publicaciones.
- [x] Swagger/OpenAPI documenta los parámetros y la regla aprobada de edad y ubicación.

### 6. Consideraciones técnicas

- **Existente:** `apps/api/src/modules/adopcion/adopcion.controller.ts` implementa `GET /adopciones/catalogo` sin autenticación, valida los query params de filtros y delega a `AdopcionService.listarCatalogo()`.
- **Existente:** `apps/api/src/modules/adopcion/adopcion.service.ts` delega el listado público al repositorio.
- **Existente:** `apps/api/src/modules/adopcion/adopcion.repository.ts`, `listarPublicas()`, consulta `v_catalogo_adopcion ORDER BY id` y transforma filas a `MascotaAdopcionPublica`.
- **Existente:** `db/migrations/0001_baseline.sql` crea `mascota_adopcion` con `especie_id`, `edad_meses` (`smallint`, no negativo), `tamano` (`tamano_mascota`) y `ubicacion` (texto). La publicación valida ubicación no vacía, hasta 160 caracteres, en `packages/shared/src/adopcion.ts`.
- **Existente:** `v_catalogo_adopcion` expone especie, edad, tamaño y ubicación, limita a `DISPONIBLE` con fundación `ACTIVO` y omite la identidad de fundación. `db/migrations/0011_hu084_medios_adopcion.sql` actualiza la vista para fotos y video sin exponer dicha identidad.
- **Implementado:** el controlador valida los query params mediante el esquema compartido, delega los filtros al servicio y el repositorio aplica predicados parametrizados sobre `v_catalogo_adopcion`. Se mantienen privacidad, disponibilidad, orden y forma pública de respuesta.
- **Opciones de especie:** `/api/mascotas/especies` ya es público y reutilizable. `TAMANOS_MASCOTA` en `packages/shared/src/enums.ts` define las opciones de tamaño.
- **Pruebas:** `apps/api/test/hu088-filtros-adopcion.spec.ts` cubre filtros individuales y combinados, límites inclusivos, ubicación exacta, validación, lista vacía, orden y anonimato. `apps/api/test/hu080-adopcion.spec.ts` conserva la cobertura de publicación y disponibilidad.
- **Migración:** no se identifica una modificación de modelo necesaria para aplicar estos filtros; las columnas están presentes. La decisión de agregar índices debe basarse en volumen/plan de consulta y no se asume como requisito de esta HU.
- **Decisiones funcionales confirmadas:** edad mediante rango de meses inclusivo, con mínimo, máximo o ambos; si ambos se envían, rechazar mínimo mayor que máximo con `400`. Ubicación por igualdad exacta, sin normalización. La columna contiene ciudad o zona como texto libre; no hay catálogo estructurado de ubicaciones.
- **Épica:** el contexto confirma que adopción se distribuye entre E19–E23 y clasifica HU-088 como adopción complementaria; no permite identificar cuál de esas épicas concretas corresponde a HU-088. Elegir la épica exacta desde la configuración de Taiga.

### 7. Alcance

**Incluido – Backend:**

- Extender el catálogo público de adopción existente para recibir los filtros acordados de especie, edad, tamaño y ubicación.
- Validar query params, combinar filtros con AND y mantener el catálogo anónimo y las condiciones de disponibilidad actuales.
- Pruebas de integración y actualización de Swagger/OpenAPI para el contrato aprobado.

**Excluido:**

- Mensajes visuales de estado vacío, interacción de controles, presentación y restablecimiento de filtros en la interfaz; el Backend solo responde con el catálogo filtrado o `[]`.
- Cambios al proceso de solicitud de adopción, identidad de fundaciones, publicación o administración de estados.
- Otros filtros no mencionados (sexo, raza, distancia geográfica o búsqueda por texto).
- Migraciones de esquema no requeridas por los campos actuales.
- Frontend, UX/UI y Design.

**Estimación total de la HU:** 8 puntos sugeridos (escala Fibonacci modificada). Desglose sugerido: UX 0, Diseño 0, Frontend 0, Backend 8. No incluye trabajo visual, de acuerdo con el alcance Backend de la plantilla.
