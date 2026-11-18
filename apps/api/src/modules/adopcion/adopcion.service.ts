import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  CambiarEstadoMascotaAdopcion,
  EditarMascotaAdopcion,
  FiltrosCatalogoAdopcion,
  MascotaAdopcion,
  MascotaAdopcionPublica,
  ListarMascotasAdopcion,
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

  async listarPropias(
    usuarioId: string,
    filtro: ListarMascotasAdopcion = {},
  ): Promise<MascotaAdopcion[]> {
    return this.database.withUser(usuarioId, async (client) => {
      const fundacionId = await this.fundacionActiva(client, usuarioId);
      return this.repository.listarDeFundacion(client, fundacionId, filtro.estado);
    });
  }

  async editar(
    usuarioId: string,
    publicacionId: string,
    datos: EditarMascotaAdopcion,
  ): Promise<MascotaAdopcion> {
    return this.database.withUser(usuarioId, async (client) => {
      const fundacionId = await this.fundacionActiva(client, usuarioId);
      const publicacion = await this.repository.actualizar(
        client,
        publicacionId,
        fundacionId,
        datos,
      );
      if (!publicacion)
        throw new NotFoundException('La publicación no existe o no pertenece a tu fundación');
      return publicacion;
    });
  }

  async cambiarEstado(
    usuarioId: string,
    publicacionId: string,
    datos: CambiarEstadoMascotaAdopcion,
  ): Promise<MascotaAdopcion> {
    return this.database.withUser(usuarioId, async (client) => {
      const fundacionId = await this.fundacionActiva(client, usuarioId);
      const actual = await client.query<{ estado: MascotaAdopcion['estado'] }>(
        `SELECT estado FROM mascota_adopcion WHERE id = $1 AND fundacion_id = $2`,
        [publicacionId, fundacionId],
      );
      const estadoActual = actual.rows[0]?.estado;
      if (!estadoActual) {
        throw new NotFoundException('La publicación no existe o no pertenece a tu fundación');
      }
      if (!TRANSICIONES[estadoActual].includes(datos.estado)) {
        throw new ConflictException(`No se puede cambiar de ${estadoActual} a ${datos.estado}`);
      }
      const publicacion = await this.repository.cambiarEstado(
        client,
        publicacionId,
        fundacionId,
        datos.estado,
      );
      return publicacion as MascotaAdopcion;
    });
  }

  listarCatalogo(filtros: FiltrosCatalogoAdopcion = {}): Promise<MascotaAdopcionPublica[]> {
    return this.repository.listarPublicas(this.database, filtros);
  }

  async obtenerPublica(mascotaId: string): Promise<MascotaAdopcionPublica> {
    const mascota = await this.repository.buscarPublica(this.database, mascotaId);
    if (!mascota) throw new NotFoundException('La mascota no está disponible para adopción');
    return mascota;
  }

  private async fundacionActiva(client: PoolClient, usuarioId: string): Promise<string> {
    const fundacion = await client.query<{ id: string }>(
      `SELECT id FROM aliado
        WHERE usuario_id = $1 AND tipo = 'FUNDACION' AND estado = 'ACTIVO'`,
      [usuarioId],
    );
    if (!fundacion.rows[0]) {
      throw new ForbiddenException(
        'La fundación debe estar autorizada para gestionar publicaciones',
      );
    }
    return fundacion.rows[0].id;
  }
}

const TRANSICIONES: Record<MascotaAdopcion['estado'], MascotaAdopcion['estado'][]> = {
  DISPONIBLE: ['PAUSADA', 'EN_PROCESO', 'RETIRADA'],
  PAUSADA: ['DISPONIBLE', 'RETIRADA'],
  EN_PROCESO: ['DISPONIBLE', 'ADOPTADA', 'RETIRADA'],
  ADOPTADA: [],
  RETIRADA: [],
};
