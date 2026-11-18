# Veto monorepo

The repository is a pnpm workspace. Keep application code under `frontend/` and `apps/`, shared
contracts in `packages/shared/`, and backend persistence in `db/`.

## Frontend applications

- `frontend/web/` is the production Next.js application.
- `frontend/figma/` is the React + Vite Figma Make prototype.
- `frontend/figma/src/App.tsx` is the prototype entry component.
- `frontend/figma/src/Inicio.tsx` contains the tutor landing page.
- `frontend/figma/src/Layouts.tsx` contains the public, authentication, and partner layout previews.
- `frontend/figma/src/DesignSystem.tsx` contains the brand and component guide.
- `frontend/figma/src/index.css` contains the prototype's tokens and styles.

The Figma Make Vite server runs on port 8443. Use the existing workspace scripts instead of starting
a second preview server.

## Styling

Use the Veto color, typography, and radius tokens already defined in the relevant frontend app.
Keep global element defaults in Tailwind's base layer so utility classes remain effective. Prefer
existing components over adding duplicate patterns.
