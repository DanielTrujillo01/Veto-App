# Local Veto monorepo images. Targets: api, web and figma.
FROM node:22-bookworm-slim AS workspace
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate

# Cache dependencies until one of the workspace manifests or lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY frontend/web/package.json ./frontend/web/package.json
COPY frontend/figma/package.json ./frontend/figma/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @veto/shared build

FROM workspace AS api
RUN pnpm --filter @veto/api build
EXPOSE 3001
CMD ["node", "docker/api-entrypoint.mjs"]

FROM workspace AS web
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @veto/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@veto/web", "start"]

FROM workspace AS figma
RUN pnpm --filter @veto/figma build
EXPOSE 8443
CMD ["pnpm", "--filter", "@veto/figma", "exec", "vite", "--host", "0.0.0.0", "--port", "8443"]
