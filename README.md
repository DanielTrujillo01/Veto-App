# Veto

Plataforma web que conecta a tutores de mascotas con clínicas veterinarias, veterinarios
independientes, tiendas y fundaciones: búsqueda y agendamiento de servicios, compra de productos,
registro de consulta clínica, adopción y administración por el Equipo Veto.

> **Estado:** esqueleto del proyecto. Ya funcionan: el monorepo, la base de datos con sus reglas,
> la API con conexión a la base (`/api/health`, documentación OpenAPI), la web con la pantalla de
> inicio y el CI. Las historias de usuario se implementan sobre esta base, sprint a sprint.

## Tecnologías

| Parte         | Tecnología                                                          |
| ------------- | ------------------------------------------------------------------- |
| Web           | Next.js 16 (React 19), TypeScript, Tailwind CSS 4                   |
| API           | NestJS 11, TypeScript, documentación OpenAPI (Swagger)              |
| Base de datos | PostgreSQL 17, migraciones en SQL                                   |
| Compartido    | Esquemas de validación con Zod (`@veto/shared`)                     |
| Calidad       | ESLint, Prettier, Jest (API), Vitest (web y shared), GitHub Actions |
| Monorepo      | pnpm workspaces                                                     |

La justificación de estas decisiones está en [`docs/adr/0001-arquitectura.md`](docs/adr/0001-arquitectura.md).

## Requisitos

- **Node.js 22** o superior (`node --version`). Si usas nvm: `nvm use` (hay un `.nvmrc`).
- **pnpm 10**. Si no lo tienes, activa corepack (viene con Node):
  ```bash
  corepack enable
  ```
  o instálalo con `npm install -g pnpm@10`.
- **Docker Desktop** (para la base de datos). Debe estar abierto antes de `pnpm db:up`.
- **Git**.

## Puesta en marcha

```bash
# 1. Variables de entorno
cp .env.example .env              # en PowerShell: Copy-Item .env.example .env

# 2. Dependencias
pnpm install

# 3. Base de datos (PostgreSQL en Docker) y su esquema
pnpm db:up
pnpm db:migrate

# 4. Todo en modo desarrollo (shared + API + web)
pnpm dev
```

Cuando termine de arrancar:

| Servicio                          | URL                                                   |
| --------------------------------- | ----------------------------------------------------- |
| Web                               | http://localhost:3000                                 |
| API                               | http://localhost:3001/api/health                      |
| Documentación de la API (OpenAPI) | http://localhost:3001/api/docs                        |
| PostgreSQL                        | `localhost:5440` (usuario, contraseña y base: `veto`) |

> El puerto de la base es **5440**, no 5432, para que no choque con un PostgreSQL que ya tengas
> instalado en tu equipo.

Si tu API no corre en el puerto 3001, copia `apps/web/.env.example` a `apps/web/.env.local` y
ajusta `NEXT_PUBLIC_API_URL`.

## Comandos

Se ejecutan desde la raíz del repositorio.

| Comando                             | Qué hace                                                          |
| ----------------------------------- | ----------------------------------------------------------------- |
| `pnpm dev`                          | Arranca shared (en vigilancia), API y web con recarga en caliente |
| `pnpm build`                        | Compila shared, API y web                                         |
| `pnpm test`                         | Corre todas las pruebas (shared, API y web)                       |
| `pnpm lint`                         | ESLint sobre todo el repositorio                                  |
| `pnpm typecheck`                    | Revisa los tipos de todos los paquetes                            |
| `pnpm format` / `pnpm format:check` | Aplica / verifica el formato con Prettier                         |
| `pnpm db:up` / `pnpm db:down`       | Levanta / detiene la base de datos                                |
| `pnpm db:migrate`                   | Aplica las migraciones pendientes                                 |
| `pnpm db:test`                      | Corre las pruebas de las reglas de la base de datos               |
| `pnpm db:reset`                     | **Borra** la base de datos local y la recrea desde cero           |

Para un solo paquete: `pnpm --filter @veto/api test`, `pnpm --filter @veto/web dev`, etc.

## Estructura del repositorio

```
veto/
├─ apps/
│  ├─ api/                 API (NestJS)
│  │  ├─ src/
│  │  │  ├─ modules/       un módulo por dominio (ver su README)
│  │  │  ├─ database/      conexión a PostgreSQL y withUser()
│  │  │  ├─ config/        variables de entorno validadas
│  │  │  └─ health/        GET /api/health
│  │  └─ test/
│  └─ web/                 Web (Next.js)
│     └─ src/
│        ├─ app/           páginas (App Router)
│        ├─ components/
│        └─ lib/           cliente de la API, utilidades
├─ packages/
│  └─ shared/              esquemas Zod y tipos compartidos (sin lógica de negocio)
├─ db/
│  ├─ migrations/          SQL numerado; 0001_baseline.sql es el modelo completo
│  ├─ tests/               veto_pruebas.sql: pruebas de las reglas de la base
│  ├─ seeds/               datos de ejemplo para desarrollo
│  ├─ migrate.mjs          aplica migraciones
│  └─ test.mjs             corre las pruebas SQL
├─ docs/                   modelo de datos, diagramas ER, decisiones (ADR)
├─ .github/                CI, plantilla de pull request, CODEOWNERS
├─ docker-compose.yml      PostgreSQL para desarrollo
└─ .env.example
```

## Base de datos

El modelo cubre las 55 historias esenciales del backlog: 25 tablas, 4 vistas y las reglas de
negocio principales hechas en la propia base (citas sin solapamiento, consulta clínica inmutable
al cerrarse, stock de pedidos, etc.). Documentación y diagramas:

- [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md): decisiones, reglas y supuestos
- [`docs/diagramas_er.html`](docs/diagramas_er.html): diagramas entidad-relación (ábrelo en el navegador)

**Cambiar el esquema:**

1. Crea un archivo nuevo en `db/migrations/`, con el siguiente número: `0002_descripcion.sql`.
2. **Nunca edites una migración que ya se aplicó** (ni una que ya esté en `main`): crea otra.
3. Si agregas o cambias un tipo ENUM, actualiza `packages/shared/src/enums.ts`; una prueba falla si
   no coinciden.
4. Corre `pnpm db:migrate` y `pnpm db:test`. Agrega casos a `db/tests/veto_pruebas.sql` si creas una
   regla nueva.

**Quién hizo el cambio.** Varias reglas dependen de saber qué usuario actúa (por ejemplo, "solo el
aliado finaliza la cita" y el historial de estados). Para eso, toda escritura hecha a nombre de un
usuario debe pasar por:

```ts
await this.db.withUser(usuarioId, async (client) => {
  await client.query('UPDATE veto.cita SET estado = $1 WHERE id = $2', ['FINALIZADA', citaId]);
});
```

`withUser` abre una transacción y fija `app.usuario_id` solo para esa transacción.

## API

- Prefijo `/api`. Documentación interactiva en `/api/docs`; ese contrato es el que consume la web.
- Un módulo por dominio en `apps/api/src/modules/` (identidad, aliados, mascotas, servicios, citas,
  clínica, comercio, adopción, admin, reportes, notificaciones). Cada uno es dueño de sus tablas;
  las reglas están en [`apps/api/src/modules/README.md`](apps/api/src/modules/README.md).
- Valida la entrada con los esquemas de `@veto/shared` y comprueba rol y pertenencia en cada
  endpoint.

## Web

- Next.js con App Router. Los colores viven como variables en `apps/web/src/app/globals.css`;
  cambiar la identidad visual es editar ese bloque.
- Toda llamada al backend pasa por `apps/web/src/lib/api.ts`.

## Paquete compartido (`@veto/shared`)

Tipos y validaciones usados por la API y la web: formularios con las mismas reglas en ambos lados.
Se compila a `dist/`; `pnpm dev`, `pnpm test` y `pnpm build` lo compilan solos. Si tu editor dice
que no encuentra `@veto/shared`, corre `pnpm build:shared`.

## Flujo de trabajo del equipo

Ramas, commits, pull requests y revisión: ver [`CONTRIBUTING.md`](CONTRIBUTING.md).

En cada pull request, el CI (GitHub Actions) levanta un PostgreSQL, aplica las migraciones, corre las
pruebas de la base y del código, y compila todo. Si falla, no se mezcla.

## Solución de problemas

| Síntoma                                                      | Causa y solución                                                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `pnpm: command not found`                                    | Corre `corepack enable` o `npm install -g pnpm@10`                                         |
| `pnpm db:up` falla con "cannot connect to the Docker daemon" | Abre Docker Desktop y espera a que inicie                                                  |
| `port is already allocated` (5440, 3000 o 3001)              | Otro programa usa ese puerto. Ciérralo o cambia el puerto en `.env` / `docker-compose.yml` |
| La API arranca y dice `Variables de entorno inválidas`       | Falta el archivo `.env`: `cp .env.example .env`                                            |
| `/api/health` responde 503                                   | La base no está arriba o no se migró: `pnpm db:up && pnpm db:migrate`                      |
| `relation "veto.…" does not exist`                           | Falta aplicar migraciones: `pnpm db:migrate`                                               |
| `Cannot find module '@veto/shared'`                          | Falta compilar el paquete: `pnpm build:shared`                                             |
| Quieres empezar con la base limpia                           | `pnpm db:reset` (borra todos los datos locales)                                            |
