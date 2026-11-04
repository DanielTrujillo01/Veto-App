import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type { GuardarSede, Sede } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { AliadosService } from './aliados.service';

interface SedeRow extends QueryResultRow {
  id: string;
  aliado_id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  activa: boolean;
}

const TIPOS_SEDE = ['CLINICA'] as const;
const NO_ENCONTRADA = 'La sede no existe o no pertenece a esta clínica';

@Injectable()
export class SedesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly aliados: AliadosService,
  ) {}

  async listarDisponibles(aliadoId: string): Promise<Sede[]> {
    const r = await this.db.query<SedeRow>(
      `SELECT id, aliado_id, nombre, direccion, ciudad, activa
         FROM sede
        WHERE aliado_id = $1 AND activa
          AND EXISTS (
            SELECT 1 FROM aliado
             WHERE id = $1 AND tipo = 'CLINICA' AND estado = 'ACTIVO'
          )
        ORDER BY nombre`,
      [aliadoId],
    );
    return r.rows.map(aSede);
  }

  async listarGestion(usuarioId: string, aliadoId: string): Promise<Sede[]> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, [...TIPOS_SEDE]);
      const r = await client.query<SedeRow>(
        `SELECT id, aliado_id, nombre, direccion, ciudad, activa
           FROM sede WHERE aliado_id = $1
          ORDER BY activa DESC, nombre`,
        [aliadoId],
      );
      return r.rows.map(aSede);
    });
  }

  async obtener(usuarioId: string, aliadoId: string, sedeId: string): Promise<Sede> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, [...TIPOS_SEDE]);
      const sede = await this.buscar(client, aliadoId, sedeId);
      if (!sede) throw new NotFoundException(NO_ENCONTRADA);
      return aSede(sede);
    });
  }

  async crear(usuarioId: string, aliadoId: string, datos: GuardarSede): Promise<Sede> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, [...TIPOS_SEDE]);
      const r = await client.query<SedeRow>(
        `INSERT INTO sede (aliado_id, nombre, direccion, ciudad)
         VALUES ($1, $2, $3, $4)
         RETURNING id, aliado_id, nombre, direccion, ciudad, activa`,
        [aliadoId, datos.nombre, datos.direccion, datos.ciudad],
      );
      return aSede(r.rows[0]);
    });
  }

  async actualizar(
    usuarioId: string,
    aliadoId: string,
    sedeId: string,
    datos: GuardarSede,
  ): Promise<Sede> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, [...TIPOS_SEDE]);
      const r = await client.query<SedeRow>(
        `UPDATE sede
            SET nombre = $3, direccion = $4, ciudad = $5
          WHERE id = $1 AND aliado_id = $2
          RETURNING id, aliado_id, nombre, direccion, ciudad, activa`,
        [sedeId, aliadoId, datos.nombre, datos.direccion, datos.ciudad],
      );
      if (!r.rows[0]) throw new NotFoundException(NO_ENCONTRADA);
      return aSede(r.rows[0]);
    });
  }

  async desactivar(usuarioId: string, aliadoId: string, sedeId: string): Promise<Sede> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, [...TIPOS_SEDE]);
      const r = await client.query<SedeRow>(
        `UPDATE sede SET activa = false
          WHERE id = $1 AND aliado_id = $2 AND activa
          RETURNING id, aliado_id, nombre, direccion, ciudad, activa`,
        [sedeId, aliadoId],
      );
      if (!r.rows[0]) throw new NotFoundException(NO_ENCONTRADA);
      return aSede(r.rows[0]);
    });
  }

  private async buscar(client: PoolClient, aliadoId: string, sedeId: string) {
    const r = await client.query<SedeRow>(
      `SELECT id, aliado_id, nombre, direccion, ciudad, activa
         FROM sede WHERE id = $1 AND aliado_id = $2`,
      [sedeId, aliadoId],
    );
    return r.rows[0] ?? null;
  }
}

function aSede(row: SedeRow): Sede {
  return {
    id: row.id,
    aliadoId: row.aliado_id,
    nombre: row.nombre,
    direccion: row.direccion,
    ciudad: row.ciudad,
    activa: row.activa,
  };
}
