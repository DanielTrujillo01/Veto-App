# HU-025 – Tareas de implementación para Taiga

**Historia relacionada:** HU-025 – Búsqueda por palabra clave.

**Área:** Backend.

**Documento de especificación:** HU-025-busqueda-por-palabra-clave.md.

**Objetivo:** proporcionar una búsqueda general por nombre para los apartados de aliados, veterinarios, productos y servicios, conservando intacta la búsqueda de HU-024 y excluyendo adopción.

**Épica:** Seleccionar en Taiga según el backlog del producto; no se encontró asignación en el repositorio.

**Etiquetas:** Seleccionar las etiquetas existentes en Taiga para búsqueda y Backend; no se encontró catálogo local.

**Prioridad:** No indicada por la HU; asignar según planificación del producto.

**Estimación total sugerida:** 13 puntos Backend, escala Fibonacci modificada. La estimación considera la consulta de varios dominios y puede revisarse si cambia el contrato.

**Tarea 1: Implementar endpoint general de búsqueda parcial por nombre**

**Descripción:**

Crear una operación para tutores que busque nombres en clínicas, aliados veterinarios independientes, tiendas, perfiles de veterinarios, productos y servicios. La coincidencia parcial debe ignorar mayúsculas y acentos, y normalizar espacios recortando extremos y colapsando secuencias internas. Debe excluir adopción y mantener intacto el endpoint de HU-024.

**Alcance:**

Agregar la validación compartida, controlador/servicio/repositorio necesarios y consultas SQL parametrizadas. Aplicar los filtros de disponibilidad/actividad reales de cada dominio, agrupar resultados por categoría, proyectar id y nombre y limitar cada categoría a 10 resultados ordenados de manera estable. Habilitar la estrategia de comparación sin modificar datos almacenados. No implementar cliente web.

**Componentes involucrados:**

- Nuevo controlador/operación propuesta en apps/api/src/modules/ para búsqueda general.
- Nuevo esquema/tipo en packages/shared/src/ para el parámetro y el resultado categorizado.
- apps/api/src/modules/aliados/aliados.service.ts y búsqueda existente como referencia; no alterar su contrato.
- apps/api/src/modules/aliados/veterinarios.service.ts y datos de usuario/perfil veterinario.
- apps/api/src/modules/comercio/productos.repository.ts y ProductosRepository como referencia de disponibilidad.
- apps/api/src/modules/servicios/servicios.repository.ts y reglas de disponibilidad.
- Tablas existentes aliado, usuario, veterinario, producto y servicio.
- Migración nueva solo si la estrategia elegida requiere habilitar una extensión PostgreSQL; no está creada actualmente.

**Resultado esperado:**

Una operación GET general, protegida para TUTOR, devuelve resultados agrupados por categoría con coincidencia parcial insensible a mayúsculas/acentos, con espacios normalizados y sin resultados de adopción.

**Criterios de verificación:**

- Acepta solo nombre no vacío y responde 400 para consulta ausente o compuesta solo por espacios.
- Requiere sesión TUTOR; responde 401 y 403 en los escenarios correspondientes.
- Las variantes de mayúsculas, acentos y espacios definidas en la especificación coinciden; un fragmento del nombre completo sí coincide.
- Incluye solo registros activos/publicables de las categorías acordadas y excluye fundaciones/adopción.
- Responde 200 con lista vacía cuando no hay coincidencias y con máximo 10 resultados por categoría, agrupados y ordenados de manera estable cuando las hay.
- Las consultas son parametrizadas y no alteran el contrato de GET /api/aliados/busqueda/nombre.
- No modifica ni duplica datos de nombre.

**Dependencias:**

Ninguna decisión funcional pendiente. Si se usa la extensión PostgreSQL unaccent, la migración requerida debe formar parte de esta tarea y aplicarse antes de la validación en CI.

**Estimación:**

- Puntos de historia: 8.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 8.

**Tarea 2: Cubrir búsqueda global y normalización con pruebas**

**Descripción:**

Agregar pruebas para la nueva operación que demuestren coincidencia parcial con insensibilidad a mayúsculas/acentos, normalización de espacios, categorías consultadas, filtros de disponibilidad, exclusión de adopción, límite y errores de acceso/validación.

**Alcance:**

Reutilizar patrones de prueba de la API y la cobertura existente de HU-024 sin editar su comportamiento esperado. Añadir pruebas PostgreSQL si el mecanismo de normalización o la extensión no pueden validarse correctamente con el mock de DatabaseService.

**Componentes involucrados:**

- Nuevo spec bajo apps/api/test/ para búsqueda general.
- apps/api/test/hu024-busqueda-aliados.spec.ts como regresión del contrato existente.
- Migración de normalización solo si se agrega en la Tarea 1.

**Resultado esperado:**

La búsqueda general y la búsqueda anterior de HU-024 tienen pruebas independientes que verifican sus respectivos contratos.

**Criterios de verificación:**

- Se prueban nombres de aliado, perfil veterinario, producto y servicio.
- Se prueba que adopción/fundaciones no aparecen.
- Se prueban mayúsculas, acentos, espacios externos e internos, coincidencia de fragmento dentro del nombre.
- Se cubren 200 con resultados, 200 lista vacía, 400, 401 y 403.
- Se verifica límite 10, orden estable y parametrización SQL.
- Los casos de HU-024 continúan probando su sensibilidad previa a mayúsculas/acentos y su límite 10.

**Dependencias:**

Tarea 1.

**Estimación:**

- Puntos de historia: 3.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 3.

**Tarea 3: Documentar el endpoint global y su contrato**

**Descripción:**

Documentar en Swagger/OpenAPI el endpoint nuevo y actualizar el inventario técnico de API con sus categorías, normalización, acceso, límite y errores.

**Alcance:**

Actualizar la documentación técnica durante la implementación, manteniendo separada la entrada existente de HU-024. No actualizar otros contratos no relacionados.

**Componentes involucrados:**

- Nuevo controlador de búsqueda general en apps/api/src/modules/.
- docs/prompts/context/api-backend.md.
- Esquema/tipo de respuesta compartido de la Tarea 1.

**Resultado esperado:**

Swagger y el inventario de API describen fielmente la operación general implementada y mantienen documentado por separado el contrato HU-024.

**Criterios de verificación:**

- Ruta, parámetro, rol, categorías, normalización, límite, respuesta y errores coinciden con código y pruebas.
- Se documenta que adopción queda excluida.
- No se presenta como modificado el endpoint de HU-024.

**Dependencias:**

Tarea 1; verificar contra las pruebas de la Tarea 2 antes de cerrar la documentación.

**Estimación:**

- Puntos de historia: 2.
- UX: 0 (fuera de alcance).
- Diseño: 0 (fuera de alcance).
- Frontend: 0 (fuera de alcance).
- Backend: 2.

**Cobertura:** La Tarea 1 implementa búsqueda y autorización; la Tarea 2 verifica el contrato y protege la compatibilidad con HU-024; la Tarea 3 mantiene la documentación técnica alineada. Épica, etiquetas y prioridad se seleccionan al registrar el trabajo en Taiga.
