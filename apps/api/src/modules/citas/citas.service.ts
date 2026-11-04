import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';

/**
 * Operaciones sobre citas que otros módulos necesitan. Reciben el `client` de la transacción
 * abierta con `DatabaseService.withUser` para que todo ocurra en la misma transacción.
 */
@Injectable()
export class CitasService {
  /** HU-006: al eliminar la cuenta se cancelan sus citas futuras (el trigger registra el historial). */
  async cancelarFuturasDelTutor(client: PoolClient, tutorId: string): Promise<number> {
    const resultado = await client.query(
      `UPDATE cita SET estado = 'CANCELADA'
        WHERE tutor_id = $1 AND estado = 'AGENDADA' AND inicio > now()`,
      [tutorId],
    );
    return resultado.rowCount ?? 0;
  }

  /** HU-018: indica si un servicio ya tiene citas (de cualquier estado). */
  async servicioTieneCitas(client: PoolClient, servicioId: string): Promise<boolean> {
    const resultado = await client.query(
      'SELECT EXISTS (SELECT 1 FROM cita WHERE servicio_id = $1) AS tiene',
      [servicioId],
    );
    return Boolean(resultado.rows[0]?.tiene);
  }
}
