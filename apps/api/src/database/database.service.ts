import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

export const PG_POOL = Symbol('PG_POOL');

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Consulta simple fuera de una transacción de usuario (lecturas públicas, health, etc.). */
  query<T extends QueryResultRow = QueryResultRow>(
    texto: string,
    valores?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(texto, valores);
  }

  /**
   * Ejecuta `fn` dentro de una transacción e informa a la base de datos quién actúa.
   *
   * La base necesita `app.usuario_id` para registrar quién cambió el estado de una cita,
   * pedido o solicitud, y para validar que solo el aliado finaliza una cita.
   * USAR SIEMPRE este método para escrituras hechas a nombre de un usuario.
   */
  async withUser<T>(usuarioId: string | null, fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // set_config(..., true) vale solo dentro de esta transacción (equivale a SET LOCAL).
      await client.query("SELECT set_config('app.usuario_id', $1, true)", [usuarioId ?? '']);
      const resultado = await fn(client);
      await client.query('COMMIT');
      return resultado;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
