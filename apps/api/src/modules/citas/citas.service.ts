import { Injectable } from '@nestjs/common';
import { MINUTOS_VIGENCIA_SELECCION } from '@veto/shared';
import type { PoolClient } from 'pg';
import type { Consultor } from '../../database/database.service';

/**
 * Operaciones sobre citas que otros módulos necesitan. Reciben el `client` de la transacción
 * abierta con `DatabaseService.withUser` para que todo ocurra en la misma transacción.
 */
@Injectable()
export class CitasService {
  /** HU-006: al eliminar la cuenta se cancelan sus citas futuras, confirmadas o pendientes (el trigger registra el historial). */
  async cancelarFuturasDelTutor(client: PoolClient, tutorId: string): Promise<number> {
    const resultado = await client.query(
      `UPDATE cita SET estado = 'CANCELADA'
        WHERE tutor_id = $1 AND estado IN ('PENDIENTE', 'AGENDADA') AND inicio > now()`,
      [tutorId],
    );
    return resultado.rowCount ?? 0;
  }

  /**
   * HU-022: citas vigentes (PENDIENTE o AGENDADA) de un veterinario que se cruzan con
   * [inicio, fin). Sirve para avisar qué hay que reprogramar antes de bloquear ese intervalo.
   */
  async vigentesEnIntervalo(
    client: Consultor,
    veterinarioId: string,
    inicio: string,
    fin: string,
  ): Promise<{ id: string; inicio: string; fin: string; estado: string }[]> {
    const r = await client.query<{
      id: string;
      inicio: Date | string;
      fin: Date | string;
      estado: string;
    }>(
      `SELECT id, inicio, fin, estado FROM cita
        WHERE veterinario_id = $1 AND estado IN ('PENDIENTE', 'AGENDADA')
          AND tstzrange(inicio, fin) && tstzrange($2::timestamptz, $3::timestamptz)
        ORDER BY inicio`,
      [veterinarioId, inicio, fin],
    );
    return r.rows.map((c) => ({
      id: c.id,
      inicio: new Date(c.inicio).toISOString(),
      fin: new Date(c.fin).toISOString(),
      estado: c.estado,
    }));
  }

  /**
   * HU-022: espacios ocupados (citas PENDIENTE o AGENDADA que no terminaron) de varios
   * veterinarios entre dos fechas de calendario, ambas incluidas. El calendario del tutor
   * descuenta estos intervalos de la atención.
   */
  async ocupadosEntre(
    client: Consultor,
    veterinarioIds: string[],
    desde: string,
    hasta: string,
  ): Promise<{ veterinarioId: string; inicio: string; fin: string }[]> {
    if (veterinarioIds.length === 0) return [];
    const r = await client.query<{
      veterinario_id: string;
      inicio: Date | string;
      fin: Date | string;
    }>(
      `SELECT veterinario_id, inicio, fin FROM cita
        WHERE veterinario_id = ANY($1::uuid[]) AND estado IN ('PENDIENTE', 'AGENDADA')
          AND fin > $2::date::timestamptz AND inicio < ($3::date + 1)::timestamptz`,
      [veterinarioIds, desde, hasta],
    );
    return r.rows.map((c) => ({
      veterinarioId: c.veterinario_id,
      inicio: new Date(c.inicio).toISOString(),
      fin: new Date(c.fin).toISOString(),
    }));
  }

  /**
   * HU-029: guarda la fecha y hora que el tutor eligió (una por tutor: elegir otra reemplaza la
   * anterior) y la conserva `MINUTOS_VIGENCIA_SELECCION` minutos. No reserva el espacio: eso lo
   * hace la creación de la cita (HU-031). Quien llama ya comprobó que el espacio está libre.
   */
  async guardarSeleccion(
    client: PoolClient,
    datos: {
      tutorId: string;
      aliadoId: string;
      servicioId: string;
      veterinarioId: string;
      inicio: string;
      fin: string;
    },
  ): Promise<{ venceEn: string }> {
    const r = await client.query<{ expira_en: Date | string }>(
      `INSERT INTO seleccion_horario
              (tutor_id, aliado_id, servicio_id, veterinario_id, inicio, fin, actualizado_en, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now() + make_interval(mins => $7))
       ON CONFLICT (tutor_id) DO UPDATE
          SET aliado_id = EXCLUDED.aliado_id, servicio_id = EXCLUDED.servicio_id,
              veterinario_id = EXCLUDED.veterinario_id, inicio = EXCLUDED.inicio,
              fin = EXCLUDED.fin, actualizado_en = EXCLUDED.actualizado_en,
              expira_en = EXCLUDED.expira_en
       RETURNING expira_en`,
      [
        datos.tutorId,
        datos.aliadoId,
        datos.servicioId,
        datos.veterinarioId,
        datos.inicio,
        datos.fin,
        MINUTOS_VIGENCIA_SELECCION,
      ],
    );
    return { venceEn: new Date(r.rows[0].expira_en).toISOString() };
  }

  /** HU-029: la selección de fecha y hora del tutor, o `null` si no tiene o ya venció. */
  async obtenerSeleccion(
    client: Consultor,
    tutorId: string,
  ): Promise<{
    aliadoId: string;
    servicioId: string;
    veterinarioId: string;
    inicio: string;
    fin: string;
    venceEn: string;
  } | null> {
    const r = await client.query<{
      aliado_id: string;
      servicio_id: string;
      veterinario_id: string;
      inicio: Date | string;
      fin: Date | string;
      expira_en: Date | string;
    }>(
      `SELECT aliado_id, servicio_id, veterinario_id, inicio, fin, expira_en
         FROM seleccion_horario WHERE tutor_id = $1 AND expira_en > now()`,
      [tutorId],
    );
    const fila = r.rows[0];
    if (!fila) return null;
    return {
      aliadoId: fila.aliado_id,
      servicioId: fila.servicio_id,
      veterinarioId: fila.veterinario_id,
      inicio: new Date(fila.inicio).toISOString(),
      fin: new Date(fila.fin).toISOString(),
      venceEn: new Date(fila.expira_en).toISOString(),
    };
  }

  /** HU-029: descarta la selección del tutor (no falla si no tenía). */
  async eliminarSeleccion(client: PoolClient, tutorId: string): Promise<void> {
    await client.query('DELETE FROM seleccion_horario WHERE tutor_id = $1', [tutorId]);
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
