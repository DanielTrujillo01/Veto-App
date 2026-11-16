# Cierre documental de una HU

## Propósito

Ejecuta esta guía cada vez que una Historia de Usuario (HU) quede implementada, antes de cerrar su pull request. El objetivo es que la documentación de `docs/` describa el comportamiento y la arquitectura que realmente quedaron en el repositorio.

Esta guía es un procedimiento manual obligatorio del flujo de trabajo; no es un script que el sistema ejecute automáticamente. La plantilla de pull request y `CONTRIBUTING.md` la incorporan como paso de cierre.

## Fuentes de verdad

Contrasta la HU implementada con el código y los artefactos que cambiaron. El código, los contratos, las migraciones y las pruebas determinan lo que existe. La documentación orienta la revisión, pero no sustituye esa verificación.

Consulta, según aplique:

- La HU y sus criterios de aceptación, incluyendo la descripción o documento en `docs/HUs/` si existe.
- Los controladores, servicios, módulos, componentes y esquemas o DTO afectados.
- `packages/shared/` para contratos compartidos.
- `db/migrations/` y `docs/modelo-de-datos.md` para cambios de persistencia.
- `docs/prompts/context/api-backend.md` para contratos y endpoints.
- `docs/prompts/context/` para arquitectura, contexto y procesos.
- `docs/adr/` si hubo una decisión arquitectónica relevante.
- Pruebas y configuración que sustenten el comportamiento documentado.

No leas ni reescribas documentos sin relación con la HU.

## Procedimiento

1. **Identifica el cambio terminado.** Revisa la HU, los criterios aceptados y los archivos modificados. Si la HU no está asociada de forma clara al cambio, deja constancia y no atribuyas cambios por suposición.
2. **Contrasta cada hecho.** Verifica rutas, métodos HTTP, autenticación y permisos, entradas, respuestas, errores, reglas de negocio, estados y persistencia contra la implementación actual. Distingue lo existente de lo nuevo y registra discrepancias que sigan abiertas.
3. **Determina qué documentación cambia.** Actualiza únicamente los documentos de `docs/` afectados por el comportamiento implementado. Por ejemplo:
   - Endpoints o contratos: `docs/context/api-backend.md`.
   - Tablas, columnas, relaciones o restricciones: `docs/modelo-de-datos.md` y, si aplica, `docs/diagramas_er.md`.
   - Arquitectura o convenciones vigentes: el documento correspondiente de `docs/context/`.
   - Decisión arquitectónica que deba conservarse: un ADR nuevo en `docs/adr/`, siguiendo `docs/adr/0001-arquitectura.md`.
   - Documento específico de la HU: actualiza su estado o resultado si existe y corresponde.
4. **Mantén el alcance preciso.** No copies la implementación entera a la documentación, no dupliques inventarios y no registres como disponible lo que solo está propuesto, pendiente o no se pudo verificar. Conserva el idioma, estructura y convenciones del documento que editas.
5. **Revisa consistencia y referencias.** Comprueba que las rutas existan, que ejemplos y nombres coincidan con los contratos actuales, que no queden instrucciones contradictorias y que las referencias relativas funcionen.
6. **Deja evidencia en el pull request.** Completa la sección “Documentación” de abajo y marca la lista de verificación solo después de revisar el resultado.

## Criterio para documentos sin cambios

Si la HU no altera información cubierta por `docs/`, o los documentos ya describen fielmente el resultado, no fuerces una edición. En la descripción del pull request registra: “Documentación revisada; sin cambios necesarios”, con una breve razón ligada a la HU.

Si una discrepancia no puede resolverse con el alcance implementado, documenta solo los hechos confirmados y anota la discrepancia como pendiente en el pull request. No presentes una propuesta como comportamiento vigente.

## Lista de verificación

- [ ] Revisé la HU y los criterios de aceptación implementados.
- [ ] Contrasté la documentación relacionada con código, contratos y migraciones aplicables.
- [ ] Actualicé los documentos de `docs/` que quedaron desactualizados, o expliqué por qué no se requerían cambios.
- [ ] Verifiqué nombres, rutas, ejemplos, referencias y consistencia de lo editado.
- [ ] Registré en el pull request las rutas actualizadas o la razón para no modificarlas y cualquier discrepancia pendiente.

## Registro para el pull request

**Documentación revisada:** `docs/ruta` (o “sin cambios necesarios”).

**Cambios documentales:** resumen breve de lo actualizado y su relación con la HU.

**Pendientes o discrepancias:** indicar los que existan o “Ninguno”.
