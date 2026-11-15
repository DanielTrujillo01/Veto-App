import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type {
  MascotaAdopcion,
  MascotaAdopcionPublica,
  PublicarMascotaAdopcion,
} from '@veto/shared';
import type { Consultor } from '../../database/database.service';

interface MascotaAdopcionRow extends QueryResultRow {
  id: string;
  nombre: string;
  especie_id: number;
  edad_meses: number;
  sexo: MascotaAdopcion['sexo'];
  tamano: MascotaAdopcion['tamano'];
  ubicacion: string;
  descripcion: string | null;
  estado: MascotaAdopcion['estado'];
  creado_en: Date | string;
}

interface MascotaAdopcionPublicaRow extends QueryResultRow {
  id: string;
  nombre: string;
  especie_id: number;
  especie: string;
  edad_meses: number;
  sexo: MascotaAdopcion['sexo'];
  tamano: MascotaAdopcion['tamano'];
  ubicacion: string;
  descripcion: string | null;
}

@Injectable()
export class AdopcionRepository {
  async insertar(
    client: PoolClient,
    fundacionId: string,
    datos: PublicarMascotaAdopcion,
  ): Promise<MascotaAdopcion> {
    const r = await client.query<MascotaAdopcionRow>(
      `INSERT INTO mascota_adopcion
         (fundacion_id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion, descripcion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion, descripcion,
                 estado, creado_en`,
      [
        fundacionId,
        datos.nombre,
        datos.especieId,
        datos.edadMeses,
        datos.sexo,
        datos.tamano,
        datos.ubicacion,
        datos.descripcion ?? null,
      ],
    );
    return aMascotaAdopcion(r.rows[0]);
  }

  async listarPublicas(client: Consultor): Promise<MascotaAdopcionPublica[]> {
    const r = await client.query<MascotaAdopcionPublicaRow>(
      `SELECT id, nombre, especie_id, especie, edad_meses, sexo, tamano, ubicacion, descripcion
         FROM v_catalogo_adopcion
        ORDER BY id`,
    );
    return r.rows.map((row) => ({
      id: row.id,
      nombre: row.nombre,
      especieId: row.especie_id,
      especie: row.especie,
      edadMeses: row.edad_meses,
      sexo: row.sexo,
      tamano: row.tamano,
      ubicacion: row.ubicacion,
      descripcion: row.descripcion,
    }));
  }
}

function aMascotaAdopcion(row: MascotaAdopcionRow): MascotaAdopcion {
  return {
    id: row.id,
    nombre: row.nombre,
    especieId: row.especie_id,
    edadMeses: row.edad_meses,
    sexo: row.sexo,
    tamano: row.tamano,
    ubicacion: row.ubicacion,
    descripcion: row.descripcion,
    estado: row.estado,
    creadoEn: new Date(row.creado_en).toISOString(),
  };
}
