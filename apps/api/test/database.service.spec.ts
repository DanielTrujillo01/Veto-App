import type { Pool } from 'pg';
import { DatabaseService } from '../src/database/database.service';

function crearPoolFalso() {
  const consultas: string[] = [];
  const parametros: unknown[][] = [];
  const client = {
    query: jest.fn(async (texto: string, valores?: unknown[]) => {
      consultas.push(texto);
      parametros.push(valores ?? []);
      return { rows: [] };
    }),
    release: jest.fn(),
  };
  const pool = { connect: jest.fn(async () => client), query: jest.fn(), end: jest.fn() };
  return { pool: pool as unknown as Pool, client, consultas, parametros };
}

describe('DatabaseService.withUser', () => {
  it('abre la transacción, fija app.usuario_id y confirma', async () => {
    const { pool, client, consultas, parametros } = crearPoolFalso();
    const db = new DatabaseService(pool);

    const resultado = await db.withUser('u-123', async () => 'ok');

    expect(resultado).toBe('ok');
    expect(consultas[0]).toBe('BEGIN');
    expect(consultas[1]).toContain("set_config('app.usuario_id'");
    expect(parametros[1]).toEqual(['u-123']);
    expect(consultas[consultas.length - 1]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('hace rollback y relanza el error si falla la operación', async () => {
    const { pool, client, consultas } = crearPoolFalso();
    const db = new DatabaseService(pool);

    await expect(
      db.withUser('u-123', async () => {
        throw new Error('falló');
      }),
    ).rejects.toThrow('falló');

    expect(consultas).toContain('ROLLBACK');
    expect(consultas).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('sin usuario fija un valor vacío (la base lo interpreta como "nadie")', async () => {
    const { pool, parametros } = crearPoolFalso();
    await new DatabaseService(pool).withUser(null, async () => undefined);
    expect(parametros[1]).toEqual(['']);
  });
});
