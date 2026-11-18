# HU-024 – Reporte de auditoría de testing

## 1. Identificación

- Historia: HU-024 – Inicio con búsqueda y accesos a catálogos (Backend).
- Especificación relacionada: docs/HUs/HU-024 – Inicio con búsqueda por aliado y accesos a catálogos.md. Contiene una ruta antigua propuesta; se contrastó con código e inventario actual.
- Documento de tareas relacionado: no se encontró HU-024-tareas-taiga.md en este checkout.
- Fecha: 2026-11-16.
- Rama: dev/Jhonier.
- Commit: 0e18f64.
- Entorno: Windows, PowerShell, workspace pnpm.
- Herramientas: Jest/Supertest declarados, Prettier, ESLint, TypeScript, Nest CLI y GitHub Actions.

## 2. Resumen de la auditoría

La implementación declara GET /api/aliados/busqueda/nombre, protege la ruta con sesión y rol TUTOR, valida el query con @veto/shared, compara con igualdad y COLLATE "C", filtra aliados ACTIVO de tipos CLINICA, VET_INDEPENDIENTE y TIENDA, y limita la consulta a 10. El inventario docs/prompts/context/api-backend.md refleja esa ruta; la especificación individual disponible está desactualizada y propone /api/aliados/busqueda?nombre=....

Se encontró apps/api/test/hu024-busqueda-aliados.spec.ts, con escenarios de búsqueda, respuesta vacía, validación, falta de sesión y rol no autorizado. Usa la app Nest y Supertest, pero simula DatabaseService: verifica SQL y parámetros, no el comportamiento efectivo de PostgreSQL. Se añadió un caso de regresión para comprobar que texto con sintaxis SQL viaja como parámetro separado y que la consulta conserva filtros, proyección y límite.

La suite no pudo arrancar porque Jest no está disponible. La instalación con lockfile falló en descargas por UNABLE_TO_VERIFY_LEAF_SIGNATURE. El lint global y el formato dirigido de la prueba pasaron; el formato global reportó siete documentos. Tipado y builds quedaron bloqueados por dependencias ausentes. No se modificó la lógica funcional.

## 3. Matriz de cobertura de criterios

| Criterio                                                                | Tipo                         | Archivo                                      | Estado                | Observaciones                                                               |
| ----------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| Sesión de tutor; 401 sin sesión y 403 para otro rol                     | API/Nest + Supertest         | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Casos escritos, no ejecutados.                                              |
| Query ausente, vacío o solo espacios devuelve 400 y no consulta aliados | API/Nest + Supertest         | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Incluye 3 valores parametrizados; no ejecutado.                             |
| Coincidencia exacta sensible a mayúsculas y acentos                     | API e inspección SQL         | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Se verifica igualdad y COLLATE "C"; falta ejercicio contra PostgreSQL real. |
| Filtra estado ACTIVO y tipos permitidos, excluye fundaciones            | API e inspección SQL         | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Se comprueban predicados/parámetros, pero el mock no evalúa filas reales.   |
| Máximo 10, sin paginación; respuesta id/nombre/tipo, sin contacto       | API e inspección SQL         | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Se verifica LIMIT y valor 10; sin consulta real.                            |
| Sin resultados responde 200 []                                          | API/Nest + Supertest         | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Caso escrito, no ejecutado.                                                 |
| El texto de búsqueda no altera el SQL                                   | API/inspección de parámetros | apps/api/test/hu024-busqueda-aliados.spec.ts | Parcial               | Se añadió caso con entrada de apariencia SQL; ejecución pendiente.          |
| Operación de lectura; sin cambios de persistencia                       | Inspección técnica           | AliadosService y migración 0001              | Inspección comprobada | El servicio usa SELECT; no hay escrituras ni migración HU-024.              |

## 4. Pruebas implementadas o modificadas

| Archivo                                      | Tipo                             | Escenarios                                        | Acción                              |
| -------------------------------------------- | -------------------------------- | ------------------------------------------------- | ----------------------------------- |
| apps/api/test/hu024-busqueda-aliados.spec.ts | API con DatabaseService simulado | Parametrización, filtros SQL, proyección y límite | Modificado; nuevo caso no ejecutado |

## 5. Resultados de ejecución

| Control                   | Resultado     | Evidencia                                                                                                                                                           |
| ------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prettier dirigido         | Aprobado      | node_modules/.bin/prettier --check apps/api/test/hu024-busqueda-aliados.spec.ts; exit 0 tras el cambio.                                                             |
| Prettier global           | Fallido       | corepack pnpm format:check; reporta 7 documentos: HU-024 existente y documentos en docs/prompts/context, docs/prompts/HUs y docs/prompts/test. No se reformatearon. |
| ESLint                    | Aprobado      | corepack pnpm lint; exit 0.                                                                                                                                         |
| Typecheck API             | Bloqueado     | corepack pnpm --filter @veto/api typecheck; TS2688 para tipos jest y node.                                                                                          |
| Build shared              | Bloqueado     | corepack pnpm --filter @veto/shared build; TS2688 para tipos node.                                                                                                  |
| Build API                 | Bloqueado     | corepack pnpm --filter @veto/api build; Nest CLI nest no disponible.                                                                                                |
| Unitarias                 | Bloqueado     | No se inició Jest; no se encontró suite unitaria independiente de esta consulta.                                                                                    |
| API/integración HU-024    | Bloqueado     | La suite no inició: jest no reconocido.                                                                                                                             |
| Cobertura                 | No obtenida   | Runner ausente; no se encontró umbral configurado en las búsquedas de configuración.                                                                                |
| Migraciones y pruebas SQL | No ejecutadas | La HU es de lectura; no se inició una base usando DATABASE_URL del entorno.                                                                                         |
| CI local                  | Parcial       | El workflow contempla install, formato, lint, tipos, migración, pruebas DB, tests y build; la ejecución completa quedó bloqueada.                                   |
| CI remoto                 | No verificado | No se consultó ni disparó workflow remoto.                                                                                                                          |

Instalación intentada: corepack pnpm install --frozen-lockfile. La resolución del lockfile ocurrió, pero varios tarballs no se descargaron por UNABLE_TO_VERIFY_LEAF_SIGNATURE. Jest, definiciones de tipos y Nest CLI siguieron ausentes.

El archivo declara 8 invocaciones incluyendo los tres casos parametrizados de it.each. Ejecución: 0 aprobadas, 0 fallidas, 0 omitidas y 8 sin ejecutar; no hay duración ni reporte Jest porque el proceso de pruebas no arrancó.

## 6. Cobertura de código

- Líneas, funciones y ramas: no disponible; Jest no arrancó.
- Componentes HU-024: prueba de API inspecciona controller/service/schema de manera indirecta, sin cobertura ejecutable.
- Umbral: no encontrado en las configuraciones revisadas.
- Cumplimiento del umbral: indeterminable.

## 7. Defectos encontrados

| ID         | Categoría           | Componente             | Evidencia                                                                                                      | Acción/estado                                                                                            |
| ---------- | ------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| QA-ENV-01  | Problema de entorno | Dependencias workspace | Instalación falló en descargas con UNABLE_TO_VERIFY_LEAF_SIGNATURE; Jest, tipos Node/Jest y Nest CLI ausentes. | Pendiente de restaurar confianza TLS/acceso al registry o instalar dependencias desde entorno confiable. |
| QA-QUAL-01 | Problema de calidad | Documentos existentes  | format:check señala 7 documentos.                                                                              | No corregido; fuera de archivos de prueba autorizados y ajeno a cambios de HU-024.                       |
| QA-IMPL-01 | Defecto funcional   | Ninguno confirmado     | La inspección estática no reprodujo incumplimiento. No se pudo verificar runtime ni PostgreSQL.                | Sin defecto confirmado; HU no aprobada por falta de ejecución.                                           |

## 8. Modificaciones realizadas

- Pruebas: apps/api/test/hu024-busqueda-aliados.spec.ts; caso de parametrización y predicados.
- Fixtures/helpers: ninguno.
- Scripts/configuración de testing: ninguno.
- CI: ninguno.
- Documentación de testing: este informe; no se editó documentación preexistente.

## 9. Matriz de cumplimiento del DoD

| Elemento                                            | Estado                | Evidencia                                                               |
| --------------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| Endpoint Swagger y respuesta mínima                 | Inspección comprobada | Controller y SELECT del servicio.                                       |
| Sesión/rol tutor y errores de validación            | Parcial               | Guardias y schema inspeccionados; suite no ejecutada.                   |
| Igualdad exacta sensible a mayúsculas/acentos       | Parcial               | SQL inspeccionado y cláusula esperada en prueba; falta PostgreSQL real. |
| Filtros, límite 10, sin paginación y campos mínimos | Parcial               | Código inspeccionado y asserts escritos; ejecución bloqueada.           |
| Pruebas de éxito, vacío, inválidos y permisos       | Parcial               | Casos presentes en el archivo; no ejecutados.                           |

## 10. Resultado final

BLOQUEADA. No corresponde aprobar HU-024 sin ejecutar la suite, obtener cobertura y completar tipos/build/CI. No hay defecto funcional demostrado. El siguiente paso es restablecer acceso confiable al registry, instalar con pnpm-lock.yaml y correr la suite y el pipeline en entorno de pruebas aislado; después, verificar comparación/filtros contra PostgreSQL. CI remoto no verificado.

No se modificó lógica funcional ni archivos de Frontend.
