# HU-026 – Reporte de testing

## 1. Identificación

- **HU:** HU-026 – Filtrar servicios por especie, tipo y modalidad.
- **Especificación:** `docs/HUs/HU-026-filtrar-servicios-por-especie-tipo-modalidad.md`.
- **Tareas:** `docs/HUs/HU-026-tareas-taiga.md`.
- **Fecha:** 2026-11-16.
- **Rama:** `dev/Jhonier`.
- **Commit base:** `792978c` (cambios de HU-026 en el árbol de trabajo, sin commit).
- **Entorno:** Docker Compose aislado, PostgreSQL 17 limpio, datos locales de demostración.
- **Herramientas:** Jest + Supertest, PostgreSQL, Docker Compose, pnpm, ESLint, Prettier, TypeScript, Nest build y Next build.

## 2. Resumen de la auditoría

HU-026 modifica el catálogo público existente `GET /api/servicios` para aceptar filtros opcionales por especie atendida por el aliado, tipo de servicio y modalidad. Los filtros se combinan con AND. La validación mantiene IDs `smallint` positivos, conserva el orden existente y responde `200 []` ante una consulta válida sin coincidencias.

Se encontró una suite específica de 14 pruebas HTTP con Supertest y base simulada, además de cobertura relacionada en `servicios.spec.ts`, `aliado-especies.spec.ts` y `hu020-precios.spec.ts`. Se añadieron verificaciones de disponibilidad en el SQL observado y casos de entradas numéricas inválidas, parámetros fuera de alcance, filtros individuales y combinados.

Para comprobar la consulta PostgreSQL real se añadieron fixtures deterministas e idempotentes al seed local, se levantó una base Compose aislada desde cero y se probaron las solicitudes HTTP sin sesión. Los servicios inactivos, ocultos y en una sede inactiva no aparecieron en el catálogo. Repetir el seed dos veces no duplicó resultados.

La ejecución integral de `pnpm test` pasó: 48 suites y 797 pruebas entre shared, API y web; las pruebas de API incluyeron 31 suites y 550 pruebas. `lint`, `typecheck`, migraciones y reglas SQL pasaron. El chequeo de formato global todavía falla en tres documentos preexistentes ajenos a esta HU. El build de API y shared pasa; el build integral falla durante el prerender de `/_global-error` en Next.js, fuera del alcance Backend de HU-026.

## 3. Matriz de cobertura de criterios

| Criterio de aceptación                                                                    | Tipo de prueba                       | Archivo / evidencia                                                                                           | Estado   | Observaciones                                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtra por especie atendida por el aliado usando `aliado_especie`                         | API simulada y smoke HTTP PostgreSQL | `apps/api/test/hu026-servicios-filtros.spec.ts`; GET real con `especieId`                                     | Cubierto | La prueba verifica el `EXISTS` contra `aliado_especie`; PostgreSQL real devolvió los tres servicios disponibles para Perro.                                                                           |
| Filtra por tipo de servicio                                                               | API y smoke HTTP PostgreSQL          | Spec HU-026; catálogo real de tipos y filtro por tipo Baño y peluquería                                       | Cubierto | Solo devolvió el servicio del tipo elegido.                                                                                                                                                           |
| Filtra por modalidad                                                                      | API y smoke HTTP PostgreSQL          | Spec HU-026; consultas reales `EN_SEDE` y `A_DOMICILIO`                                                       | Cubierto | La base de prueba contiene ambas modalidades.                                                                                                                                                         |
| Combina filtros mediante AND                                                              | API y smoke HTTP PostgreSQL          | Spec HU-026; consulta real de especie + tipo + modalidad                                                      | Cubierto | La combinación real devolvió únicamente Baño y peluquería demo.                                                                                                                                       |
| Omite o retira filtros sin errores                                                        | API                                  | Spec HU-026: consulta sin filtros, cada filtro individual y combinación                                       | Cubierto | También se verificó que parámetros antiguos desconocidos `edad` y `ubicacion` no se aplican ni generan error.                                                                                         |
| Sin filtros conserva listado y orden por defecto; orden explícito continúa operativo      | API y smoke HTTP PostgreSQL          | Spec HU-026 (`orden=precio_desc`); consulta real del catálogo                                                 | Cubierto | Se mantiene el allowlist y el orden por `precioDesde`.                                                                                                                                                |
| Solo incluye aliados activos, servicios activos/publicados y sedes activas para `EN_SEDE` | SQL y smoke HTTP PostgreSQL          | Spec HU-026 inspecciona el predicado; fixtures `412`–`414` del seed local                                     | Cubierto | La lista real conserva los dos servicios en sede válidos y el servicio a domicilio; excluye servicio inactivo, oculto y servicio con sede inactiva. El predicado de aliado activo se comprobó en SQL. |
| Una opción válida inexistente devuelve `200 []`                                           | API y smoke HTTP PostgreSQL          | Spec HU-026 y consulta real `especieId=32767`                                                                 | Cubierto | No se trata como error `404`.                                                                                                                                                                         |
| IDs inválidos y modalidad no admitida responden `400`                                     | API y smoke HTTP PostgreSQL          | Spec HU-026; consultas con valores no numéricos, cero, decimales, negativos y sobre 32767; modalidad `REMOTO` | Cubierto | El endpoint real confirmó `400` para modalidad no válida.                                                                                                                                             |
| Respuesta existente, reglas de precio y HU-021 no se alteran                              | Regresión y smoke HTTP PostgreSQL    | `servicios.spec.ts`, `aliado-especies.spec.ts`, `hu020-precios.spec.ts` y suite completa                      | Cubierto | Las suites relacionadas pasan y el formato `ServicioConReglas` se conserva.                                                                                                                           |
| Acceso público sin autenticación                                                          | API y smoke HTTP PostgreSQL          | El spec crea la app sin usuario y llama la ruta; smoke sin cookie                                             | Cubierto | La ruta no requiere sesión, como define la especificación.                                                                                                                                            |

## 4. Pruebas implementadas o modificadas

| Archivo                                         | Tipo de prueba                    | Escenarios cubiertos                                                                                                        | Acción                                                                                                                                         |
| ----------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/test/hu026-servicios-filtros.spec.ts` | API con Supertest y base simulada | Filtros individuales y AND, omisión, orden, parámetros desconocidos, resultados vacíos, disponibilidad en SQL y errores 400 | Modificado durante QA para ampliar validaciones y comprobar que el predicado vigente permanece en la consulta.                                 |
| `db/seeds/local-demo.sql`                       | Fixture local PostgreSQL          | Servicio publicado a domicilio, servicio inactivo, oculto y en sede inactiva                                                | Modificado durante QA con registros deterministas `411`–`414` y sede inactiva `303`; `db/seed-local.mjs` limita su uso al servicio local `db`. |

Las solicitudes HTTP reales en el entorno aislado comprobaron servicio por especie, tipo y modalidad; combinación de los tres; orden por precio; parámetros desconocidos; resultado vacío; y modalidad inválida. La lista sin filtros tuvo tres servicios disponibles y excluyó los fixtures no disponibles. Tras dos ejecuciones adicionales del seed siguió mostrando tres, confirmando idempotencia.

## 5. Resultados de ejecución

| Control                         | Resultado                | Evidencia                                                                                                                                                                                                      |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier dirigido               | Aprobado                 | `prettier --check` sobre controller, service, repository, shared, spec HU-026 y documentación API.                                                                                                             |
| Formato global                  | Fallido                  | `pnpm format:check` detectó `docs/HUs/HU-025-reporte-testing.md`, `docs/prompts/Implement.md` y `docs/prompts/test/execQA.md`. El spec de HU-026 fue formateado; los tres documentos ajenos no se modificaron. |
| Lint global                     | Aprobado                 | `pnpm lint` en Docker.                                                                                                                                                                                         |
| Typecheck                       | Aprobado                 | `pnpm typecheck`; shared, Figma, API y web.                                                                                                                                                                    |
| Build shared                    | Aprobado                 | Incluido en `pnpm build` y `pnpm typecheck`.                                                                                                                                                                   |
| Build API                       | Aprobado                 | `pnpm build` construyó `@veto/api` en Docker.                                                                                                                                                                  |
| Build monorepo                  | Fallido fuera de Backend | `pnpm build`: shared, API y Figma pasaron; Next.js compiló y tipó, pero falló al prerenderizar `/_global-error` por `Cannot read properties of null (reading 'useContext')`.                                   |
| Migraciones                     | Aprobado                 | Base Compose aislada creada desde cero; migraciones aplicadas al iniciar. La repetición de `pnpm db:migrate` indicó que la base estaba al día.                                                                 |
| Reglas SQL                      | Aprobado                 | `pnpm db:test`; terminó con `=== TODAS LAS PRUEBAS PASARON ===`.                                                                                                                                               |
| Pruebas específicas y regresión | Aprobado                 | 4 suites, 67 pruebas: HU-026, servicios, especies HU-021 y precios HU-020.                                                                                                                                     |
| Pruebas integrales              | Aprobado                 | `pnpm test`: API 31 suites/550 pruebas, shared 15/238 y web 2/9; total 48 suites/797 pruebas.                                                                                                                  |
| Smoke HTTP PostgreSQL           | Aprobado                 | API sin sesión contra PostgreSQL aislado y fixtures locales de HU-026. Filtros, AND, disponibilidad, orden, `200 []`, `400` e idempotencia del seed.                                                           |
| CI remoto                       | No verificado            | No se consultó ni disparó GitHub Actions.                                                                                                                                                                      |

## 6. Cobertura de código

La ejecución dirigida `jest --runInBand --coverage test/hu026-servicios-filtros.spec.ts` pasó 14/14 pruebas.

| Componente cargado por la suite dirigida | Sentencias | Ramas  | Funciones | Líneas |
| ---------------------------------------- | ---------- | ------ | --------- | ------ |
| `servicios.controller.ts`                | 72.34%     | 100%   | 25%       | 68.29% |
| `servicios.repository.ts`                | 43.18%     | 25.64% | 25%       | 35.89% |
| `servicios.service.ts`                   | 21.97%     | 0%     | 7.69%     | 21.42% |
| Total de archivos cargados               | 37.90%     | 3.65%  | 13.19%    | 35.87% |

La suite crea `ServiciosModule`, por lo que se cargan métodos del módulo que no son parte de HU-026 y reducen esos porcentajes agregados. Los resultados no equivalen a cobertura funcional de todos los servicios del módulo. `apps/api/jest.config.js` no define `coverageThreshold`; no hay umbral que declarar cumplido o incumplido.

## 7. Defectos encontrados

### QA-026-01 — Formato global incumplido por documentos ajenos

- **Categoría:** Problema de calidad.
- **Archivos:** `docs/HUs/HU-025-reporte-testing.md`, `docs/prompts/Implement.md`, `docs/prompts/test/execQA.md`.
- **Esperado:** `pnpm format:check` sin archivos pendientes.
- **Observado:** Prettier reporta esos tres documentos; el spec HU-026 detectado en la primera comprobación se formateó y verificó.
- **Acción:** no se modificaron documentos fuera del alcance de HU-026.
- **Estado:** Pendiente, no afecta la validación funcional del backend de HU-026, pero mantiene rojo el control global de formato.

### QA-026-02 — Build del frontend falla durante prerender

- **Categoría:** Problema de calidad fuera del alcance Backend.
- **Archivo/componente:** prerender de Next.js `/_global-error`.
- **Esperado:** `pnpm build` integral termina correctamente.
- **Observado:** la compilación y tipado web pasan, pero el prerender falla con `TypeError: Cannot read properties of null (reading 'useContext')`.
- **Acción:** no se modificó frontend conforme al alcance QA Backend.
- **Estado:** Pendiente fuera de HU-026; el build de API pasó.

No se encontraron defectos funcionales de HU-026 durante las pruebas de API o el smoke test PostgreSQL.

## 8. Modificaciones realizadas

Durante esta fase QA se modificaron exclusivamente pruebas, datos locales de prueba y este informe:

- `apps/api/test/hu026-servicios-filtros.spec.ts`: casos de validación, compatibilidad y aserciones del predicado SQL de disponibilidad.
- `db/seeds/local-demo.sql`: fixtures deterministas para modalidad y exclusión de registros no disponibles. No se alteraron migraciones ni `db/seed-local.mjs`.
- `docs/HUs/HU-026-reporte-testing.md`: resultados de esta auditoría.

Los cambios funcionales Backend de HU-026 y la documentación del contrato API ya existían al iniciar esta fase y no se editaron durante QA. No se modificaron controladores, servicios, repositorios, contratos compartidos, frontend, configuración productiva ni CI.

## 9. Matriz de cumplimiento del DoD

| Elemento del DoD HU-026                                                                   | Estado                   | Evidencia                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Endpoint global acepta y valida filtros por especie, tipo y modalidad, y conserva orden   | Aprobado                 | Suite HU-026, Swagger y smoke HTTP.                                                                                                 |
| Los filtros se combinan mediante AND y especie usa `aliado_especie`                       | Aprobado                 | Aserción del SQL parametrizado y combinación real en PostgreSQL.                                                                    |
| Disponibilidad y respuesta `ServicioConReglas` se conservan                               | Aprobado                 | Fixtures de estados no disponibles, respuesta HTTP y regresiones de servicios/precios.                                              |
| Parámetros inválidos responden `400`; consulta válida sin coincidencias responde `200 []` | Aprobado                 | Jest y llamadas HTTP reales.                                                                                                        |
| Omitir filtros recupera resultados sin error                                              | Aprobado                 | Solicitudes sin filtros, filtro individual, combinación y parámetros antiguos ignorados.                                            |
| Pruebas cubren filtros, combinaciones, errores, orden y disponibilidad                    | Aprobado con observación | Suite dirigida y smoke real; el estado de aliado activo está comprobado en el predicado SQL, sin fixture real de aliado suspendido. |
| Swagger/OpenAPI documenta los cuatro parámetros de catálogo                               | Aprobado                 | `GET /api/docs-json` real mostró `especieId`, `tipoServicioId`, `modalidad` y `orden`.                                              |
| Sin filtros de edad, peso, precio o ubicación ni migración                                | Aprobado                 | Alcance del contrato y prueba que parámetros `edad`/`ubicacion` no se aplican; no se creó migración.                                |

## 10. Resultado final

# APROBADA CON OBSERVACIONES

Los criterios funcionales del backend HU-026 se comprobaron con pruebas HTTP y una base PostgreSQL aislada. Las 48 suites/797 pruebas integrales pasaron; también pasaron lint, typecheck, migraciones y reglas SQL. Los filtros, el orden, los errores y la preservación de disponibilidad fueron verificados.

Las observaciones son de CI global y ajenas a la funcionalidad Backend: Prettier falla en tres documentos que no pertenecen a HU-026, y el build integral falla al prerenderizar `/_global-error` en Next.js. El build de API, shared y Figma pasó. CI remoto no fue verificado.

El entorno Compose de QA se aisló del volumen habitual. Los contenedores se retiraron al terminar la verificación y el volumen de QA se conservó; no se borraron datos locales del usuario.
