## Historia de usuario

HU-___ — (título)

## Qué cambia

<!-- Resumen corto de lo que hiciste y por qué. -->

## Cómo probarlo

<!-- Pasos para ver que funciona. Capturas si hay cambios visuales. -->

## Lista de verificación

- [ ] Cumple todos los criterios de aceptación (DoD) de la historia
- [ ] Hay pruebas nuevas o actualizadas
- [ ] `pnpm lint`, `pnpm typecheck` y `pnpm test` pasan en local
- [ ] Si toca la base de datos: nueva migración en `db/migrations/` (no edité una ya aplicada) y `pnpm db:test` pasa
- [ ] Si toca la API: los endpoints validan la entrada con `@veto/shared` y comprueban rol y pertenencia
- [ ] Si escribe a nombre de un usuario: usa `DatabaseService.withUser(...)`
- [ ] Actualicé la documentación si hacía falta
