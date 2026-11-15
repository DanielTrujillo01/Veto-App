import { ForbiddenException, Injectable } from '@nestjs/common';
import type {
  MascotaAdopcion,
  MascotaAdopcionPublica,
  PublicarMascotaAdopcion,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { AdopcionRepository } from './adopcion.repository';

@Injectable()
export class AdopcionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly repository: AdopcionRepository,
  ) {}

  async publicar(usuarioId: string, datos: PublicarMascotaAdopcion): Promise<MascotaAdopcion> {
    return this.database.withUser(usuarioId, async (client) => {
      const fundacion = await client.query<{ id: string }>(
        `SELECT id FROM aliado
          WHERE usuario_id = $1 AND tipo = 'FUNDACION' AND estado = 'ACTIVO'`,
        [usuarioId],
      );
      if (!fundacion.rows[0]) {
        throw new ForbiddenException('La fundación debe estar autorizada para publicar mascotas');
      }
      return this.repository.insertar(client, fundacion.rows[0].id, datos);
    });
  }

  listarCatalogo(): Promise<MascotaAdopcionPublica[]> {
    return this.repository.listarPublicas(this.database);
  }
}
