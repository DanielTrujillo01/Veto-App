import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsultaDetalle, ListarConsultas, PaginaConsultas } from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
import { ConsultasRepository } from './consultas.repository';

const NO_ENCONTRADA = 'La consulta no existe o no está asignada a ti';

@Injectable()
export class ConsultasService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: ConsultasRepository,
  ) {}

  /** HU-014: las consultas del veterinario (solo las suyas), de la más reciente a la más antigua. */
  async listarDelVeterinario(
    veterinarioId: string,
    filtros: ListarConsultas,
  ): Promise<PaginaConsultas> {
    const { items, total } = await this.repo.listar(this.db, veterinarioId, {
      estado: filtros.estado,
      limite: filtros.limite,
      desplazamiento: (filtros.pagina - 1) * filtros.limite,
    });
    return { items, total, pagina: filtros.pagina, limite: filtros.limite };
  }

  /**
   * HU-014: el detalle de una consulta propia. Para cualquier otro veterinario la consulta
   * "no existe" (404): no se revela que pertenece a un colega.
   */
  async obtenerDelVeterinario(veterinarioId: string, consultaId: string): Promise<ConsultaDetalle> {
    const consulta = await this.repo.buscarDelVeterinario(this.db, consultaId, veterinarioId);
    if (!consulta) throw new NotFoundException(NO_ENCONTRADA);
    return consulta;
  }

  /**
   * Para las acciones que modifican una consulta (registrar anamnesis, cerrar, anotar:
   * HU-037, 042): lanza 404 si la consulta no es del veterinario. Llamar con el `client` de la
   * transacción de `withUser`, antes de escribir.
   */
  async exigirPropia(client: Consultor, veterinarioId: string, consultaId: string): Promise<void> {
    if (!(await this.repo.esDelVeterinario(client, consultaId, veterinarioId))) {
      throw new NotFoundException(NO_ENCONTRADA);
    }
  }
}
