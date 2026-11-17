# HU-045 – Reporte de testing

## 1. Identificación

- **HU:** HU-045 – Filtrar y buscar productos por categoría.
- **Especificación:** [HU-045-filtrar-y-buscar-productos.md](HU-045-filtrar-y-buscar-productos.md).
- **Tareas:** [HU-045-tareas-taiga.md](HU-045-tareas-taiga.md).
- **Fecha de ejecución:** 2026-11-16.
- **Rama y commit evaluados:** `dev/Jhonier`, `5df7e69`.
- **Entorno:** Docker Compose con PostgreSQL 17 aislado, migraciones y seed local; los contenedores de QA se detuvieron al finalizar. No se usaron credenciales reales.
- **Herramientas:** pnpm 10.34.9, Node.js 22, Jest 30, Vitest 3, Supertest, Prettier, ESLint, TypeScript, Nest CLI y PostgreSQL 17.

## 2. Resumen de la auditoría

Antes de esta fase ya existía `apps/api/test/hu045-productos.spec.ts` con 14 pruebas HTTP usando la base simulada del proyecto. Cubría las respuestas y reglas principales, pero no ejercitaba los errores 500 documentados para consultas fallidas de categorías, productos y fotos. Se añadieron tres casos para esos errores; no se modificó lógica funcional.

La consulta también se probó a través de la API conectada a PostgreSQL migrado y sembrado. Se comprobaron categorías, búsqueda parcial que ignora acentos y espacios repetidos, combinación con categoría, producto con stock cero, lista vacía e ID inválido. No se encontraron incumplimientos funcionales de HU-045.

Los controles globales de formato, lint, tipos, migraciones, pruebas SQL y suites pasaron. En la primera ejecución local del build desde el servicio API de Compose, Next heredó `NODE_ENV=development` y falló al prerenderizar `/_global-error`. El workflow de GitHub Actions no define ese valor. Al repetir el build con `NODE_ENV` sin definir, igual que en el workflow, Next eligió producción y el build completo del workspace pasó y prerenderizó todas las rutas.

## 3. Matriz de cobertura de criterios

| Criterio de aceptación                                                                                            | Tipo de prueba                           | Archivo o evidencia                                                                      | Estado   | Observaciones                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La API lista categorías persistidas con ID y nombre, en orden estable.                                            | API automatizada y API/PostgreSQL manual | `apps/api/test/hu045-productos.spec.ts`; `GET /api/productos/categorias` en Docker       | Cubierto | Incluye la lista vacía y lectura pública sin sesión. La lectura real devolvió filas de `categoria_producto`.                                                      |
| El catálogo acepta filtros opcionales de categoría y nombre, y ambos se combinan con AND.                         | API automatizada y API/PostgreSQL manual | `apps/api/test/hu045-productos.spec.ts`; `GET /api/productos?categoriaId=1&nombre=arbol` | Cubierto | Se verifica categoría sola, texto solo, combinación y combinación sin coincidencias.                                                                              |
| La búsqueda es parcial, solo sobre nombre, e ignora mayúsculas, acentos y espacios redundantes.                   | API automatizada; API/PostgreSQL manual  | `apps/api/test/hu045-productos.spec.ts`; consulta HTTP `nombre="  croquetas   arbol  "`  | Cubierto | El test automatizado comprueba valores parametrizados y expresiones SQL; PostgreSQL encontró `Croquetas Árbol Norte` con `arbol` y espacios repetidos.            |
| Se mantienen filtros de producto activo, publicado y aliado activo; fotos publicadas y contrato ProductoCatalogo. | API automatizada; inspección SQL         | `apps/api/test/hu045-productos.spec.ts`; `productos.repository.ts`                       | Cubierto | Las filas de producto/aliado y fotos se prueban con fixture simulado; se verifica que stock cero no excluye el producto.                                          |
| Una búsqueda válida sin coincidencias responde 200 con `[]`; el texto vacío equivale a filtro omitido.            | API automatizada y API/PostgreSQL manual | `apps/api/test/hu045-productos.spec.ts`; `GET /api/productos?categoriaId=32767`          | Cubierto | El endpoint devolvió 200 y arreglo vacío para categoría sin coincidencias.                                                                                        |
| El parámetro de orden existente sigue funcionando junto con filtros.                                              | API automatizada                         | `apps/api/test/hu045-productos.spec.ts`                                                  | Cubierto | Se verifican `precio_asc` y `precio_desc`; orden y valores SQL usan lista blanca/parámetros.                                                                      |
| `categoriaId` y `orden` inválidos responden 400; errores de persistencia responden 500.                           | API automatizada y API/PostgreSQL manual | `apps/api/test/hu045-productos.spec.ts`                                                  | Cubierto | Se prueban IDs no numéricos, cero, negativos, fraccionarios y fuera del rango; se agregaron tres escenarios 500. La API real confirmó 400 para `categoriaId=abc`. |
| Swagger documenta las dos operaciones y sus parámetros.                                                           | Inspección de OpenAPI y decoradores      | `productos.controller.ts`; `/api/docs-json`                                              | Cubierto | OpenAPI declara `GET /api/productos/categorias` y los parámetros `orden`, `nombre` y `categoriaId` de `GET /api/productos`.                                       |

## 4. Pruebas implementadas o modificadas

| Archivo                                 | Tipo de prueba                    | Escenarios cubiertos                                                                        | Acción                                                  |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `apps/api/test/hu045-productos.spec.ts` | API con Supertest y base simulada | Se añadieron errores 500 al fallar la consulta de categorías, productos o fotos publicadas. | Modificado durante QA; el spec pasó de 14 a 17 pruebas. |

## 5. Resultados de ejecución

| Control                | Resultado     | Evidencia                                                                                                                                                                                                           |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato                | Aprobado      | `docker compose run --rm --no-deps api pnpm format:check` — todos los archivos usan Prettier.                                                                                                                       |
| Linting                | Aprobado      | `docker compose run --rm --no-deps api pnpm lint` — exit 0.                                                                                                                                                         |
| Tipado                 | Aprobado      | `docker compose run --rm --no-deps api pnpm typecheck` — shared, API, web y figma pasaron.                                                                                                                          |
| Build Backend          | Aprobado      | `docker compose build api` — compilación NestJS de API y shared pasó.                                                                                                                                               |
| Build workspace/CI     | Aprobado      | `docker compose -p veto-hu045-ci run --rm --no-deps api sh -lc "unset NODE_ENV && pnpm build"` — API, web y figma compilaron; Next.js prerenderizó las 20 rutas, incluida `/_global-error`.                         |
| Pruebas unitarias      | Aprobado      | `pnpm test`: shared 238 pruebas; web 9 pruebas.                                                                                                                                                                     |
| API HU-045             | Aprobado      | `apps/api/test/hu045-productos.spec.ts`: 17/17 pruebas; cobertura medida sobre componentes HU-045.                                                                                                                  |
| API/regresión Backend  | Aprobado      | Suite global: 32 suites y 567 pruebas API, 0 fallos.                                                                                                                                                                |
| PostgreSQL/migraciones | Aprobado      | Compose aislado completó migración y seed; `node db/test.mjs` terminó con `=== TODAS LAS PRUEBAS PASARON ===`.                                                                                                      |
| Verificación HTTP real | Aprobado      | Categorías 200, búsqueda parcial y filtros combinados 200, lista vacía 200, ID inválido 400; espacios redundantes y acento comprobados contra PostgreSQL.                                                           |
| CI remoto              | No verificado | No se consultó ni se disparó un workflow remoto. El workflow local sí se revisó en `.github/workflows/ci.yml`.                                                                                                      |
| CI local               | Aprobado      | Se ejecutaron en orden instalación congelada, formato, lint, tipos, migración, `db:test`, `pnpm test` y build. Se eliminó `NODE_ENV=development` solo en el comando de build para replicar el entorno del workflow. |

Durante pruebas globales aparecen mensajes de error esperados en pruebas que simulan fallos de Google, SMTP, base de datos y los nuevos errores 500 de HU-045. Las suites terminan aprobadas; esos logs no representan fallos de prueba.

## 6. Cobertura de código

Medida con Jest sobre `productos.controller.ts`, `productos.service.ts`, `productos.repository.ts` y `texto-busqueda.ts`, ejecutando el spec de HU-045:

| Métrica    | Cobertura |
| ---------- | --------: |
| Sentencias |      100% |
| Líneas     |      100% |
| Funciones  |      100% |
| Ramas      |      100% |

La cobertura indicada corresponde solo a esos cuatro componentes delimitados, no a todo el Backend. `apps/api/jest.config.js` no define umbrales de cobertura; no se inventó ni añadió uno.

## 7. Defectos encontrados

| ID        | Categoría                           | Descripción y evidencia                                                                                                                                                                                                               | Acción                                                                                                                                                                                                                             | Estado                                                      |
| --------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| QA-045-01 | Defecto de prueba                   | No se probaban las respuestas 500 previstas ante fallos de consultas del repositorio, aunque sí se documentan para ambos endpoints.                                                                                                   | Se añadieron tres casos HTTP en `apps/api/test/hu045-productos.spec.ts` para fallo de categorías, consulta principal de productos y consulta de fotos.                                                                             | Corregido; 17/17 pruebas HU-045 pasan.                      |
| QA-045-02 | Problema de entorno/ejecución local | Ejecutar `pnpm build` con `docker compose run ... api` hereda `NODE_ENV=development`, definido para el servicio de desarrollo. Next fallaba durante prerender con `useContext` nulo. El workflow CI no define `NODE_ENV=development`. | Se repitió el build del workspace con `NODE_ENV` sin definir, igual que en GitHub Actions; Next eligió producción, compiló API, web y figma y prerenderizó las 20 rutas. No se alteró la configuración de producto ni el workflow. | Resuelto en la validación local; no queda bloqueo de build. |

No se encontraron defectos funcionales de HU-045 en las pruebas ni en la comprobación contra PostgreSQL. No se observaron pruebas inestables en las ejecuciones realizadas.

## 8. Modificaciones realizadas durante QA

### Pruebas

- `apps/api/test/hu045-productos.spec.ts`: tres casos HTTP para errores 500 de las consultas de categorías, productos y fotos.

### Documentación de testing

- `docs/HUs/HU-045-reporte-testing.md`: este informe con trazabilidad, resultados, cobertura y diagnóstico.

No se modificaron controladores, servicios, repositorios, esquemas, modelos, migraciones, frontend ni configuración de CI durante esta fase QA. Los cambios funcionales de HU-045 existentes antes de QA se dejaron intactos.

## 9. Matriz de cumplimiento del DoD

| Elemento del DoD                                                               | Estado   | Evidencia                                                                            |
| ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------ |
| La API lista categorías canónicas desde `categoria_producto`.                  | Aprobado | Test de lista/array vacío y consulta HTTP real a PostgreSQL.                         |
| `GET /api/productos` combina categoría y nombre opcionales con AND.            | Aprobado | Casos automatizados aislados/combinados y prueba HTTP/PostgreSQL.                    |
| Búsqueda parcial insensible a mayúsculas/acentos, con espacios normalizados.   | Aprobado | Pruebas de API, inspección de SQL parametrizado y consulta real `croquetas   arbol`. |
| Conserva productos disponibles, respuesta ProductoCatalogo y fotos publicadas. | Aprobado | Prueba del contrato y predicados; el producto con stock cero aparece en API real.    |
| Devuelve 200 `[]` sin coincidencias e ignora el texto normalizado vacío.       | Aprobado | Suite HU-045 y consulta HTTP por categoría sin productos.                            |
| Conserva el orden y valida entradas inválidas.                                 | Aprobado | Casos de orden y validación; HTTP real devolvió 400 para ID inválido.                |
| Swagger documenta rutas, parámetros y respuestas.                              | Aprobado | Decoradores OpenAPI y documento `/api/docs-json`.                                    |
| Sin migración/índices redundantes.                                             | Aprobado | Inspección del repositorio y esquema existente; no se creó migración.                |

## 10. Resultado final

**APROBADA.** Los criterios y el DoD Backend de HU-045 están cubiertos. Pasaron sus 17 pruebas específicas, las 567 pruebas API globales, las 238 de shared, las 9 de web, los controles estáticos, las migraciones y pruebas SQL, la verificación con PostgreSQL y todas las etapas locales del workflow CI, incluido el build completo del workspace. El fallo inicial se debió a ejecutar el build desde el servicio Compose de desarrollo; al dejar `NODE_ENV` sin definir, igual que en CI, el build pasó.

El workflow remoto no se disparó ni se consultó. Los contenedores y la base de datos de QA fueron aislados del entorno local habitual y los contenedores se retiraron al final sin borrar volúmenes.
