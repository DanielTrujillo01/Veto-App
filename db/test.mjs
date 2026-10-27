// Ejecuta db/tests/veto_pruebas.sql contra la base de datos (no deja datos: termina en ROLLBACK).
// Requiere haber corrido antes: pnpm db:migrate
import { readFileSync } from 'node:fs';
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
const client = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 10_000 });
client.on('notice', (aviso) => console.log(aviso.message));

await client.connect();
try {
  await client.query(readFileSync(join(aqui, 'tests', 'veto_pruebas.sql'), 'utf8'));
} catch (error) {
  console.error(`\n${error.message}`);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await client.end();
}
