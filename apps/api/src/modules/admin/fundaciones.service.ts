import { Injectable } from '@nestjs/common';
import type { EstadoAliado } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { AliadosService } from '../aliados/aliados.service';

@Injectable()
export class AdminFundacionesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly aliados: AliadosService,
  ) {}

  async listarPendientes(adminId: string) {
    const fundaciones = await this.database.withUser(adminId, (client) =>
      this.aliados.listarFundacionesPendientes(client),
    );
    return { fundaciones };
  }

  async obtener(adminId: string, fundacionId: string) {
    const fundacion = await this.database.withUser(adminId, (client) =>
      this.aliados.obtenerFundacionParaRevision(client, fundacionId),
    );
    return { fundacion };
  }

  async decidir(
    adminId: string,
    fundacionId: string,
    estado: Extract<EstadoAliado, 'ACTIVO' | 'RECHAZADO'>,
  ) {
    return this.database.withUser(adminId, async (client) => {
      const fundacion = await this.aliados.decidirFundacion(client, fundacionId, estado);
      await client.query(
        `INSERT INTO accion_admin (admin_id, objetivo_tipo, objetivo_id, accion)
         VALUES ($1, 'aliado', $2, $3)`,
        [adminId, fundacionId, estado === 'ACTIVO' ? 'APROBAR_FUNDACION' : 'RECHAZAR_FUNDACION'],
      );
      return { fundacion: { id: fundacion.id, estado: fundacion.estado } };
    });
  }
}
