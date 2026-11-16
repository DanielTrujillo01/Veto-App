# HU-025 – Reporte de testing

## 1. Identificación

- **HU:** HU-025 – Búsqueda por palabra clave.
- **Especificación:** `docs/HUs/HU-025-busqueda-por-palabra-clave.md`.
- **Tareas:** `docs/HUs/HU-025-tareas-taiga.md`.
- **Fecha:** 2026-11-16.
- **Rama:** `dev/Jhonier`.
- **Commit base:** `78acf0c` (HU-025 se evaluó sobre el árbol de trabajo con cambios sin commit).
- **Entorno:** Docker Compose local aislado, PostgreSQL 17, API en `127.0.0.1:3001`; datos locales de demostración.
- **Herramientas:** Jest 30 + Supertest, Docker Compose, PostgreSQL, ESLint, Prettier, TypeScript/Nest build.

## 2. Resumen de la auditoría

La HU añade `GET /api/busqueda?nombre=...`, busca parcialmente en seis categorías, normaliza mayúsculas, acentos y espacios, requiere tutor autenticado, limita cada categoría a 10 resultados y excluye adopción. Se conserva la búsqueda de aliados de HU-024.

Se encontró una suite de API específica de HU-025 y la suite de regresión de HU-024. Las pruebas usan Supertest y una base simulada; para verificar el SQL real se levantó el API contra PostgreSQL local y se ejecutaron llamadas HTTP con los datos demo. Se agregaron 11 productos deterministas al seed local para comprobar el límite por categoría.

Las dos suites dirigidas pasaron: 15 pruebas. El módulo HU-025 alcanzó 100% de líneas, sentencias, funciones y ramas en la ejecución de cobertura dirigida. La cobertura agregada de esas dos suites fue 39.81% de sentencias, 38.09% de líneas, 17.48% de funciones y 6.09% de ramas; incluye módulos ajenos cargados por los guards y no representa cobertura global del repositorio.

La migración `0015_hu025_busqueda_unaccent.sql` tenía un BOM UTF-8 inicial que PostgreSQL interpretaba como carácter inválido. Tras la auditoría, y por solicitud del usuario, se retiró el BOM sin cambiar las sentencias SQL. En un proyecto Compose aislado con volumen nuevo, las 17 migraciones (0001–0015) se aplicaron correctamente y `pnpm db:test` terminó con `=== TODAS LAS PRUEBAS PASARON ===`. Las pruebas HTTP previas contra la base de demostración se habían ejecutado después de preparar manualmente esa base; la validación de base limpia se realizó posteriormente en el entorno aislado.

## 3. Matriz de cobertura de criterios

| Criterio de aceptación                                                      | Tipo de prueba                                  | Archivo / evidencia                                                                     | Estado   | Observaciones                                                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Búsqueda parcial por el campo nombre en las seis categorías                 | API y smoke HTTP con PostgreSQL                 | `apps/api/test/hu025-busqueda-general.spec.ts`; llamada `GET /api/busqueda?nombre=demo` | Cubierto | La respuesta real incluyó CLINICA, VET_INDEPENDIENTE, TIENDA, VETERINARIO, PRODUCTO y SERVICIO.                           |
| Ignora mayúsculas y acentos                                                 | API / smoke HTTP                                | Mismo spec; consulta real `cLiNiCa` sobre `Clínica Demo`                                | Cubierto | Se verifica mediante PostgreSQL con `unaccent`.                                                                           |
| Recorta extremos y colapsa espacios internos                                | API / smoke HTTP                                | Mismo spec; consulta real con espacios externos e internos repetidos                    | Cubierto | Coincidió con el nombre almacenado sin modificarlo.                                                                       |
| Solo consulta el campo nombre y devuelve datos mínimos                      | API y smoke HTTP                                | Spec; inspección de SQL y claves de resultados reales                                   | Cubierto | Los elementos expuestos contienen únicamente `id` y `nombre`; el grupo añade `categoria`.                                 |
| Agrupa por categoría y aplica máximo independiente de 10, con orden estable | API / smoke HTTP con 11 productos en PostgreSQL | Spec; búsqueda real `limite producto`                                                   | Cubierto | Se recibieron los primeros 10 productos en orden estable; las pruebas inspeccionan `row_number() PARTITION BY categoria`. |
| Excluye publicaciones de adopción y fundaciones                             | API / smoke HTTP                                | Spec; búsqueda real `nube`                                                              | Cubierto | La búsqueda devolvió `resultadosPorCategoria: []`; el SQL no consulta tablas de adopción.                                 |
| Sin coincidencias retorna lista vacía                                       | API / smoke HTTP                                | Spec; búsqueda con término inexistente                                                  | Cubierto | Respuesta HTTP 200 con `{ resultadosPorCategoria: [] }`.                                                                  |
| Consulta ausente/vacía responde 400                                         | API / smoke HTTP                                | Spec; consulta real compuesta de espacios                                               | Cubierto | El spec cubre también parámetro ausente y cadena vacía.                                                                   |
| Sin sesión responde 401 y rol no tutor responde 403                         | API / smoke HTTP                                | Spec y llamadas reales con sesión ausente/rol ALIADO                                    | Cubierto | Ambas respuestas observadas.                                                                                              |
| Parámetros SQL y texto de consulta no ejecutable                            | API / smoke HTTP                                | Spec; consulta real con cadena tipo inyección                                           | Cubierto | La entrada se trató como literal y devolvió lista vacía.                                                                  |
| Búsqueda HU-024 permanece sin cambios                                       | Regresión API                                   | `apps/api/test/hu024-busqueda-aliados.spec.ts`                                          | Cubierto | Suite aprobada, 8 pruebas; ruta y semántica existentes conservadas.                                                       |
| Migración de `unaccent` aplica desde una base sin esa extensión             | Migración de integración                        | Proyecto Compose aislado, volumen nuevo; migraciones `0001`–`0015` aplicadas             | Aprobado | 17 migraciones aplicadas en PostgreSQL limpio, incluida `0015_hu025_busqueda_unaccent.sql`.                                  |

## 4. Pruebas implementadas o modificadas

| Archivo                                        | Tipo de prueba                            | Escenarios cubiertos                                                                                                                               | Acción                                                                    |
| ---------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/api/test/hu025-busqueda-general.spec.ts` | API con Supertest y DB simulada           | Agrupación, proyección mínima, respuesta vacía, validación, roles, normalización SQL, límite por categoría, disponibilidad y exclusión de adopción | Existente al iniciar esta auditoría; ejecutado, no modificado durante QA. |
| `apps/api/test/hu024-busqueda-aliados.spec.ts` | Regresión API con Supertest y DB simulada | Búsqueda exacta de HU-024, validación, autorización, límite y SQL                                                                                  | Existente; ejecutado, no modificado.                                      |
| `db/seeds/local-demo.sql`                      | Fixture local de PostgreSQL               | 11 productos deterministas para comprobar que una categoría excede el límite de 10                                                                 | Modificado durante QA. `db/seed-local.mjs` no se modificó.                |

Las llamadas reales HTTP contra Docker también probaron seis categorías, normalización, límite, resultado vacío, exclusión de adopción, orden, proyección, SQL literal y respuestas 400/401/403.

Se intentó añadir una prueba estática que reprodujera el BOM de la migración, pero el auto-review rechazó la escritura de ese archivo de prueba (`rejected by user`, sin motivo adicional). No se insistió en el cambio. El fallo de migración quedó reproducido directamente mediante el servicio Compose y registrado abajo.

## 5. Resultados de ejecución

| Control                   | Resultado                       | Evidencia                                                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build shared              | Aprobado                        | Build de `@veto/shared` en la construcción integral del monorepo.                                                                                                                                                                                              |
| Build API                 | Aprobado                        | Build de imagen Docker y `docker compose exec -T api pnpm --filter @veto/api build`.                                                                                                                                                                           |
| Formato                   | Fallido global                  | `pnpm format:check` reporta únicamente dos documentos ajenos a HU-025: `docs/prompts/Implement.md` y `docs/prompts/test/execQA.md`; no se reformatearon.                                                                                                      |
| Linting                   | Aprobado global                 | `pnpm lint`.                                                                                                                                                                                                                                                   |
| Tipado                    | Aprobado global                 | `pnpm typecheck`; pasaron shared, Figma, API y web.                                                                                                                                                                                                            |
| Pruebas API/regresión     | Aprobado                        | Suite completa API: 30 suites, 536/536 pruebas; incluye HU-025 y regresión HU-024.                                                                                                                                                                              |
| Pruebas Shared/Web        | Aprobado                        | Suite monorepo: shared 238/238 y web 9/9 pruebas.                                                                                                                                                                                                              |
| Base de datos             | Aprobado                        | Compose aislado y limpio: 17 migraciones aplicadas; `pnpm db:test` pasó.                                                                                                                                                                                       |
| Smoke HTTP con PostgreSQL | Aprobado                        | Consultas reales sobre PostgreSQL local con las seis categorías, normalización, límite, estados y control de acceso descritos arriba.                                                                                                                         |
| Cobertura                 | Medida, sin umbral configurado  | Ejecución dirigida con `--coverage`: módulo `src/modules/busqueda` 100% en sentencias/líneas/funciones/ramas; agregado de las suites: 39.81% sentencias, 38.09% líneas, 17.48% funciones, 6.09% ramas. No se encontró umbral de cobertura configurado en Jest. |
| Migración                 | Aprobada                        | Proyecto Compose aislado con volumen nuevo aplicó `0015_hu025_busqueda_unaccent.sql` correctamente.                                                                                                                                                           |
| CI local integral         | Parcial                         | `lint`, `typecheck`, todas las pruebas, migraciones y `db:test` pasaron. `format:check` falla por dos documentos ajenos; build del monorepo falla al prerenderizar `/_global-error` de web (`useContext` sobre null). Build de shared/API/Figma pasó.           |
| CI remoto                 | No verificado                   | No se consultó ni se disparó GitHub Actions.                                                                                                                                                                                                                   |

## 6. Cobertura de código

- **HU-025 – `apps/api/src/modules/busqueda/`:** 100% sentencias, líneas, funciones y ramas en las pruebas dirigidas.
- **Cobertura agregada de la ejecución dirigida:** sentencias 39.81%, líneas 38.09%, funciones 17.48%, ramas 6.09%. El total incluye módulos de identidad/aliados cargados por la aplicación de pruebas, aunque no formen parte del cambio de HU-025.
- **Umbral:** no configurado en `apps/api/jest.config.js` ni en el script de pruebas de API.
- **Cumplimiento:** no aplica un umbral numérico configurado. El porcentaje alto del módulo no sustituye la comprobación del SQL real; esta se complementó con smoke HTTP y PostgreSQL.

## 7. Defectos encontrados

### QA-025-01 — Migración funcional inválida por BOM

- **Categoría:** Defecto de implementación.
- **Archivo:** `db/migrations/0015_hu025_busqueda_unaccent.sql`.
- **Esperado:** `docker compose up -d --build api` aplica la migración y continúa con seed/API en una base local limpia.
- **Observado inicialmente:** el contenedor `migrate` rechazó el BOM UTF-8 antes de la primera sentencia.
- **Evidencia:** fallo inicial reproducido en Compose; después, aplicación exitosa de las 17 migraciones y `pnpm db:test` en un volumen limpio aislado.
- **Acción:** retirado el BOM UTF-8 inicial a solicitud del usuario, sin cambios al SQL.
- **Estado:** Resuelto. No bloquea las migraciones desde una base limpia.

### QA-025-02 — Instalación de dependencias desde el host

- **Categoría:** Problema de entorno.
- **Evidencia:** instalación pnpm del host falló con `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; faltaban tipos y runner Jest.
- **Acción:** se ejecutaron build, pruebas, lint y typecheck dentro del contenedor Docker, cuya capa de dependencias estaba disponible.
- **Estado:** Resuelto para las verificaciones ejecutadas; no se alteró la configuración TLS.

### Observación de herramienta de formato

La verificación global `pnpm format:check` sigue fallando únicamente en `docs/prompts/Implement.md` y `docs/prompts/test/execQA.md`, documentos ajenos a esta HU. No se reformatearon dentro de este alcance.

## 8. Modificaciones realizadas

Durante la auditoría QA se modificó el fixture local. Posteriormente, por solicitud del usuario, también se corrigió la codificación de la migración:

- `db/seeds/local-demo.sql`: agrega 11 productos deterministas para comprobar el máximo de 10 por categoría en PostgreSQL local.
- `db/migrations/0015_hu025_busqueda_unaccent.sql`: se retiró el BOM UTF-8 inicial; no se alteró la sentencia SQL.

Durante QA no se modificaron controladores, servicios, consultas, shared, scripts, configuración de CI ni frontend. Los archivos de implementación de HU-025 listados como cambios en el worktree ya estaban presentes al iniciar la auditoría. La migración se modificó únicamente en el seguimiento posterior solicitado por el usuario para quitar el BOM.

## 9. Matriz de cumplimiento del DoD

| Elemento del DoD HU-025                                          | Estado                                   | Evidencia                                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Endpoint general protegido para tutores y documentado            | Aprobado                                 | Pruebas 401/403, smoke HTTP y ruta descrita en Swagger/API docs.                                           |
| Seis categorías cubiertas; adopción excluida                     | Aprobado                                 | Consulta real `demo` devolvió las seis; `nube` devolvió vacío.                                             |
| Coincidencia parcial y sin distinción de mayúsculas/acentos      | Aprobado                                 | Smoke HTTP a PostgreSQL con `cLiNiCa` sobre `Clínica Demo`; inspección del SQL.                            |
| Espacios externos e internos normalizados sin cambiar almacenado | Aprobado                                 | Smoke HTTP con espacios repetidos; el seed/consulta no actualiza nombres.                                  |
| Agrupación, proyección mínima y máximo 10                        | Aprobado                                 | Respuesta real agrupada; se observaron solo `id`,`nombre`; 11 productos de fixture produjeron 10.          |
| Orden estable y límite independiente por categoría               | Aprobado                                 | Orden de los 10 productos comprobado por HTTP; prueba inspecciona `PARTITION BY categoria`.                |
| 400/401/403 y ausencia de resultados 200                         | Aprobado                                 | Pruebas automatizadas y smoke HTTP.                                                                        |
| SQL parametrizado; sin tablas ni campos duplicados               | Aprobado en implementación inspeccionada | Prueba inspecciona query; smoke con texto tipo inyección devolvió vacío; no se añadieron tablas/columnas.  |
| HU-024 conserva su ruta y sensibilidad                           | Aprobado                                 | Suite de regresión HU-024: 8 pruebas aprobadas; código de búsqueda existente no fue modificado durante QA. |
| Migración necesaria para unaccent y ejecución CI                 | Aprobado                                 | La migración 0015 se aplicó en PostgreSQL limpio y `pnpm db:test` pasó.                                     |

## 10. Resultado final

# APROBADA CON OBSERVACIONES

La funcionalidad de HU-025 y su migración fueron verificadas: 30 suites/536 pruebas API pasan; en una base PostgreSQL limpia se aplicaron las 17 migraciones y pasó `pnpm db:test`. La auditoría integral queda con observaciones porque `pnpm format:check` falla por dos documentos de prompts ajenos a esta HU y el build completo del monorepo falla al prerenderizar `/_global-error` de la aplicación web (`useContext` sobre null). El build de shared, API y Figma, el lint y el typecheck global sí pasaron. CI remoto no fue consultado.

**Observaciones:** resolver el formato de los dos documentos ajenos a HU-025 y el prerender de `/_global-error` para dejar verde el CI local completo. CI remoto no se verificó. No se añadió la prueba estática de BOM porque el auto-review rechazó esa escritura; la ejecución de migraciones desde base limpia y `pnpm db:test` validan la corrección actual.

La comprobación de migración se hizo en un proyecto Compose aislado con volumen nuevo, separado del volumen local de demostración. La base de demostración original no se eliminó ni se usó como evidencia de migración desde cero.
