import { readFileSync } from 'node:fs';
import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('Falta DATABASE_URL; el seed solo debe ejecutarse desde Docker Compose local.');
}

const databaseUrl = new URL(connectionString);
if (databaseUrl.hostname !== 'db' || databaseUrl.pathname !== '/veto') {
  throw new Error('Seed cancelado: solo se permite contra la base local del servicio Compose db.');
}

const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
await client.connect();

try {
  await client.query('BEGIN');
  await client.query('SET LOCAL search_path TO veto, public');
  const sql = readFileSync(new URL('./seeds/local-demo.sql', import.meta.url), 'utf8').replace(
    /^\uFEFF/,
    '',
  );
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Datos locales de demostración listos.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('No se pudo cargar el seed local:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
