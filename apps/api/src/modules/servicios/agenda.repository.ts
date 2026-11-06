import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { BloqueoAgenda, CrearBloqueo } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

type BloqueoRow = {
  id: string;
  veterinario_id: string;
  inicio: Date | string;
  fin: Date | string;
  motivo: string | null;
};

type EspacioRow = { veterinario_id: string; inicio: Date | string; fin: Date | string };

function aBloqueo(row: BloqueoRow): BloqueoAgenda {
  return {
    id: row.id,
    veterinarioId: row.veterinario_id,
    inicio: new Date(row.inicio).toISOString(),
    fin: new Date(row.fin).toISOString(),
    motivo: row.motivo,
  };
}

/** SQL de las tablas del módulo servicios para el calendario (bloqueo_agenda y horario). */
@Injectable()
export class AgendaRepository {
  async insertarBloqueo(
    client: PoolClient,
    aliadoId: string,
    veterinarioId: string,
    datos: CrearBloqueo,
  ): Promise<BloqueoAgenda> {
    const r = await client.query<BloqueoRow>(
      `INSERT INTO bloqueo_agenda (aliado_id, veterinario_id, inicio, fin, motivo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, veterinario_id, inicio, fin, motivo`,
      [aliadoId, veterinarioId, datos.inicio, datos.fin, datos.motivo ?? null],
    );
    return aBloqueo(r.rows[0]);
  }

  /** Bloqueos que todavía no terminaron, del más próximo al más lejano. */
  async listarBloqueosVigentes(
    client: Consultor,
    aliadoId: string,
    veterinarioId: string,
  ): Promise<BloqueoAgenda[]> {
    const r = await client.query<BloqueoRow>(
      `SELECT id, veterinario_id, inicio, fin, motivo FROM bloqueo_agenda
        WHERE aliado_id = $1 AND veterinario_id = $2 AND fin > now()
        ORDER BY inicio`,
      [aliadoId, veterinarioId],
    );
    return r.rows.map(aBloqueo);
  }

  /** true si borró el bloqueo (que debe ser de ese veterinario y de ese aliado). */
  async eliminarBloqueo(
    client: PoolClient,
    aliadoId: string,
    veterinarioId: string,
    bloqueoId: string,
  ): Promise<boolean> {
    const r = await client.query(
      'DELETE FROM bloqueo_agenda WHERE id = $1 AND aliado_id = $2 AND veterinario_id = $3',
      [bloqueoId, aliadoId, veterinarioId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  /**
   * Espacios en que cabe un servicio de `duracionMin` minutos entre dos fechas (incluidas).
   *
   * Parte del horario semanal vigente de cada veterinario, corta cada franja en espacios
   * consecutivos de la duración del servicio y descarta los que ya empezaron, los que se
   * cruzan con un bloqueo y los que se cruzan con una cita ocupada (`ocupados`, que entrega
   * el módulo de citas). Las horas del horario se interpretan en la zona horaria de la base,
   * igual que la regla que valida las reservas, así lo que se ofrece siempre se puede reservar.
   */
  async espaciosLibres(
    client: Consultor,
    p: {
      aliadoId: string;
      veterinarioIds: string[];
      desde: string;
      hasta: string;
      duracionMin: number;
      ocupados: { veterinarioId: string; inicio: string; fin: string }[];
    },
  ): Promise<{ veterinarioId: string; inicio: string; fin: string }[]> {
    const r = await client.query<EspacioRow>(
      `WITH dias AS (
         SELECT d::date AS fecha FROM generate_series($2::date, $3::date, interval '1 day') AS d
       ), franjas AS (
         SELECT h.veterinario_id, (d.fecha + h.hora_inicio) AS ini, (d.fecha + h.hora_fin) AS fin
           FROM dias d
           JOIN horario h ON h.aliado_id = $1 AND h.veterinario_id = ANY($4::uuid[])
                         AND h.dia_semana = extract(isodow FROM d.fecha)::smallint
                         AND h.vigencia @> d.fecha
       ), espacios AS (
         SELECT f.veterinario_id, s::timestamptz AS inicio,
                (s + make_interval(mins => $5))::timestamptz AS fin
           FROM franjas f
          CROSS JOIN LATERAL generate_series(
                f.ini, f.fin - make_interval(mins => $5), make_interval(mins => $5)) AS s
       )
       SELECT e.veterinario_id, e.inicio, e.fin
         FROM espacios e
        WHERE e.inicio > now()
          AND NOT EXISTS (
              SELECT 1 FROM bloqueo_agenda b
               WHERE b.veterinario_id = e.veterinario_id
                 AND tstzrange(b.inicio, b.fin) && tstzrange(e.inicio, e.fin))
          AND NOT EXISTS (
              SELECT 1 FROM unnest($6::uuid[], $7::timestamptz[], $8::timestamptz[])
                      AS o(veterinario_id, inicio, fin)
               WHERE o.veterinario_id = e.veterinario_id
                 AND tstzrange(o.inicio, o.fin) && tstzrange(e.inicio, e.fin))
        ORDER BY e.inicio, e.veterinario_id`,
      [
        p.aliadoId,
        p.desde,
        p.hasta,
        p.veterinarioIds,
        p.duracionMin,
        p.ocupados.map((o) => o.veterinarioId),
        p.ocupados.map((o) => o.inicio),
        p.ocupados.map((o) => o.fin),
      ],
    );
    return r.rows.map((e) => ({
      veterinarioId: e.veterinario_id,
      inicio: new Date(e.inicio).toISOString(),
      fin: new Date(e.fin).toISOString(),
    }));
  }
}
