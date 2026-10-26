import { resolve } from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema>;

/** Token de inyección para las variables de entorno ya validadas. */
export const ENV = Symbol('ENV');

/** Carga el .env de la raíz del monorepo (pnpm ejecuta los scripts desde apps/api). */
export function loadEnvFile(): void {
  try {
    process.loadEnvFile(resolve(process.cwd(), '../../.env'));
  } catch {
    // Sin .env: se usan las variables que ya estén en el entorno (por ejemplo, en CI).
  }
}

/** Valida las variables de entorno; falla al arrancar si falta algo. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const resultado = envSchema.safeParse(source);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }
  return resultado.data;
}
