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

const url = process.env.DATABASE_URL ?? 'postgres://veto:veto@localhost:5440/veto';
const client = new pg.Client({ connectionString: url });
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
