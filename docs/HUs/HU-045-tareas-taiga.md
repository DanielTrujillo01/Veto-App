# HU-045 – Tareas de implementación para Taiga

**Historia relacionada:** HU-045 – Filtrar y buscar productos por categoría.

**Área:** Backend.

**Documento de especificación:** HU-045-filtrar-y-buscar-productos.md.

**Objetivo:** permitir listar categorías y combinar categoría y texto en el catálogo existente de productos, conservando sus reglas de disponibilidad.

**Épica:** E11 – Comercio (rango HU-044–050 indicado en db/migrations/0001_baseline.sql).

**Etiquetas sugeridas:** Backend, Comercio, Catálogo, Búsqueda, Filtros. Verificar los nombres existentes en Taiga antes de asignarlas.

**Prioridad:** No indicada por la HU; asignar según planificación del producto.

**Estimación total sugerida:** 11 puntos Backend, escala Fibonacci modificada definida en la plantilla.

**Tarea 1: Exponer las categorías persistidas de productos**

**Descripción:**

Agregar una operación pública que liste id y nombre desde categoria_producto para que los filtros usen los identificadores canónicos de base de datos.

**Alcance:**

Crear GET /api/productos/categorias, ordenar resultados de forma estable y documentar la respuesta. No crear categorías ni mapear las etiquetas estáticas actuales de Frontend.

**Componentes involucrados:**

- Nuevo handler en apps/api/src/modules/comercio/productos.controller.ts.
- Lectura en ProductosService/ProductosRepository o repositorio de catálogo existente.
- Tabla categoria_producto de db/migrations/0001_baseline.sql.
- packages/shared/src/producto.ts para el tipo de categoría si corresponde.

**Resultado esperado:**

La API devuelve las categorías persistidas con id y nombre; los clientes no necesitan inventar IDs.

**Criterios de verificación:**

- La ruta es pública y responde 200 con una lista id/nombre.
- Las filas provienen de categoria_producto y se ordenan de forma estable.
- Una tabla vacía produce 200 con [].
- No se modifica el esquema ni se añaden categorías semilla.

**Dependencias:**

Ninguna. Puede desarrollarse en paralelo con la Tarea 2.

**Estimación:**

- Puntos de historia: 2.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 2.

**Tarea 2: Combinar categoría y texto en el catálogo de productos**

**Descripción:**

Ampliar GET /api/productos con filtros opcionales categoriaId y nombre. Aplicarlos conjuntamente al catálogo de productos, reutilizando ProductoCatalogo, ordenProductosSchema y las reglas de búsqueda por nombre acordadas en HU-025.

**Alcance:**

Actualizar esquema compartido, controlador, servicio y ProductosRepository. Aplicar categoría y texto con AND; mantener el orden opcional existente, SQL parametrizado, filtros de producto activo/publicado y tienda activa, fotos publicadas y el resultado completo del contrato actual. No agregar máximo ni paginación que HU-045 no establece.

**Componentes involucrados:**

- apps/api/src/modules/comercio/productos.controller.ts
- apps/api/src/modules/comercio/productos.service.ts
- apps/api/src/modules/comercio/productos.repository.ts
- packages/shared/src/producto.ts
- Tabla producto, FK categoria_id y tabla categoria_producto.
- Índices existentes de producto.categoria_id y GIN trigram de producto.nombre.

**Resultado esperado:**

GET /api/productos lista el catálogo actual cuando no hay filtros y aplica filtro por categoría, texto o ambos cuando se envían; una combinación sin coincidencias devuelve [].

**Criterios de verificación:**

- categoriaId acepta solo enteros positivos.
- nombre aplica coincidencia parcial sobre el nombre del producto, insensible a mayúsculas/acentos y con espacios normalizados según HU-025.
- Los dos filtros se combinan con AND.
- orden sigue aceptando nombre, precio_asc y precio_desc.
- Se conservan filtros de producto activo, moderación PUBLICADO y tienda ACTIVO y los campos actuales ProductoCatalogo.
- El stock cero no se excluye por esta HU.
- La consulta usa parámetros y una categoría desconocida válida devuelve [].

**Dependencias:**

Alinear con la regla compartida de HU-025. No hay dependencia de ejecución estricta: reutilizar su mecanismo de búsqueda si ya existe; de lo contrario, mantener la lógica de producto reutilizable para HU-025.

**Estimación:**

- Puntos de historia: 5.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 5.

**Tarea 3: Probar filtros de categoría y búsqueda de productos**

**Descripción:**

Crear cobertura para la lista de categorías y ampliar el comportamiento del catálogo con escenarios de filtro aislado y combinado, disponibilidad, orden y resultados vacíos.

**Alcance:**

Agregar pruebas de API para las operaciones propuestas. Las pruebas DB se justifican si la comparación parcial/acento-insensible o los índices requieren validación contra PostgreSQL. No duplicar las pruebas generales de búsqueda HU-025.

**Componentes involucrados:**

- Nuevo spec bajo apps/api/test/ para HU-045.
- Controlador, esquema, ProductosService y ProductosRepository.
- PostgreSQL/migraciones vigentes para pruebas que validen la consulta real.

**Resultado esperado:**

La API verifica el contrato de categoría y producto, incluyendo filtros combinados y exclusión de productos no publicables.

**Criterios de verificación:**

- Casos para categorías existentes y lista vacía.
- Productos coincidentes por categoría, texto y ambos filtros a la vez.
- Casos para producto inactivo, moderación distinta de PUBLICADO y tienda no activa.
- Búsqueda sin coincidencias y texto vacío según el comportamiento aprobado.
- Orden opcional, categoriaId inválido y SQL parametrizado.
- Se valida que el límite de registros no cambia respecto al catálogo actual.

**Dependencias:**

Tareas 1 y 2.

**Estimación:**

- Puntos de historia: 3.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 3.

**Tarea 4: Documentar filtros y categorías en Swagger y el inventario API**

**Descripción:**

Actualizar Swagger/OpenAPI para GET /api/productos y documentar GET /api/productos/categorias con sus parámetros, reglas, respuestas y errores.

**Alcance:**

Modificar únicamente documentación de las operaciones en implementación; no actualizar inventarios generales durante esta preparación de HU.

**Componentes involucrados:**

- apps/api/src/modules/comercio/productos.controller.ts
- docs/prompts/context/api-backend.md

**Resultado esperado:**

Swagger describe el contrato final y permite verificar la operación pública de categorías y los filtros combinables del catálogo.

**Criterios de verificación:**

- Se documentan categoriaId, nombre, orden, respuesta sin coincidencias y errores 400/500.
- Se explica que GET /api/productos conserva ProductoCatalogo y las reglas de publicación vigentes.
- La documentación coincide con pruebas e implementación.

**Dependencias:**

Tareas 1 y 2; validar después de la Tarea 3.

**Estimación:**

- Puntos de historia: 1.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 1.

**Cobertura:** La Tarea 1 entrega IDs de categoría canónicos; la Tarea 2 aplica los filtros sin duplicar el catálogo; la Tarea 3 verifica reglas y combinación; la Tarea 4 mantiene el contrato publicado alineado. La integración visual en Inicio y tienda queda fuera del área Backend de esta plantilla.
