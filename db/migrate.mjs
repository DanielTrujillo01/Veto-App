// Aplica las migraciones de db/migrations/*.sql en orden, una sola vez cada una.
// Uso: pnpm db:migrate   (lee DATABASE_URL del archivo .env en la raíz)
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const aqui = dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(join(aqui, '..', '.env'));
} catch {
  // Sin .env: se usan las variables del entorno (por ejemplo, en CI).
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL. Configúrala en el archivo .env de la raíz o en el entorno.');
  process.exit(1);
}
const ssl = url.includes('.supabase.co') ? { rejectUnauthorized: false } : undefined;
const carpeta = join(aqui, 'migrations');
const archivos = readdirSync(carpeta)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const client = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 10_000 });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      nombre      text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);
  const { rows } = await client.query('SELECT nombre FROM public.schema_migrations');
  const aplicadas = new Set(rows.map((r) => r.nombre));

  let nuevas = 0;
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    process.stdout.write(`Aplicando ${archivo} ... `);
    await client.query('BEGIN');
    try {
      await client.query(readFileSync(join(carpeta, archivo), 'utf8'));
      await client.query('INSERT INTO public.schema_migrations (nombre) VALUES ($1)', [archivo]);
      await client.query('COMMIT');
      console.log('listo');
      nuevas++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.log('ERROR');
      throw error;
    }
  }
  console.log(nuevas === 0 ? 'La base ya estaba al día.' : `${nuevas} migración(es) aplicada(s).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
