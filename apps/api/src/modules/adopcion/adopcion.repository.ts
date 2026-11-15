import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { MAX_FOTOS_ADOPCION } from '@veto/shared';
import type {
  MascotaAdopcion,
  MascotaAdopcionPublica,
  EditarMascotaAdopcion,
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
  fotos: string[] | null;
  video_url: string | null;
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
  fotos: string[] | null;
  video_url: string | null;
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
    await this.reemplazarMedios(client, r.rows[0].id, datos);
    return aMascotaAdopcion(r.rows[0], datos);
  }

  async actualizar(
    client: PoolClient,
    publicacionId: string,
    fundacionId: string,
    datos: EditarMascotaAdopcion,
  ): Promise<MascotaAdopcion | null> {
    const r = await client.query<MascotaAdopcionRow>(
      `UPDATE mascota_adopcion
          SET nombre = $3, especie_id = $4, edad_meses = $5, sexo = $6,
              tamano = $7, ubicacion = $8, descripcion = $9
        WHERE id = $1 AND fundacion_id = $2
       RETURNING id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion, descripcion,
                 estado, creado_en`,
      [
        publicacionId,
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
    if (!r.rows[0]) return null;
    await this.reemplazarMedios(client, r.rows[0].id, datos);
    return aMascotaAdopcion(r.rows[0], datos);
  }

  async cambiarEstado(
    client: PoolClient,
    publicacionId: string,
    fundacionId: string,
    estado: MascotaAdopcion['estado'],
  ): Promise<MascotaAdopcion | null> {
    const r = await client.query<MascotaAdopcionRow>(
      `UPDATE mascota_adopcion
          SET estado = $3
        WHERE id = $1 AND fundacion_id = $2
       RETURNING id, nombre, especie_id, edad_meses, sexo, tamano, ubicacion, descripcion,
                 estado, creado_en`,
      [publicacionId, fundacionId, estado],
    );
    return r.rows[0] ? aMascotaAdopcion(r.rows[0]) : null;
  }

  async listarDeFundacion(
    client: Consultor,
    fundacionId: string,
    estado?: MascotaAdopcion['estado'],
  ): Promise<MascotaAdopcion[]> {
    const parametros: unknown[] = [fundacionId];
    const filtroEstado = estado ? ' AND m.estado = $2' : '';
    if (estado) parametros.push(estado);
    const r = await client.query<MascotaAdopcionRow>(
      `SELECT m.id, m.nombre, m.especie_id, m.edad_meses, m.sexo, m.tamano, m.ubicacion,
              m.descripcion, m.estado, m.creado_en,
              COALESCE(media.fotos, ARRAY[]::text[]) AS fotos, media.video_url
         FROM mascota_adopcion m
         LEFT JOIN LATERAL (
           SELECT array_agg(mm.url ORDER BY mm.posicion, mm.id)
                    FILTER (WHERE mm.tipo = 'FOTO') AS fotos,
                  max(mm.url) FILTER (WHERE mm.tipo = 'VIDEO') AS video_url
             FROM mascota_adopcion_media mm
            WHERE mm.mascota_adopcion_id = m.id
         ) media ON true
        WHERE m.fundacion_id = $1${filtroEstado}
        ORDER BY m.creado_en DESC, m.id`,
      parametros,
    );
    return r.rows.map((row) => aMascotaAdopcion(row));
  }

  async listarPublicas(client: Consultor): Promise<MascotaAdopcionPublica[]> {
    const r = await client.query<MascotaAdopcionPublicaRow>(
      `SELECT id, nombre, especie_id, especie, edad_meses, sexo, tamano, ubicacion, descripcion,
              fotos, video_url
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
      fotos: row.fotos ?? [],
      videoUrl: row.video_url,
    }));
  }

  private async reemplazarMedios(
    client: PoolClient,
    publicacionId: string,
    datos: PublicarMascotaAdopcion,
  ): Promise<void> {
    await client.query('DELETE FROM mascota_adopcion_media WHERE mascota_adopcion_id = $1', [
      publicacionId,
    ]);
    for (const [indice, url] of datos.fotos.entries()) {
      await client.query(
        `INSERT INTO mascota_adopcion_media (mascota_adopcion_id, tipo, url, posicion)
         VALUES ($1, 'FOTO', $2, $3)`,
        [publicacionId, url, indice + 1],
      );
    }
    if (datos.videoUrl) {
      await client.query(
        `INSERT INTO mascota_adopcion_media (mascota_adopcion_id, tipo, url, posicion)
         VALUES ($1, 'VIDEO', $2, $3)`,
        [publicacionId, datos.videoUrl, MAX_FOTOS_ADOPCION + 1],
      );
    }
  }
}

function aMascotaAdopcion(
  row: MascotaAdopcionRow,
  medios?: Pick<PublicarMascotaAdopcion, 'fotos' | 'videoUrl'>,
): MascotaAdopcion {
  return {
    id: row.id,
    nombre: row.nombre,
    especieId: row.especie_id,
    edadMeses: row.edad_meses,
    sexo: row.sexo,
    tamano: row.tamano,
    ubicacion: row.ubicacion,
    descripcion: row.descripcion,
    fotos: medios?.fotos ?? row.fotos ?? [],
    videoUrl: medios?.videoUrl ?? row.video_url ?? null,
    estado: row.estado,
    creadoEn: new Date(row.creado_en).toISOString(),
  };
}
