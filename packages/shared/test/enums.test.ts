import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ENUMS_BASE_DE_DATOS } from '../src';

/** Lee las migraciones y reconstruye los valores de cada tipo ENUM. */
function enumsDeLasMigraciones(): Map<string, Set<string>> {
  const carpeta = join(__dirname, '..', '..', '..', 'db', 'migrations');
  const sql = readdirSync(carpeta)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(carpeta, f), 'utf8'))
    .join('\n');

  const tipos = new Map<string, Set<string>>();
  for (const m of sql.matchAll(/CREATE TYPE\s+(\w+)\s+AS ENUM\s*\(([^)]*)\)/gi)) {
    tipos.set(m[1], new Set([...m[2].matchAll(/'([^']*)'/g)].map((v) => v[1])));
  }
  const agregados = /ALTER TYPE\s+(\w+)\s+ADD VALUE(?: IF NOT EXISTS)?\s+'([^']*)'/gi;
  for (const m of sql.matchAll(agregados)) {
    tipos.get(m[1])?.add(m[2]);
  }
  return tipos;
}

describe('enums compartidos vs. migraciones', () => {
  const enDb = enumsDeLasMigraciones();

  it('la base de datos no tiene tipos ENUM que falten en @veto/shared', () => {
    expect([...enDb.keys()].sort()).toEqual(Object.keys(ENUMS_BASE_DE_DATOS).sort());
  });

  for (const [tipo, valores] of Object.entries(ENUMS_BASE_DE_DATOS)) {
    it(`${tipo} coincide con la base de datos`, () => {
      expect([...valores].sort()).toEqual([...(enDb.get(tipo) ?? [])].sort());
    });
  }
});
