import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type { GuardarServicio, Servicio } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

interface ServicioRow extends QueryResultRow {
  id: string;
  aliado_id: string;
  tipo_servicio_id: number;
  tipo_servicio: string;
  nombre: string;
  descripcion: string | null;
  modalidad: Servicio['modalidad'];
  sede_id: string | null;
  duracion_min: number;
  precio_base: number | string;
  activo: boolean;
  creado_en: Date | string;
}

const SELECT_SERVICIO = `
  SELECT s.id, s.aliado_id, s.tipo_servicio_id, t.nombre AS tipo_servicio, s.nombre, s.descripcion,
         s.modalidad, s.sede_id, s.duracion_min, s.precio_base::float8 AS precio_base, s.activo,
         s.creado_en
    FROM servicio s
    JOIN tipo_servicio t ON t.id = s.tipo_servicio_id`;

/** Orden de los parámetros $3..$9 en INSERT y UPDATE. */
function columnas(datos: GuardarServicio): unknown[] {
  return [
    datos.tipoServicioId,
    datos.nombre,
    datos.descripcion ?? null,
    datos.modalidad,
    datos.sedeId ?? null,
    datos.duracionMin,
    datos.precioBase,
  ];
}

/** SQL de las tablas del módulo servicios (servicio, tipo_servicio). */
@Injectable()
export class ServiciosRepository {
  async insertar(client: PoolClient, aliadoId: string, datos: GuardarServicio): Promise<string> {
    const r = await client.query<{ id: string }>(
      `INSERT INTO servicio
         (aliado_id, tipo_servicio_id, nombre, descripcion, modalidad, sede_id, duracion_min, precio_base)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [aliadoId, ...columnas(datos)],
    );
    return r.rows[0].id;
  }

  async actualizar(client: PoolClient, id: string, aliadoId: string, datos: GuardarServicio) {
    await client.query(
      `UPDATE servicio
          SET tipo_servicio_id = $3, nombre = $4, descripcion = $5, modalidad = $6, sede_id = $7,
              duracion_min = $8, precio_base = $9
        WHERE id = $1 AND aliado_id = $2`,
      [id, aliadoId, ...columnas(datos)],
    );
  }

  async cambiarActivo(client: PoolClient, id: string, aliadoId: string, activo: boolean) {
    await client.query('UPDATE servicio SET activo = $3 WHERE id = $1 AND aliado_id = $2', [
      id,
      aliadoId,
      activo,
    ]);
  }

  /** Servicio del aliado (bloqueado para la transacción si `bloquear`). */
  async buscar(
    client: Consultor,
    id: string,
    aliadoId: string,
    bloquear = false,
  ): Promise<Servicio | null> {
    const r = await client.query<ServicioRow>(
      `${SELECT_SERVICIO} WHERE s.id = $1 AND s.aliado_id = $2${bloquear ? ' FOR UPDATE OF s' : ''}`,
      [id, aliadoId],
    );
    return r.rows[0] ? aServicio(r.rows[0]) : null;
  }

  /** Todos los servicios del aliado (gestión) o solo los disponibles para reservar. */
  async listar(client: Consultor, aliadoId: string, soloDisponibles: boolean): Promise<Servicio[]> {
    const filtro = soloDisponibles ? " AND s.activo AND s.moderacion = 'PUBLICADO'" : '';
    const r = await client.query<ServicioRow>(
      `${SELECT_SERVICIO} WHERE s.aliado_id = $1${filtro} ORDER BY s.activo DESC, s.nombre`,
      [aliadoId],
    );
    return r.rows.map(aServicio);
  }

  async listarTipos(client: Consultor) {
    const r = await client.query<{ id: number; nombre: string }>(
      'SELECT id, nombre FROM tipo_servicio ORDER BY id',
    );
    return r.rows;
  }
}

function aServicio(row: ServicioRow): Servicio {
  return {
    id: row.id,
    aliadoId: row.aliado_id,
    tipoServicioId: row.tipo_servicio_id,
    tipoServicio: row.tipo_servicio,
    nombre: row.nombre,
    descripcion: row.descripcion,
    modalidad: row.modalidad,
    sedeId: row.sede_id,
    duracionMin: row.duracion_min,
    precioBase: Number(row.precio_base),
    activo: row.activo,
    creadoEn: new Date(row.creado_en).toISOString(),
  };
}
