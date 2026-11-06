import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { CrearBloqueo, TipoAliado } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { AliadosService } from '../aliados/aliados.service';
import { VeterinariosService } from '../aliados/veterinarios.service';
import { CitasService } from '../citas/citas.service';
import { AgendaRepository } from './agenda.repository';

const TIPOS_CON_AGENDA: TipoAliado[] = ['CLINICA', 'VET_INDEPENDIENTE'];

/** HU-022: bloqueos del calendario (días libres, vacaciones, permisos). */
@Injectable()
export class BloqueosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: AgendaRepository,
    private readonly aliados: AliadosService,
    private readonly veterinarios: VeterinariosService,
    private readonly citas: CitasService,
  ) {}

  /**
   * Bloquea un intervalo. Se rechaza si ya terminó, si se cruza con otro bloqueo o si hay citas
   * vigentes dentro: en ese caso responde 409 con las citas que hay que atender primero.
   */
  async crear(usuarioId: string, aliadoId: string, veterinarioId: string, datos: CrearBloqueo) {
    if (Date.parse(datos.fin) <= Date.now()) {
      throw new BadRequestException({
        message: 'Revisa los campos marcados',
        errores: { fin: 'El intervalo ya terminó: bloquea fechas futuras' },
      });
    }
    return this.db.withUser(usuarioId, async (client) => {
      await this.exigirAcceso(client, usuarioId, aliadoId, veterinarioId);
      const citas = await this.citas.vigentesEnIntervalo(
        client,
        veterinarioId,
        datos.inicio,
        datos.fin,
      );
      if (citas.length > 0) {
        throw new ConflictException({
          message: `Hay ${citas.length} cita(s) vigente(s) en ese intervalo: reprográmalas o cancélalas antes de bloquearlo`,
          citas,
        });
      }
      try {
        return await this.repo.insertarBloqueo(client, aliadoId, veterinarioId, datos);
      } catch (error) {
        if (esErrorPg(error, PG.EXCLUSION)) {
          throw new ConflictException('Ese intervalo se cruza con otro bloqueo ya registrado');
        }
        if (esErrorPg(error, PG.CHECK)) {
          // Una reserva se confirmó justo ahora: la base protege el intervalo igualmente.
          throw new ConflictException((error as Error).message);
        }
        throw error;
      }
    });
  }

  async listar(usuarioId: string, aliadoId: string, veterinarioId: string) {
    return this.db.withUser(usuarioId, async (client) => {
      await this.exigirAcceso(client, usuarioId, aliadoId, veterinarioId);
      return this.repo.listarBloqueosVigentes(client, aliadoId, veterinarioId);
    });
  }

  /** Quitar un bloqueo vuelve a abrir esos espacios en el calendario del tutor. */
  async eliminar(usuarioId: string, aliadoId: string, veterinarioId: string, bloqueoId: string) {
    return this.db.withUser(usuarioId, async (client) => {
      await this.exigirAcceso(client, usuarioId, aliadoId, veterinarioId);
      const borrado = await this.repo.eliminarBloqueo(client, aliadoId, veterinarioId, bloqueoId);
      if (!borrado) throw new NotFoundException('El bloqueo no existe');
    });
  }

  private async exigirAcceso(
    client: PoolClient,
    usuarioId: string,
    aliadoId: string,
    veterinarioId: string,
  ) {
    await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_AGENDA);
    if (!(await this.veterinarios.perteneceAlAliado(client, aliadoId, veterinarioId))) {
      throw new NotFoundException('El veterinario no existe en este aliado');
    }
  }
}
