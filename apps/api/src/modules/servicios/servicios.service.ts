import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AliadosService } from '../aliados/aliados.service';
import type { ServicioInput } from '@veto/shared';

type ServiceRow = {
  id: string;
  aliado_id: string;
  tipo_servicio_id: number;
  nombre: string;
  descripcion: string | null;
  modalidad: 'EN_SEDE' | 'A_DOMICILIO';
  sede_id: string | null;
  duracion_min: number;
  precio_base: string;
  activo: boolean;
  moderacion: string;
  creado_en: Date;
};
const COLUMNS =
  'id,aliado_id,tipo_servicio_id,nombre,descripcion,modalidad,sede_id,duracion_min,precio_base,activo,moderacion,creado_en';

@Injectable()
export class ServiciosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly aliados: AliadosService,
  ) {}

  async create(allyId: string, input: ServicioInput): Promise<ServiceRow> {
    await this.aliados.assertCanOfferServices(allyId);
    if (input.sedeId) await this.aliados.assertActiveBranch(allyId, input.sedeId);
    return this.database.withUser(null, async (client) => {
      const result = await client.query<ServiceRow>(
        `INSERT INTO servicio (aliado_id,tipo_servicio_id,nombre,descripcion,modalidad,sede_id,duracion_min,precio_base)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLUMNS}`,
        [
          allyId,
          input.tipoServicioId,
          input.nombre,
          input.descripcion ?? null,
          input.modalidad,
          input.sedeId ?? null,
          input.duracionMin,
          input.precioBase,
        ],
      );
      return result.rows[0];
    });
  }

  async getForAlly(allyId: string, serviceId: string): Promise<ServiceRow> {
    const result = await this.database.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM servicio WHERE aliado_id=$1 AND id=$2`,
      [allyId, serviceId],
    );
    if (!result.rowCount)
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'No se encontró el servicio.',
      });
    return result.rows[0];
  }

  async getPublic(serviceId: string): Promise<ServiceRow> {
    const result = await this.database.query<ServiceRow>(
      `SELECT ${COLUMNS} FROM servicio s WHERE s.id=$1 AND s.activo=true AND s.moderacion='PUBLICADO'
       AND (s.sede_id IS NULL OR EXISTS (SELECT 1 FROM sede se WHERE se.id=s.sede_id AND se.aliado_id=s.aliado_id AND se.activa=true))`,
      [serviceId],
    );
    if (!result.rowCount)
      throw new NotFoundException({
        code: 'SERVICE_NOT_FOUND',
        message: 'No se encontró un servicio disponible.',
      });
    return result.rows[0];
  }
}
