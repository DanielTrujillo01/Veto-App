## HU-045 – Filtrar y buscar productos por categoría

**Como:** tutor.

**Quiero:** filtrar productos por categoría y buscarlos por texto manteniendo activo el filtro seleccionado.

**Para:** encontrar los productos disponibles que correspondan a la categoría y al texto de búsqueda.

### 2. Criterios de aceptación

#### Catálogo de categorías

- El Backend expone las categorías desde el catálogo persistido categoria_producto con su identificador y nombre.
- Los identificadores que utiliza el filtro corresponden a categoria_producto.id; no se codifican equivalencias entre etiquetas visuales y categorías si no están definidas.

#### Búsqueda y filtro combinados

- El catálogo de productos acepta opcionalmente una categoría y un texto de búsqueda.
- Cuando se proporcionan ambos filtros, un producto solo aparece si cumple ambos: pertenece a la categoría solicitada y su nombre coincide con el texto.
- El texto se busca solo en producto.nombre. Se reutiliza el comportamiento acordado para HU-025: coincidencia parcial, insensible a mayúsculas y acentos, con extremos recortados y secuencias de espacios normalizadas.
- Si no se envía categoría, se conservan los resultados de todas las categorías. Si no se envía texto, se listan los productos conforme a los demás filtros y al orden existente.
- Un texto vacío después de normalizar se trata como filtro ausente; permite explorar solo por categoría.

#### Disponibilidad y respuesta

- Se conservan los filtros del catálogo actual: producto.activo, moderación PUBLICADO y aliado.estado ACTIVO.
- La respuesta conserva el contrato ProductoCatalogo existente, incluidos nombre, categoría, precio, stock, descripción, aliado y fotos publicadas.
- No se agrega un filtro de stock mayor que cero: la HU habla de productos activos y el catálogo actual no excluye productos con stock cero.
- Una combinación válida sin coincidencias responde 200 con una lista vacía.
- El parámetro orden existente sigue funcionando junto con categoría y texto.

### 3. Endpoints propuestos

**Listar categorías de producto**

**GET /api/productos/categorias**

Estado: Nuevo endpoint propuesto. No existe actualmente una ruta HTTP para listar categoria_producto.

Acceso: Público, coherente con GET /api/productos.

Parámetros: Ninguno.

Cuerpo: Ninguno.

Validaciones: Ninguna entrada. Leer las categorías existentes y devolverlas ordenadas de manera estable por id.

**Respuesta exitosa propuesta:**

    [
      { "id": 1, "nombre": "Alimentos" },
      { "id": 2, "nombre": "Accesorios" },
      { "id": 3, "nombre": "Higiene" }
    ]

Los nombres son los valores semilla actuales de 0001_baseline.sql, no un catálogo exhaustivo confirmado por Producto.

**Errores esperados:** 500 ante un fallo interno al consultar la base de datos.

**Listar productos disponibles con filtros opcionales**

**GET /api/productos?categoriaId={id}&nombre={texto}&orden={orden}**

Estado: Modificación propuesta del endpoint existente GET /api/productos.

Acceso: Público, como el endpoint actual.

Parámetros:

- categoriaId: smallint positivo opcional, identificador de categoria_producto.
- nombre: string opcional; palabra clave que se aplica al nombre del producto.
- orden: opcional, valores existentes nombre, precio_asc o precio_desc; por defecto nombre.

Cuerpo: Ninguno.

Validaciones: Reutilizar ordenProductosSchema y ampliarlo con categoriaId y nombre. Rechazar categoriaId que no sea entero positivo y orden fuera de la lista admitida. Normalizar nombre conforme a HU-025; si queda vacío se omite el filtro. Los predicados de categoría y nombre se combinan con AND y se parametrizan.

**Respuesta exitosa propuesta:**

    [
      {
        "id": "uuid",
        "aliadoId": "uuid",
        "aliado": "Tienda Ejemplo",
        "categoriaId": 1,
        "categoria": "Alimentos",
        "nombre": "Croquetas para perro",
        "descripcion": "Alimento completo",
        "precio": 45000,
        "stock": 12,
        "fotos": ["https://ejemplo.test/producto.jpg"],
        "creadoEn": "2026-11-16T12:00:00.000Z"
      }
    ]

La forma es el contrato existente ProductoCatalogo; no se propone un DTO duplicado. Categoría desconocida o filtros sin coincidencias devuelven 200 con [].

**Errores esperados:** 400 si categoriaId u orden son inválidos; 500 ante fallo interno de persistencia.

### 4. Errores HTTP esperados

| Código | Situación                                                                           |
| ------ | ----------------------------------------------------------------------------------- |
| 400    | categoriaId no es un entero positivo u orden no pertenece a los valores permitidos. |
| 500    | Error inesperado al consultar categorías, productos o fotos publicadas.             |

El catálogo es público: no corresponden 401 ni 403. Una categoría válida que no exista o no tenga productos publicables produce 200 con una lista vacía; esta operación de lista no consulta un recurso individual y no requiere 404.

### 5. Definition of Done (DoD)

- [ ] Existe una consulta pública de categorías basada en categoria_producto, sin duplicar datos ni enumeraciones en el servidor.
- [ ] GET /api/productos acepta categoriaId y nombre opcionales junto con el orden ya existente.
- [ ] Los filtros de categoría y texto se combinan con AND y buscan producto.nombre con la semántica parcial e insensible a mayúsculas/acentos acordada para HU-025.
- [ ] El texto recorta extremos y normaliza espacios repetidos; un texto vacío se trata como filtro omitido.
- [ ] Se conservan los filtros existentes de producto activo, moderación PUBLICADO y tienda ACTIVO, además del contrato ProductoCatalogo y fotos publicadas.
- [ ] No se excluyen productos por stock cero, salvo nueva regla aprobada.
- [ ] Una búsqueda sin coincidencias responde 200 con []; parámetros inválidos responden 400.
- [ ] Las pruebas cubren categorías, filtro solo por categoría, solo por texto, filtros combinados, orden, producto inactivo/no publicado, tienda inactiva y lista vacía.
- [ ] Swagger/OpenAPI documenta ambas operaciones, parámetros y respuestas.
- [ ] No se agrega migración ni índice sin necesidad demostrada; se conserva el índice trigram existente sobre producto.nombre.

### 6. Consideraciones técnicas

#### Funcionalidad existente y reutilización

- apps/api/src/modules/comercio/productos.controller.ts expone GET /api/productos como ruta pública. Valida únicamente orden mediante ordenProductosSchema.
- apps/api/src/modules/comercio/productos.service.ts delega listarDisponibles a ProductosRepository.
- apps/api/src/modules/comercio/productos.repository.ts filtra p.activo, p.moderacion = PUBLICADO y a.estado = ACTIVO. Une producto con aliado y categoria_producto, devuelve ProductoCatalogo y carga únicamente fotos con moderación PUBLICADO.
- packages/shared/src/producto.ts define ProductoCatalogo y ordenProductosSchema. No contiene actualmente schema de categoría, búsqueda de texto ni filtros de categoría.
- db/migrations/0001_baseline.sql define categoria_producto(id smallint identity, nombre unique) y producto.categoria_id como FK requerida. No se requieren columnas nuevas.
- La migración ya crea pg_trgm y un índice GIN trigram sobre producto.nombre, además de un índice sobre producto.categoria_id para productos activos. No hace falta duplicar índices sin medir el plan real.
- No se encontraron pruebas API específicas del catálogo de productos. db/tests/veto_pruebas.sql valida reglas de stock/pedidos, no filtros de catálogo.

#### Diferencias del catálogo que deben respetarse

- Los valores semilla de categoria_producto son Alimentos, Accesorios e Higiene; docs/modelo-de-datos.md los describe como ejemplos, no como catálogo definitivo.
- frontend/web/src/app/tienda/page.tsx presenta categorías estáticas distintas: Alimento, Juguetes, Camas y hogar, Cuidado e higiene. Esas etiquetas no tienen una correspondencia confirmada con los IDs de categoria_producto. La API debe exponer los IDs y nombres persistidos; no debe inventarse un mapeo.
- No existe actualmente GET /api/productos/categorias ni una query de categoría/texto en GET /api/productos.
- El catálogo actual devuelve todos los productos coincidentes y no define paginación. HU-045 tampoco fija límite ni paginación; esta propuesta conserva el comportamiento sin límite del endpoint, no introduce un máximo.

#### Integración y dependencia con HU-025

- HU-025 define la búsqueda parcial por nombre, sin sensibilidad a mayúsculas/acentos y con normalización de espacios; su endpoint general está propuesto en documentación y aún no está implementado.
- HU-045 reutiliza esas reglas para producto.nombre y el mecanismo común que se implemente, sin crear una segunda semántica de búsqueda.
- El agrupamiento de HU-025 por tipo de recurso (PRODUCTO, SERVICIO, etc.) no equivale a categoria_producto. HU-045 filtra por el ID de categoría comercial del producto y conserva ProductoCatalogo.
- No hay dependencia de ejecución obligatoria con HU-025: el filtro del catálogo puede implementarse en ComercioModule; ambos trabajos deben compartir la misma regla/función de comparación. Si HU-025 se implementa primero, HU-045 reutiliza el mecanismo de nombre; si HU-045 se implementa primero, su consulta de productos debe quedar reutilizable por HU-025.
- HU-045 pertenece al rango de comercio HU-044–050 del módulo E11 (referencia en la sección de productos de db/migrations/0001_baseline.sql).

#### Fuera del Backend de esta especificación

- La HU pide que el buscador y el filtro se usen tanto en Inicio como en la sección de productos. La aplicación web actual envía búsquedas a /buscar y las categorías estáticas de tienda no consumen estos endpoints. La integración en ambas pantallas y sus estados visuales son trabajo Frontend y no forman parte de la especificación Backend exigida por HU.md.
- El mensaje visible de “sin resultados” pertenece al Frontend; el Backend aporta el estado verificable mediante 200 con [].

### 7. Alcance

**Incluido – Backend:**

- Extender GET /api/productos con filtros opcionales de categoría y texto, conservando orden y contrato de respuesta.
- Exponer la lista de categorías existentes desde categoria_producto.
- Aplicar filtros combinados por categoría y producto.nombre junto con las reglas actuales de publicación y tienda activa.
- Reutilizar semántica de búsqueda de HU-025, consultas parametrizadas y tipos compartidos.
- Añadir pruebas y documentación OpenAPI de las operaciones.

**Excluido:**

- Conectar o cambiar los formularios de Inicio y tienda.
- Definir diseño, navegación, estado de carga, mensaje visual de lista vacía, responsive o accesibilidad.
- Crear/migrar categorías comerciales, traducir las etiquetas estáticas de tienda o definir correspondencias no aprobadas.
- Cambiar stock, moderación, publicación, compra, pedidos o inventario.
- Cambios de esquema no necesarios para los filtros.
