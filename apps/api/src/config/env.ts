import { resolve } from 'node:path';
import { z } from 'zod';

/** Una variable vacía (`GOOGLE_CLIENT_ID=`) se trata como no configurada. */
const opcional = z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  // HU-003 (opcional): sin estas dos variables el inicio de sesión con Google queda desactivado.
  GOOGLE_CLIENT_ID: opcional,
  GOOGLE_CLIENT_SECRET: opcional,
  /** URL de retorno registrada en Google; por defecto, el callback de esta API en localhost. */
  GOOGLE_REDIRECT_URI: opcional,
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
