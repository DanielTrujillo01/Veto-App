import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type { CrearMascota, Mascota } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

interface MascotaRow extends QueryResultRow {
  id: string;
  nombre: string;
  especie_id: number;
  especie: string;
  sexo: Mascota['sexo'];
  raza: string | null;
  fecha_nacimiento: string | null;
  edad_meses: number | null;
  color: string | null;
  peso_kg: number | null;
  chip: string | null;
  fotos: string[] | null;
  creado_en: Date | string;
}

/** Columnas de la respuesta; fecha y peso se convierten en SQL para no depender del parser de pg. */
const SELECT_MASCOTA = `
  SELECT m.id, m.nombre, m.especie_id, e.nombre AS especie, m.sexo, m.raza,
         to_char(m.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, m.edad_meses, m.color,
         m.peso_kg::float8 AS peso_kg, m.chip, m.creado_en,
         ARRAY(SELECT f.url FROM mascota_foto f WHERE f.mascota_id = m.id ORDER BY f.url) AS fotos
    FROM mascota m
    JOIN especie e ON e.id = m.especie_id`;

/** Orden de los parámetros $2..$10 en INSERT y UPDATE. */
function columnas(datos: CrearMascota): unknown[] {
  return [
    datos.nombre,
    datos.especieId,
    datos.sexo,
    datos.raza ?? null,
    datos.fechaNacimiento ?? null,
    datos.edadMeses ?? null,
    datos.color ?? null,
    datos.pesoKg ?? null,
    datos.chip ?? null,
  ];
}

/** SQL de las tablas del módulo mascotas (mascota, mascota_foto, especie). */
@Injectable()
export class MascotasRepository {
  async insertar(client: PoolClient, tutorId: string, datos: CrearMascota): Promise<string> {
    const r = await client.query<{ id: string }>(
      `INSERT INTO mascota
         (tutor_id, nombre, especie_id, sexo, raza, fecha_nacimiento, edad_meses, color, peso_kg, chip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [tutorId, ...columnas(datos)],
    );
    return r.rows[0].id;
  }

  /** Actualiza solo si la mascota es del tutor. Devuelve false si no existe o es de otro tutor. */
  async actualizar(
    client: PoolClient,
    id: string,
    tutorId: string,
    datos: CrearMascota,
  ): Promise<boolean> {
    const r = await client.query(
      `UPDATE mascota
          SET nombre = $3, especie_id = $4, sexo = $5, raza = $6, fecha_nacimiento = $7,
              edad_meses = $8, color = $9, peso_kg = $10, chip = $11
        WHERE id = $1 AND tutor_id = $2`,
      [id, tutorId, ...columnas(datos)],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async reemplazarFotos(client: PoolClient, mascotaId: string, urls: string[]): Promise<void> {
    await client.query('DELETE FROM mascota_foto WHERE mascota_id = $1', [mascotaId]);
    for (const url of new Set(urls)) {
      await client.query('INSERT INTO mascota_foto (mascota_id, url) VALUES ($1, $2)', [
        mascotaId,
        url,
      ]);
    }
  }

  async buscarDelTutor(client: Consultor, id: string, tutorId: string): Promise<Mascota | null> {
    const r = await client.query<MascotaRow>(
      `${SELECT_MASCOTA} WHERE m.id = $1 AND m.tutor_id = $2`,
      [id, tutorId],
    );
    return r.rows[0] ? aMascota(r.rows[0]) : null;
  }

  async listarDelTutor(client: Consultor, tutorId: string): Promise<Mascota[]> {
    const r = await client.query<MascotaRow>(
      `${SELECT_MASCOTA} WHERE m.tutor_id = $1 ORDER BY m.creado_en, m.nombre`,
      [tutorId],
    );
    return r.rows.map(aMascota);
  }

  async listarEspecies(client: Consultor) {
    const r = await client.query<{ id: number; nombre: string }>(
      'SELECT id, nombre FROM especie ORDER BY id',
    );
    return r.rows;
  }
}

function aMascota(row: MascotaRow): Mascota {
  return {
    id: row.id,
    nombre: row.nombre,
    especieId: row.especie_id,
    especie: row.especie,
    sexo: row.sexo,
    raza: row.raza,
    fechaNacimiento: row.fecha_nacimiento,
    edadMeses: row.edad_meses,
    color: row.color,
    pesoKg: row.peso_kg === null ? null : Number(row.peso_kg),
    chip: row.chip,
    fotos: row.fotos ?? [],
    creadoEn: new Date(row.creado_en).toISOString(),
  };
}
