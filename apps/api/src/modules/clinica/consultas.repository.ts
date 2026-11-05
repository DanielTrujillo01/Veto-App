import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { ConsultaDetalle, ConsultaResumen, EstadoConsulta } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

interface FilaConsulta extends QueryResultRow {
  id: string;
  cita_id: string;
  cita_inicio: Date | string;
  cita_fin: Date | string;
  servicio: string;
  mascota_id: string;
  mascota_nombre: string;
  especie: string;
  motivo_consulta: string;
  descripcion_propietario: string | null;
  estado_mental: string | null;
  condicion_corporal: string | null;
  comportamiento: string | null;
  estado_general: string | null;
  estado: EstadoConsulta;
  cerrada_en: Date | string | null;
  creado_en: Date | string;
}

const aTexto = (fecha: Date | string): string =>
  fecha instanceof Date ? fecha.toISOString() : fecha;

function aResumen(f: FilaConsulta): ConsultaResumen {
  return {
    id: f.id,
    citaId: f.cita_id,
    fecha: aTexto(f.cita_inicio),
    servicio: f.servicio,
    mascota: { id: f.mascota_id, nombre: f.mascota_nombre, especie: f.especie },
    motivoConsulta: f.motivo_consulta,
    estado: f.estado,
    cerradaEn: f.cerrada_en ? aTexto(f.cerrada_en) : null,
  };
}

function aDetalle(f: FilaConsulta): ConsultaDetalle {
  return {
    ...aResumen(f),
    citaFin: aTexto(f.cita_fin),
    descripcionPropietario: f.descripcion_propietario,
    estadoMental: f.estado_mental,
    condicionCorporal: f.condicion_corporal,
    comportamiento: f.comportamiento,
    estadoGeneral: f.estado_general,
    creadaEn: aTexto(f.creado_en),
  };
}

const COLUMNAS = `id, cita_id, cita_inicio, cita_fin, servicio, mascota_id, mascota_nombre, especie,
       motivo_consulta, descripcion_propietario, estado_mental, condicion_corporal, comportamiento,
       estado_general, estado, cerrada_en, creado_en`;

/**
 * SQL de las consultas. Todas las lecturas filtran por `veterinario_id`: la autorización vive en
 * la propia consulta SQL, así que una consulta ajena nunca llega a la capa de servicio.
 * Lee de la vista v_consulta_detalle (no hace SQL sobre tablas de otros módulos).
 */
@Injectable()
export class ConsultasRepository {
  async listar(
    db: Consultor,
    veterinarioId: string,
    filtros: { estado?: EstadoConsulta; limite: number; desplazamiento: number },
  ): Promise<{ items: ConsultaResumen[]; total: number }> {
    const estado = filtros.estado ?? null;
    const filas = await db.query<FilaConsulta>(
      `SELECT ${COLUMNAS}
         FROM v_consulta_detalle
        WHERE veterinario_id = $1 AND ($2::estado_consulta IS NULL OR estado = $2)
        ORDER BY cita_inicio DESC, id
        LIMIT $3 OFFSET $4`,
      [veterinarioId, estado, filtros.limite, filtros.desplazamiento],
    );
    const total = await db.query<{ total: number }>(
      `SELECT count(*)::int AS total
         FROM v_consulta_detalle
        WHERE veterinario_id = $1 AND ($2::estado_consulta IS NULL OR estado = $2)`,
      [veterinarioId, estado],
    );
    return { items: filas.rows.map(aResumen), total: total.rows[0]?.total ?? 0 };
  }

  /** La consulta solo si es de este veterinario; null si no existe o es de otro. */
  async buscarDelVeterinario(
    db: Consultor,
    consultaId: string,
    veterinarioId: string,
  ): Promise<ConsultaDetalle | null> {
    const r = await db.query<FilaConsulta>(
      `SELECT ${COLUMNAS}
         FROM v_consulta_detalle
        WHERE id = $1 AND veterinario_id = $2`,
      [consultaId, veterinarioId],
    );
    return r.rows[0] ? aDetalle(r.rows[0]) : null;
  }

  /** ¿La consulta existe y es de este veterinario? (tabla propia del módulo) */
  async esDelVeterinario(
    db: Consultor,
    consultaId: string,
    veterinarioId: string,
  ): Promise<boolean> {
    const r = await db.query<{ ok: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM consulta WHERE id = $1 AND veterinario_id = $2) AS ok',
      [consultaId, veterinarioId],
    );
    return Boolean(r.rows[0]?.ok);
  }
}
