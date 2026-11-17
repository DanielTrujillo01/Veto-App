HU-024 – Inicio con búsqueda por aliado y accesos a catálogos

Como: tutor.

Quiero: acceder desde el inicio a clínicas veterinarias, veterinarios independientes, tiendas y adopción, y buscar aliados por nombre.

Para: encontrar la sección o aliado que necesito desde un punto de entrada común.

La historia unifica el acceso desde el inicio de HU-024 con el acceso a Adopción de HU-086, conforme a la definición funcional recibida. La entrada a las secciones es principalmente comportamiento de Frontend y queda fuera de las tareas de Backend de este documento. En el Backend, la diferencia identificada es un endpoint de búsqueda por nombre para aliados de tipo clínica, veterinario independiente y tienda.

2. Criterios de aceptación

Búsqueda de aliados

La API permite buscar aliados por nombre y devuelve para cada coincidencia al menos su identificador, nombre y tipo (CLINICA, VET_INDEPENDIENTE o TIENDA), necesarios para presentar y enlazar el resultado.

La búsqueda solo incluye aliados activos y excluye fundaciones. Una búsqueda sin coincidencias responde correctamente con una lista vacía, no con un error de recurso inexistente.

La entrada inválida se rechaza con 400 según el contrato común de validación del proyecto. La consulta se ejecuta con parámetros SQL y no permite que el texto de búsqueda altere la consulta.

La respuesta no expone datos de contacto ni información privada que no sea necesaria para identificar el aliado.

La búsqueda distingue mayúsculas y acentos, conforme a la definición de esta HU.

Reutilización de catálogos y anonimato de adopción

El Backend conserva los catálogos existentes: clínicas mediante GET /api/aliados/clinicas, productos mediante GET /api/productos y publicaciones disponibles de adopción mediante GET /api/adopciones/catalogo.

La búsqueda de aliados no busca ni devuelve fundaciones o resultados del catálogo de adopción. El catálogo de adopción conserva su respuesta anonimizada según la vista v_catalogo_adopcion.

Definiciones confirmadas

La coincidencia es exacta y sensible a mayúsculas y acentos.
La API devuelve como máximo 10 coincidencias; no requiere paginación.
El debounce de 300 ms corresponde al Frontend; el Backend procesa cada solicitud que recibe, sin añadir esa espera.

3. Endpoints propuestos

Consultar clínicas activas

GET /api/aliados/clinicas

Estado: Existente; se reutiliza sin modificación identificada.
Acceso: Público, según el controlador actual.
Parámetros: Ninguno.
Cuerpo: Ninguno.
Validaciones: Ninguna entrada. El servicio lista solo aliados activos de tipo CLINICA.

Respuesta exitosa:

[
{
"id": "uuid",
"nombre": "Clínica Ejemplo",
"descripcion": "Atención veterinaria"
}
]

Errores esperados: 500 ante un fallo inesperado de persistencia. No se identificó error de validación para esta operación.

Consultar productos disponibles

GET /api/productos

Estado: Existente; se reutiliza sin modificación identificada.
Acceso: Público.
Parámetros: Query opcional orden, valores admitidos actuales nombre, precio_asc o precio_desc.
Cuerpo: Ninguno.
Validaciones: orden se valida con ordenProductosSchema. La operación lista el catálogo completo; no es un buscador por nombre de aliado.

Respuesta exitosa: Lista de productos disponibles según el contrato ProductoCatalogo implementado. La forma exacta se mantiene como la define packages/shared/src/producto.ts y el repositorio, no se modifica en esta HU.

Errores esperados: 400 si orden no cumple el esquema; 500 ante un fallo inesperado.

Consultar catálogo público de adopción

GET /api/adopciones/catalogo

Estado: Existente; se reutiliza sin modificación identificada.
Acceso: Público.
Parámetros: Ninguno.
Cuerpo: Ninguno.
Validaciones: Ninguna entrada. Devuelve publicaciones disponibles de fundaciones activas sin campos que identifiquen a la fundación.

Respuesta exitosa: Lista MascotaAdopcionPublica[], con datos de la mascota y medios disponibles; no incluye identidad de la fundación.

Errores esperados: 500 ante un fallo inesperado. Una lista vacía es una respuesta válida.

Buscar aliados por nombre

GET /api/aliados/busqueda?nombre={texto}

Estado: Endpoint nuevo propuesto; no existe actualmente una búsqueda común por nombre. Se propone la ruta de dos segmentos para no colisionar con GET /api/aliados/:aliadoId.
Acceso: Sesión autenticada con rol TUTOR (AuthGuard y RolesGuard).
Parámetros: nombre requerido, texto.
Cuerpo: Ninguno.
Validaciones propuestas: Rechazar valor ausente o vacío después de recortar espacios con 400 y el formato común de validación. La búsqueda distingue mayúsculas y acentos. La coincidencia es exacta y se limita la respuesta a un máximo de 10 resultados, sin paginación. La consulta debe usar SQL parametrizado. Solo se consideran aliados ACTIVO de tipo CLINICA, VET_INDEPENDIENTE o TIENDA; se excluyen FUNDACION y los datos de contacto.

Respuesta exitosa propuesta (contrato ilustrativo, aún no implementado):

[
{
"id": "uuid",
"nombre": "Aliado Ejemplo",
"tipo": "CLINICA"
}
]

Errores esperados: 400 si falta o es inválido nombre; 500 ante un fallo inesperado. Sin resultados: 200 []. 401 si falta una sesión válida; 403 si la sesión no corresponde al rol TUTOR.

4. Errores HTTP esperados

Código

Situación

400

Parámetro orden inválido en el catálogo de productos o parámetro nombre ausente/inválido en el endpoint propuesto. La búsqueda requiere un nombre no vacío y usa coincidencia exacta.

401

No hay sesión válida al consultar la búsqueda, que requiere autenticación de tutor.

403

La sesión pertenece a un rol distinto de TUTOR.

500

Fallo inesperado al consultar persistencia u otra dependencia interna.

La API usa errores de validación 400 con { "message": "Revisa los datos ingresados", "errores": { "campo": "mensaje" } }. Otros errores siguen el formato de NestJS. No se proponen códigos de negocio adicionales.

5. Definition of Done (DoD)

El endpoint realiza coincidencia exacta sensible a mayúsculas y acentos, devuelve como máximo 10 resultados y no implementa paginación.

Existe el endpoint de búsqueda acordado, documentado en Swagger y validado con esquema compartido; filtra por nombre y por tipos de aliado aprobados, excluye fundaciones y no expone datos de contacto.

El endpoint usa SQL parametrizado y devuelve 200 [] cuando no existen coincidencias.

Las rutas existentes de catálogos de clínicas, productos y adopción se reutilizan sin duplicarlas ni cambiar su contrato por esta HU.

Hay pruebas de integración para resultados por tipo, exclusión de aliados inactivos/fundaciones, búsqueda vacía, entrada inválida y respuesta sin resultados.

docs/context/api-backend.md se actualiza al implementar el endpoint; esta HU no modifica ese ni otros archivos durante la preparación del análisis.

6. Consideraciones técnicas

Confirmado y existente

GET /api/aliados/clinicas y VeterinariosService.listarClinicas() (apps/api/src/modules/aliados/clinicas.controller.ts, apps/api/src/modules/aliados/veterinarios.service.ts) listan clínicas activas con id, nombre y descripción.
GET /api/productos (apps/api/src/modules/comercio/productos.controller.ts) lista productos disponibles y acepta orden, no búsqueda por tienda o nombre de aliado.
GET /api/adopciones/catalogo (apps/api/src/modules/adopcion/adopcion.controller.ts) reutiliza AdopcionService.listarCatalogo() y AdopcionRepository.listarPublicas(). La migración db/migrations/0011_hu084_medios_adopcion.sql define v_catalogo_adopcion sin columnas de identidad de fundación y filtra publicaciones DISPONIBLE de fundaciones ACTIVO.
Los aliados y su tipo, estado y nombre ya están en la tabla aliado (migración base db/migrations/0001_baseline.sql). No se identifica una migración nueva necesaria para buscar por esos campos.
GET /api/aliados/:aliadoId ya existe para consultar detalle de un aliado activo por un tutor autenticado; no lista ni busca aliados.

Propuesta de implementación

Agregar una operación de lectura en el módulo apps/api/src/modules/aliados/, reutilizando DatabaseService y el dominio de aliados. Evitar duplicar VeterinariosService.listarClinicas(); puede conservarse como catálogo especializado de clínicas y agregarse una consulta común nueva para búsqueda.
Usar una ruta que no colisione con GET /api/aliados/:aliadoId, por ejemplo GET /api/aliados/busqueda?nombre=...; validar query con un esquema Zod de @veto/shared según los límites aprobados.
Consultar aliado con filtro de estado activo y tipos autorizados. Se excluyen fundaciones y el catálogo de adopción queda fuera del buscador, conforme a la HU. Retornar únicamente id, nombre y tipo salvo que producto justifique otros campos.
Mantener fuera de esta búsqueda el catálogo anónimo de adopción. El acceso a /adopcion y sus estados visuales no requieren cambios de Backend en esta HU.
No se requiere entidad, tabla o migración nueva; índice por nombre solo se propondrá si el volumen o plan de consultas lo justifica, no se encontró evidencia para requerirlo ahora.

Definiciones funcionales aplicadas

Búsqueda exacta, sensible a mayúsculas y acentos.
Máximo de 10 coincidencias, sin paginación.
Acceso restringido al rol TUTOR, indicado explícitamente por la HU.

7. Alcance

Incluido – Backend:

Endpoint propuesto de búsqueda por nombre sobre aliados activos de los tipos aprobados, con exclusión de fundaciones.
Validación del query, respuesta sin coincidencias, control de campos expuestos y documentación OpenAPI.
Reutilización sin duplicación de los catálogos existentes de clínicas, productos y adopción.
Pruebas de la nueva búsqueda y actualización documental cuando se implemente.

Excluido:

Cambios en la pantalla de inicio, menú, enlaces, rutas visuales, responsive, estados de carga/vacío/error y accesibilidad (Frontend/UX/UI).
Implementar páginas o navegación de clínicas, veterinarios independientes, tienda o adopción; esos accesos ya están representados en el Frontend actual.
Buscar productos, servicios, mascotas en adopción o fundaciones. La búsqueda definida aquí es por nombre de aliado y excluye fundaciones.
Gestión de tiendas/productos, pedidos, inventario o persistencia adicional.
