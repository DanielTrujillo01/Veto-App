# HU-026 – Tareas de implementación para Taiga

**Historia relacionada:** HU-026 – Filtrar servicios por especie, tipo y modalidad.

**Área:** Backend.

**Documento de especificación:** `HU-026-filtrar-servicios-por-especie-tipo-modalidad.md`.

**Objetivo:** ampliar el catálogo público global de servicios con filtros combinables por especie atendida, tipo de servicio y modalidad, preservando su contrato vigente.

## Tareas

### Tarea 1: Añadir validación y contrato de filtros al catálogo global

**Descripción:** definir el esquema compartido para los filtros opcionales `especieId`, `tipoServicioId` y `modalidad` del endpoint global, conservar el orden actual y validar los IDs como enteros positivos en rango `smallint`.

**Alcance:** contrato de query y tipos compartidos para `GET /api/servicios`. No modificar el esquema de entrada de gestión, ni cambiar el filtro específico por aliado de HU-021. No incluir edad, peso, precio ni ubicación.

**Componentes involucrados:** `packages/shared/src/servicio.ts`, `packages/shared/src/especie.ts` (referencia de rango y validación existente), `packages/shared/src/enums.ts` (`MODALIDADES_SERVICIO`), `apps/api/src/modules/servicios/servicios.controller.ts`.

**Resultado esperado:** esquema de catálogo global valida los tres filtros opcionales y `orden`, y rechaza valores inválidos mediante el mecanismo común de validación.

**Criterios de verificación:** IDs no enteros, no positivos o mayores a 32767 y modalidades no admitidas producen `400`; omitir cada propiedad es válido; `orden` mantiene sus opciones y valor por defecto.

**Dependencias:** Ninguna.

**Estimación desglosada por tarea:** 2 puntos. UX 0, Diseño 0, Frontend 0, Backend 2.

### Tarea 2: Aplicar filtros combinables en la consulta de servicios disponibles

**Descripción:** transportar los filtros desde el controlador al servicio y al repositorio, y aplicarlos en la consulta de `listarTodosDisponibles` mediante parámetros SQL. Combinar criterios con AND. El filtro de especie debe comprobar la cobertura del aliado con `aliado_especie`, sin usar las reglas de precio.

**Alcance:** modificar solo el listado global público y mantener los predicados de disponibilidad, la carga de reglas y el orden actual. No cambiar endpoint por aliado, cálculo de precios, respuesta ni persistencia.

**Componentes involucrados:** `apps/api/src/modules/servicios/servicios.controller.ts`, `apps/api/src/modules/servicios/servicios.service.ts`, `apps/api/src/modules/servicios/servicios.repository.ts`; relación existente `aliado_especie`, tabla `servicio` y tabla `tipo_servicio`.

**Resultado esperado:** el listado global devuelve únicamente servicios disponibles que satisfacen todos los filtros enviados, y sin coincidencias devuelve arreglo vacío.

**Criterios de verificación:** probar cada filtro por separado y sus combinaciones; comprobar que retirar un parámetro quita solo su predicado; confirmar que servicios inactivos/no publicados o con sede inactiva no aparecen; sin filtros se mantiene la salida/orden actual; consulta parametrizada y orden seleccionado desde allowlist.

**Dependencias:** Tarea 1.

**Estimación desglosada por tarea:** 3 puntos. UX 0, Diseño 0, Frontend 0, Backend 3.

### Tarea 3: Cubrir el contrato con pruebas y actualizar documentación API

**Descripción:** agregar o extender pruebas de integración para la consulta global filtrada y documentar los query params en Swagger/OpenAPI. Reutilizar convenciones y fixtures existentes sin repetir las pruebas de HU-021 ni HU-020.

**Alcance:** pruebas de los filtros y regresión del catálogo global, además de documentación de la operación. No crear pruebas visuales ni actualizar inventarios generales fuera del contrato API asociado.

**Componentes involucrados:** suite de pruebas bajo `apps/api/test/` (identificar/añadir archivo para listado global de servicios; `apps/api/test/aliado-especies.spec.ts` y `apps/api/test/hu020-precios.spec.ts` como cobertura existente de referencia); decoradores `@ApiOperation` y documentación del endpoint en `apps/api/src/modules/servicios/servicios.controller.ts`.

**Resultado esperado:** casos de aceptación cubiertos y documentación que distingue filtros opcionales, valores admitidos y lista vacía de error.

**Criterios de verificación:** pruebas para sin filtros, filtros individuales, combinación AND, resultados vacíos, parámetros inválidos, orden y reglas de disponibilidad pasan; Swagger muestra `especieId`, `tipoServicioId`, `modalidad` y `orden`.

**Dependencias:** Tareas 1 y 2.

**Estimación desglosada por tarea:** 3 puntos. UX 0, Diseño 0, Frontend 0, Backend 3.

## Configuración Taiga sugerida

- **Épica:** E05 – Servicios y horarios (confirmada en el contexto del proyecto).
- **Etiquetas sugeridas:** Backend, Servicios, Filtros, Catálogo. Verificar nombres existentes en Taiga antes de asignarlas; no se dispone de catálogo Taiga en este análisis.
- **Prioridad, sprint y responsable:** asignar según planificación del equipo; no inferidos en el repositorio.
- **Estimación total:** 8 puntos (2 + 3 + 3), Backend 8; UX/Diseño/Frontend 0.
- **Dependencias funcionales:** HU-021 define la semántica de especie atendida por aliado; se reutiliza sin duplicar su endpoint. HU-020 mantiene su propio mecanismo de precio y no requiere cambios.

## Consistencia y alcance

Las tres tareas cubren validación del contrato, aplicación de filtros y verificación/documentación. No se generan tareas para catálogos ya existentes (`GET /api/mascotas/especies`, `GET /api/servicios/tipos`), migraciones, Frontend, UX o Design. La versión previa del DoD que incluye edad, peso, precio y ubicación debe corregirse en Taiga para coincidir con la HU modificada.
