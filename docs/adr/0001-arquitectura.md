# ADR 0001 · Arquitectura y estructura del repositorio

**Estado:** aceptada

## Contexto

Equipo de 6 personas, 4 sprints de 2 semanas, 55 historias esenciales. Aplicación web responsive
con roles (tutor, aliado, veterinario, Equipo Veto), agendamiento, pedidos, adopción y reportes.
La base de datos ya está modelada en PostgreSQL con reglas en triggers y restricciones.

## Decisiones

1. **Monolito modular**, no microservicios. Un solo despliegue de API; los módulos de dominio
   (`apps/api/src/modules/*`) se separan por tablas propias y no se tocan entre sí. Si un módulo
   necesita escalar aparte, se extrae después.
2. **Monorepo** con pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`, más `db/` y `docs/`.
   Un cambio que toca base de datos, API y pantalla va en un solo pull request.
3. **TypeScript en todo el stack.** Web: Next.js (React) + Tailwind. API: NestJS.
   Validaciones y tipos compartidos en `@veto/shared` (Zod).
4. **PostgreSQL con migraciones en SQL puro** (`db/migrations`). El esquema usa triggers,
   restricciones de exclusión y columnas calculadas que un ORM no modela bien, así que el SQL es la
   fuente de verdad y el código accede con `pg` directamente.
5. **Contrato OpenAPI** (`/api/docs`) entre API y web. La web solo habla con la API por HTTP; nunca
   importa código del backend.
6. **Escrituras a nombre de un usuario** siempre con `DatabaseService.withUser`, para que la base
   registre quién actuó (`app.usuario_id`).

## Qué se evita a propósito (por ahora)

Microservicios, GraphQL, Kubernetes, Redis, colas de mensajes y bases NoSQL: ninguna historia
esencial los necesita. Si vuelven las historias condicionales (correos, recordatorios), se evalúa
una cola de trabajos sobre el mismo PostgreSQL.

## Cuándo revisar esta decisión

- Aparece una app móvil o un segundo equipo con ritmo de entrega distinto → separar repos o
  agregar `apps/mobile`.
- Un módulo (calendario, notificaciones, búsqueda) se vuelve cuello de botella → extraerlo.
