## HU-025 – Búsqueda por palabra clave

**Como:** tutor.

**Quiero:** buscar por palabra clave en los apartados de búsqueda de la aplicación.

**Para:** encontrar aliados, profesionales, productos y servicios por su nombre desde las búsquedas disponibles en Veto.

### 2. Criterios de aceptación

#### Coincidencia de nombres

- El Backend busca únicamente por el campo nombre de cada recurso incluido.
- La coincidencia es parcial: el término puede aparecer dentro del nombre completo, no solo coincidir con él desde el inicio. Por ejemplo, “CLINICA” encuentra “Clínica Norte”.
- La comparación ignora diferencias de mayúsculas/minúsculas y de acentos. Por ejemplo, la consulta “CLINICA” encuentra “Clínica Norte”, y “NORTE” también encuentra “Clínica Norte”.
- La normalización de espacios recorta espacios al principio y al final y sustituye cada secuencia de espacios en blanco por un espacio. Se aplica a la consulta y al nombre comparado, sin modificar el valor almacenado. Por ejemplo, “ Clínica Norte ” coincide con “Clínica Norte”.

#### Áreas y recursos cubiertos

- La búsqueda general consulta nombres de clínicas, aliados veterinarios independientes, tiendas, perfiles de veterinarios, productos y servicios.
- Adopción queda excluida. Las publicaciones de adopción y la identidad de sus fundaciones conservan su tratamiento anónimo; no se incorporan a los resultados de HU-025.
- Una búsqueda válida sin coincidencias responde 200 con el campo resultadosPorCategoria como lista vacía.
- La respuesta identifica la categoría del resultado para distinguir recursos heterogéneos y expone únicamente los datos mínimos necesarios para reconocerlo.

#### Acceso y validación

- El endpoint requiere una sesión válida con rol TUTOR, acorde con el actor de la HU.
- El parámetro de búsqueda es obligatorio. Un valor ausente, vacío o que solo contenga espacios responde 400 con el formato compartido de validación.
- Sin sesión se responde 401; con sesión de otro rol, 403.
- La búsqueda de HU-024 permanece disponible con su contrato vigente; HU-025 agrega una operación general y no cambia silenciosamente la semántica anterior.

### 3. Endpoints propuestos

**Buscar recursos por nombre normalizado**

**GET /api/busqueda?nombre={texto}**

Estado: Nuevo endpoint propuesto para la búsqueda general de HU-025.

Acceso: Sesión autenticada con rol TUTOR. Reutilizar AuthGuard y RolesGuard.

Parámetros: Query requerido nombre (string). El texto se busca como palabra clave dentro del nombre y se normaliza según los criterios de aceptación.

Cuerpo: Ninguno.

Validaciones: Rechazar el parámetro ausente, vacío o compuesto solo por espacios. La coincidencia es parcial, insensible a mayúsculas y acentos, y normaliza secuencias de espacios. La consulta debe usar parámetros SQL.

**Respuesta exitosa propuesta:**

    {
      "resultadosPorCategoria": [
        {
          "categoria": "CLINICA",
          "resultados": [{ "id": "uuid", "nombre": "Clínica Norte" }]
        },
        {
          "categoria": "PRODUCTO",
          "resultados": [{ "id": "uuid", "nombre": "Croquetas" }]
        }
      ]
    }

La respuesta agrupa los resultados por categoría. Las categorías propuestas son CLINICA, VET_INDEPENDIENTE, TIENDA, VETERINARIO, PRODUCTO y SERVICIO. Se incluyen los grupos con coincidencias y cada grupo devuelve como máximo 10 registros; una categoría no consume el límite de otra.

Límite: 10 resultados por categoría, sin paginación dentro de este alcance. El orden dentro de cada categoría debe ser estable. Si un grupo tiene más de 10 coincidencias, se devuelven las primeras 10 según ese orden.

**Errores esperados:** 400 por query inválido; 401 sin sesión; 403 para rol distinto de TUTOR; 500 ante fallo interno de persistencia.

**Buscar aliados por nombre (HU-024):**

**GET /api/aliados/busqueda/nombre?nombre={texto}**

Estado: Existente; se conserva para no alterar el contrato de HU-024.

Acceso: Sesión con rol TUTOR.

Parámetros: Query requerido nombre.

Comportamiento actual: Coincidencia exacta sensible a mayúsculas y acentos; busca aliados activos CLINICA, VET_INDEPENDIENTE y TIENDA, devuelve hasta 10 objetos {id,nombre,tipo} y no devuelve fundaciones.

No se modifica en HU-025. El Frontend consume la operación general desde Inicio y los formularios de búsqueda que llevan a /buscar; el endpoint legado permanece disponible para conservar su contrato.

### 4. Errores HTTP esperados

| Código | Situación                                                                  |
| ------ | -------------------------------------------------------------------------- |
| 400    | Falta nombre, está vacío o contiene solo espacios.                         |
| 401    | No hay sesión válida para ejecutar la búsqueda de tutor.                   |
| 403    | La sesión pertenece a un rol distinto de TUTOR.                            |
| 500    | Error inesperado al consultar la base de datos u otra dependencia interna. |

La API usa para validación { "message": "Revisa los datos ingresados", "errores": { "campo": "mensaje" } }. Los errores de autenticación/autorización siguen el formato NestJS existente.

### 5. Definition of Done (DoD)

- [ ] Existe la operación general de búsqueda para HU-025, protegida para tutores y documentada en Swagger.
- [ ] Se consultan por nombre clínicas, aliados veterinarios independientes, tiendas, perfiles de veterinarios, productos y servicios; se excluye adopción.
- [ ] La comparación parcial ignora mayúsculas y acentos.
- [ ] La consulta y los nombres comparados recortan extremos y colapsan secuencias de espacios en blanco; no se modifican datos almacenados.
- [ ] La respuesta agrupa por categoría, con un máximo de 10 resultados por grupo, sin exponer información ajena al reconocimiento del resultado.
- [ ] Cada categoría devuelve hasta 10 resultados, agrupados y ordenados de forma estable; el límite de una categoría no elimina resultados de otra.
- [ ] Las consultas inválidas responden 400, las sesiones ausentes 401, los roles distintos de tutor 403 y las búsquedas sin coincidencias 200 con lista vacía.
- [ ] El SQL se ejecuta con parámetros; pruebas cubren categorías incluidas/excluidas, sensibilidad de mayúsculas y acentos, normalización de espacios, coincidencia parcial, límites por categoría, ausencia de resultados y autorización.
- [ ] La búsqueda existente de HU-024 conserva ruta, respuesta y semántica exacta sensible a mayúsculas y acentos.
- [ ] No se agregan tablas ni campos duplicados; cualquier migración para habilitar normalización de acentos se justifica y prueba explícitamente.

### 6. Consideraciones técnicas

#### Funcionalidad existente

- apps/api/src/modules/aliados/busqueda-aliados.controller.ts implementa GET /api/aliados/busqueda/nombre con AuthGuard, RolesGuard y rol TUTOR. Valida la query mediante buscarAliadosSchema y documenta coincidencia exacta.
- apps/api/src/modules/aliados/aliados.service.ts, método buscarPorNombre, consulta aliado con SQL parametrizado, filtra estado ACTIVO y tipos CLINICA, VET_INDEPENDIENTE y TIENDA, compara por igualdad con COLLATE "C" y limita a BUSQUEDA_ALIADOS_MAX_RESULTADOS (10).
- packages/shared/src/aliado.ts define el esquema de búsqueda existente y el límite 10.
- apps/api/test/hu024-busqueda-aliados.spec.ts cubre la ruta existente, validación, autorización, filtros, límite y parametrización. Se conserva y se agrega cobertura para la nueva búsqueda; no se duplica la suite de HU-024.
- db/migrations/0001_baseline.sql define aliado.nombre, producto.nombre y servicio.nombre, además de los tipos y estados necesarios para filtrar los catálogos.
- apps/api/src/modules/comercio/productos.repository.ts lista productos publicados de tiendas activas y expone su nombre.
- apps/api/src/modules/servicios/servicios.repository.ts lista servicios disponibles de aliados activos y expone el nombre del servicio.
- apps/api/src/modules/aliados/veterinarios.service.ts ya obtiene los nombres de perfiles de veterinario desde usuario.nombre al consultar fichas públicas de clínicas. La búsqueda general debe filtrar perfiles activos y cuentas activas, y conservar la relación con el aliado.
- GET /api/aliados/clinicas, GET /api/productos, GET /api/servicios y GET /api/adopciones/catalogo son catálogos existentes. No aceptan una query común de búsqueda por nombre. Adopción permanece fuera de la nueva operación.
- La tabla aliado también contiene fundaciones; estas no deben incluirse en resultados de esta HU. El catálogo de adopción las mantiene anónimas.
- frontend/web/src/app/page.tsx, frontend/web/src/components/SiteChrome.tsx y páginas de catálogo envían búsquedas a /buscar. frontend/web/src/app/buscar/BuscarResultados.tsx consume GET /api/busqueda?nombre=..., aplica un debounce de 300 ms y presenta resultados agrupados y estados de carga, error, sesión requerida y lista vacía.

#### Propuesta de implementación Backend

- Crear un controlador/operación de búsqueda general en un módulo apropiado y un esquema compartido para validar nombre. Reutilizar AuthGuard, RolesGuard, DatabaseService y convenciones de errores.
- Consultar únicamente los campos nombre de aliados permitidos, perfiles activos de veterinarios, productos publicados de tiendas activas y servicios disponibles de aliados activos. No consultar descripciones, categorías ni otros campos textuales.
- No reutilizar la respuesta simple de HU-024 para recursos heterogéneos: conservar ese endpoint y responder desde la operación nueva con id, nombre y un discriminador categoria. El catálogo fuente de cada dominio se reutiliza conceptualmente, pero sus operaciones actuales devuelven listas completas y no deben ejecutarse para luego filtrar en memoria.
- Aplicar la normalización de comparación sobre consulta y columna, sin actualizar las filas. Mantener SQL parametrizado y definir el orden de resultados de forma estable antes de aplicar el máximo de 10.
- El endpoint actual de HU-024 usa comparación sensible a mayúsculas y acentos. No se cambia. La nueva operación satisface la regla distinta de HU-025 sin romper ese contrato.
- La insensibilidad a acentos requiere una estrategia compatible con PostgreSQL. No se encontró una habilitación de unaccent en las migraciones consultadas; si la implementación elige esa extensión, deberá añadirse una migración nueva y probarse en CI. No editar migraciones existentes. Una estrategia alternativa debe producir resultados equivalentes y ser medible.
- No se requiere una nueva entidad de negocio. Una migración solo corresponde si la estrategia técnica de normalización la necesita; no crear una columna duplicada para guardar el nombre normalizado.
- La preparación se limita al Backend: no modificar formularios existentes, páginas, responsive, estados visuales ni navegación.

#### Definiciones confirmadas y propuesta fijada

- Coincidencia: búsqueda parcial dentro del nombre normalizado; un término como “CLINICA” encuentra “Clínica Norte”.
- Mayúsculas y acentos: comparación insensible a ambos.
- Espacios: recortar extremos y colapsar secuencias de espacios en blanco a un espacio para la comparación.
- Campos: solo el campo nombre de cada recurso, por defecto y de forma exclusiva en esta versión.
- Cobertura: aliados (clínicas, veterinarios independientes y tiendas), perfiles veterinarios, productos y servicios; adopción excluida.
- Contrato: operación nueva general, con respuesta agrupada por categoria y elementos id/nombre; se conserva sin cambios el endpoint de HU-024.
- Límite: máximo de 10 resultados por categoría, sin paginación; una categoría no consume el límite de otra.
- Épica y etiquetas: no se deducen del repositorio; se eligen al registrar la historia/tareas en Taiga. No bloquean la implementación técnica.

### 7. Alcance

**Incluido – Backend:**

- Nueva operación de búsqueda general por nombre para tutores.
- Búsqueda en aliados permitidos, perfiles de veterinarios activos, productos publicados y servicios disponibles.
- Búsqueda parcial insensible a mayúsculas y acentos, con normalización de espacios.
- Validación, autorización, respuesta tipada, límite estable, errores, pruebas y documentación Swagger.

**Excluido:**

- Adopción y datos que puedan identificar fundaciones asociadas a sus publicaciones.
- Campos distintos de nombre, como descripción, contacto, categoría, especialidad o ubicación.
- Integración con formularios/páginas, interfaz, mensajes visibles, estados de carga/vacío/error, responsive, UX/UI o Design.
- Cambios al contrato existente de búsqueda HU-024.
- Modificaciones del modelo que no sean indispensables para la estrategia aprobada de normalización.
