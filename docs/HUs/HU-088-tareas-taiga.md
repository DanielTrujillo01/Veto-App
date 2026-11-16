# HU-088 – Tareas de implementación para Taiga

**Historia relacionada:** HU-088 – Filtrar el catálogo de mascotas en adopción.

**Área:** Backend.

**Documento de especificación:** `HU-088-filtrar-catalogo-adopcion.md`.

**Objetivo:** extender el catálogo anónimo de adopción para filtrar por especie, edad, tamaño y ubicación, con rango de edad en meses y coincidencia exacta de ubicación.

## Tareas

### Tarea 1: Definir y validar el contrato de filtros del catálogo

**Descripción:** definir un esquema de query compartido para especie, límites de edad en meses, tamaño y ubicación exacta, con validación consistente con los tipos existentes.

**Alcance:** contrato de query de `GET /api/adopciones/catalogo`, validación de `especieId`, enum de tamaño, `edadMinMeses`/`edadMaxMeses` y texto de ubicación. Decisión pendiente: confirmar inclusión de extremos y admisión de límites individuales. Propuesta: extremos inclusivos, permitir uno o ambos y rechazar mínimo mayor que máximo. Ubicación se compara de forma exacta. No modifica los esquemas de publicación/edición ni el listado de publicaciones de una fundación.

**Componentes involucrados:** nuevo esquema propuesto en `packages/shared/src/adopcion.ts`; `packages/shared/src/enums.ts` (`TAMANOS_MASCOTA`); `apps/api/src/modules/adopcion/adopcion.controller.ts`.

**Resultado esperado:** contrato validado que representa únicamente las reglas aprobadas y conserva la consulta sin filtros.

**Criterios de verificación:** parámetros inválidos producen `400`; límites se validan conforme a la regla de extremos y admisión de límite individual que se apruebe; ubicación no acepta semántica parcial; el endpoint permanece público y no cambia el contrato de publicación.

**Dependencias:** confirmar si los límites son inclusivos y si se admite un solo límite.

**Estimación desglosada por tarea:** 2 puntos. UX 0, Diseño 0, Frontend 0, Backend 2.

### Tarea 2: Aplicar filtros combinables al catálogo público anónimo

**Descripción:** pasar los filtros validados por el controlador y servicio al repositorio, y filtrar la consulta del catálogo usando condiciones parametrizadas que se combinan con AND.

**Alcance:** modificar `listarCatalogo`/`listarPublicas` y la lectura de `v_catalogo_adopcion` o su equivalente parametrizado, preservando disponibilidad, anonimato, orden actual y forma de respuesta. No introducir filtros adicionales, relaciones con fundaciones en la respuesta ni cambios de persistencia.

**Componentes involucrados:** `apps/api/src/modules/adopcion/adopcion.controller.ts`, `apps/api/src/modules/adopcion/adopcion.service.ts`, `apps/api/src/modules/adopcion/adopcion.repository.ts`, vista `v_catalogo_adopcion` definida en `db/migrations/0001_baseline.sql` y actualizada en `db/migrations/0011_hu084_medios_adopcion.sql`.

**Resultado esperado:** el catálogo retorna solo publicaciones disponibles de fundaciones activas que cumplan todos los filtros recibidos; sin coincidencias retorna `[]`.

**Criterios de verificación:** filtros individuales y combinaciones excluyen publicaciones fuera de criterio; no enviar un filtro deja de aplicar ese criterio; sin filtros se conserva el catálogo actual; las consultas siguen sin incluir datos identificadores de fundación y mantienen los predicados de disponibilidad.

**Dependencias:** Tarea 1.

**Estimación desglosada por tarea:** 3 puntos. UX 0, Diseño 0, Frontend 0, Backend 3.

### Tarea 3: Probar y documentar el contrato filtrado

**Descripción:** añadir cobertura de integración para filtros, combinaciones, validación, lista vacía y regresiones de anonimato/disponibilidad; documentar los query params aprobados en Swagger/OpenAPI.

**Alcance:** pruebas del catálogo público de adopción y documentación del endpoint. No duplicar las pruebas de publicación/edición ni generar pruebas de interfaz.

**Componentes involucrados:** `apps/api/test/hu080-adopcion.spec.ts` (extender o extraer casos sin duplicación); anotaciones Swagger en `apps/api/src/modules/adopcion/adopcion.controller.ts`.

**Resultado esperado:** comportamiento del filtro verificable en integración y contrato visible en la documentación API.

**Criterios de verificación:** pruebas de especie, límites de edad individuales y combinados según la semántica aprobada, tamaño, ubicación por igualdad exacta, combinaciones, sin filtros, filtros inválidos, cero resultados y ausencia de campos de fundación; Swagger documenta parámetros y semántica aprobados.

**Dependencias:** Tareas 1 y 2.

**Estimación desglosada por tarea:** 3 puntos. UX 0, Diseño 0, Frontend 0, Backend 3.

## Configuración Taiga sugerida

- **Épica:** adopción complementaria, asociada en el contexto a E19–E23; confirmar la épica exacta de HU-088 en Taiga, porque las fuentes locales no desglosan esa asignación.
- **Etiquetas sugeridas:** Backend, Adopción, Catálogo, Filtros. Verificar las etiquetas existentes de Taiga antes de asignarlas; no se dispone de su catálogo.
- **Prioridad, sprint y responsable:** asignar según planificación del equipo; no se infieren.
- **Estimación:** 8 puntos Backend (2 + 3 + 3).
- **Dependencias funcionales:** reutiliza HU-080 (catálogo público), HU-087 (vista anónima) y HU-084 (medios incluidos en la vista). No requiere duplicar esas funcionalidades.

## Consistencia y cobertura

Las tareas cubren el contrato validado, la consulta combinada y la comprobación/documentación. Los endpoints existentes de catálogo y especie se reutilizan. No se proponen tablas, migraciones, rutas nuevas, interfaz, ni filtros fuera de la HU. El rango de edad en meses y la ubicación exacta están confirmados. Antes de cerrar el contrato queda por confirmar si los extremos son inclusivos y si se admite un solo límite; la tarea 1 depende de esa definición.
