import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type {
  GuardarReglasPrecio,
  GuardarServicio,
  ReglaPrecio,
  Servicio,
  OrdenServicios,
  ServicioConReglas,
} from '@veto/shared';
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

interface ReglaPrecioRow extends QueryResultRow {
  id: string;
  especie_id: number | null;
  peso_min_kg: number | string | null;
  peso_max_kg: number | string | null;
  edad_min_meses: number | null;
  edad_max_meses: number | null;
  precio: number | string;
  prioridad: number;
}

const SELECT_SERVICIO = `
  SELECT s.id, s.aliado_id, s.tipo_servicio_id, t.nombre AS tipo_servicio, s.nombre, s.descripcion,
         s.modalidad, s.sede_id, s.duracion_min, s.precio_base::float8 AS precio_base, s.activo,
         s.creado_en
    FROM servicio s
    JOIN tipo_servicio t ON t.id = s.tipo_servicio_id`;

const ORDENES: Record<OrdenServicios, string> = {
  nombre: 'd.nombre, d.id',
  precio_asc: 'precio_desde ASC, d.nombre, d.id',
  precio_desc: 'precio_desde DESC, d.nombre, d.id',
};

// Misma condición de disponibilidad que usa buscarDisponible / listar(soloDisponibles)
const CONDICION_DISPONIBLE = `
  a.estado = 'ACTIVO' AND s.activo AND s.moderacion = 'PUBLICADO'
  AND (s.modalidad <> 'EN_SEDE' OR EXISTS (
    SELECT 1 FROM sede se
     WHERE se.id = s.sede_id AND se.aliado_id = s.aliado_id AND se.activa
  ))`;

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
  async listarReglasPrecio(client: Consultor, servicioId: string): Promise<ReglaPrecio[]> {
    const resultado = await client.query<ReglaPrecioRow>(
      `SELECT id, especie_id, peso_min_kg, peso_max_kg, edad_min_meses, edad_max_meses,
              precio::float8 AS precio, prioridad
         FROM servicio_regla_precio
        WHERE servicio_id = $1
        ORDER BY prioridad DESC, precio DESC, id`,
      [servicioId],
    );
    return resultado.rows.map(aReglaPrecio);
  }

  async reemplazarReglasPrecio(
    client: PoolClient,
    servicioId: string,
    datos: GuardarReglasPrecio,
  ): Promise<void> {
    await client.query('DELETE FROM servicio_regla_precio WHERE servicio_id = $1', [servicioId]);
    for (const regla of datos.reglas) {
      await client.query(
        `INSERT INTO servicio_regla_precio
           (servicio_id, especie_id, peso_min_kg, peso_max_kg, edad_min_meses,
            edad_max_meses, precio, prioridad)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          servicioId,
          regla.especieId ?? null,
          regla.pesoMinKg ?? null,
          regla.pesoMaxKg ?? null,
          regla.edadMinMeses ?? null,
          regla.edadMaxMeses ?? null,
          regla.precio,
          regla.prioridad,
        ],
      );
    }
  }

  async precioParaMascota(
    client: Consultor,
    servicioId: string,
    mascotaId: string,
  ): Promise<number> {
    const resultado = await client.query<{ precio: number | string }>(
      'SELECT fn_precio_servicio($1, $2)::float8 AS precio',
      [servicioId, mascotaId],
    );
    return Number(resultado.rows[0].precio);
  }

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

  /** Servicio públicamente disponible, independientemente del aliado al que pertenece. */
  async buscarDisponible(client: Consultor, id: string): Promise<Servicio | null> {
    const r = await client.query<ServicioRow>(
      `${SELECT_SERVICIO}
       JOIN aliado a ON a.id = s.aliado_id
       WHERE s.id = $1 AND a.estado = 'ACTIVO' AND s.activo AND s.moderacion = 'PUBLICADO'
         AND (s.modalidad <> 'EN_SEDE' OR EXISTS (
           SELECT 1 FROM sede se
            WHERE se.id = s.sede_id AND se.aliado_id = s.aliado_id AND se.activa
         ))`,
      [id],
    );
    return r.rows[0] ? aServicio(r.rows[0]) : null;
  }

  /** Todos los servicios del aliado (gestión) o solo los disponibles para reservar. */
  async listar(client: Consultor, aliadoId: string, soloDisponibles: boolean): Promise<Servicio[]> {
    const filtro = soloDisponibles
      ? ` AND s.activo AND s.moderacion = 'PUBLICADO'
          AND (s.modalidad <> 'EN_SEDE' OR EXISTS (
            SELECT 1 FROM sede se
             WHERE se.id = s.sede_id AND se.aliado_id = s.aliado_id AND se.activa
          ))`
      : '';
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

  /** Todos los servicios disponibles de todos los aliados, cada uno con sus reglas de precio. */
  async listarTodosDisponibles(
    client: Consultor,
    orden: OrdenServicios = 'nombre',
  ): Promise<ServicioConReglas[]> {
    const r = await client.query<ServicioRow & { precio_desde: number }>(
      `WITH disponibles AS (
        ${SELECT_SERVICIO}
        JOIN aliado a ON a.id = s.aliado_id
        WHERE ${CONDICION_DISPONIBLE}
      )
      SELECT d.*,
              LEAST(d.precio_base,
                    COALESCE((SELECT MIN(r.precio)::float8
                                FROM servicio_regla_precio r
                              WHERE r.servicio_id = d.id), d.precio_base)) AS precio_desde
        FROM disponibles d
        ORDER BY ${ORDENES[orden]}`,
    );
    if (r.rows.length === 0) return [];

    const ids = r.rows.map((fila) => fila.id);
    const reglas = await client.query<ReglaPrecioRow & { servicio_id: string }>(
      `SELECT servicio_id, id, especie_id, peso_min_kg, peso_max_kg, edad_min_meses,
              edad_max_meses, precio::float8 AS precio, prioridad
        FROM servicio_regla_precio
        WHERE servicio_id = ANY($1::uuid[])
        ORDER BY prioridad DESC, precio DESC, id`,
      [ids],
    );

    const porServicio = new Map<string, ReglaPrecio[]>();
    for (const fila of reglas.rows) {
      const lista = porServicio.get(fila.servicio_id) ?? [];
      lista.push(aReglaPrecio(fila));
      porServicio.set(fila.servicio_id, lista);
    }

    return r.rows.map((fila) => ({
      ...aServicio(fila),
      precioDesde: Number(fila.precio_desde),
      reglasPrecio: porServicio.get(fila.id) ?? [],
    }));
  }
}

function aReglaPrecio(row: ReglaPrecioRow): ReglaPrecio {
  return {
    id: row.id,
    especieId: row.especie_id,
    pesoMinKg: row.peso_min_kg === null ? null : Number(row.peso_min_kg),
    pesoMaxKg: row.peso_max_kg === null ? null : Number(row.peso_max_kg),
    edadMinMeses: row.edad_min_meses,
    edadMaxMeses: row.edad_max_meses,
    precio: Number(row.precio),
    prioridad: row.prioridad,
  };
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
