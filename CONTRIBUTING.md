# Guía de contribución

## Ramas

- `main` está protegida: nada se sube directo, todo entra por pull request con al menos una
  aprobación y el CI en verde.
- Una rama por historia, corta y con el número de la historia:

  ```
  feat/HU-031-reservar-cita
  fix/HU-032-finalizar-cita-sin-permiso
  chore/ci-cache
  docs/modelo-de-datos
  ```

- Parte siempre de `main` actualizada y vuelve a integrarla seguido (`git pull --rebase origin main`).

## Commits

Formato [Conventional Commits](https://www.conventionalcommits.org/es/), en español, con la
historia cuando aplique:

```
feat(citas): permite reservar una cita (HU-031)
fix(clinica): bloquea la edición de una consulta cerrada (HU-042)
docs: agrega el diagrama del módulo de adopción
```

Tipos: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`.

## Pull requests

1. Un pull request por historia (si es muy grande, divídela en partes que se puedan mezclar solas).
2. Completa la plantilla: historia, cómo probarlo y la lista de verificación.
3. Antes de abrirlo, en local: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`.
   Si tocaste la base de datos: `pnpm db:migrate && pnpm db:test`.
4. Pide revisión; quien revisa comprueba los criterios de aceptación (DoD) de la historia.
5. Se mezcla con _squash_ para mantener un commit por historia en `main`.

## Cómo agregar cosas

**Un endpoint nuevo** (en el módulo dueño de la tabla):

1. Esquema de entrada en `packages/shared/src/` (Zod) y expórtalo en `index.ts`.
2. Controller + service + repository en `apps/api/src/modules/<módulo>/`.
3. Valida la entrada con el esquema; comprueba rol y pertenencia.
4. Si escribe a nombre de un usuario, usa `DatabaseService.withUser`.
5. Anótalo con los decoradores de `@nestjs/swagger` para que aparezca en `/api/docs`.
6. Pruebas en `apps/api/test/`.

**Una pantalla nueva:** carpeta en `apps/web/src/app/<ruta>/page.tsx`; las llamadas a la API van por
`apps/web/src/lib/api.ts` y los formularios validan con los mismos esquemas de `@veto/shared`.

**Un cambio en la base de datos:** una migración nueva en `db/migrations/` (ver el README).

## Estilo

- El formato lo decide Prettier (`pnpm format`); no se discute en las revisiones.
- Nombres de tablas, columnas y enums en español, igual que en el modelo de datos.
- Los cambios de arquitectura relevantes se registran como un ADR nuevo en `docs/adr/`.
