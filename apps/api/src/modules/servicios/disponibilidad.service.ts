import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsultarDisponibilidad, Disponibilidad } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { AliadosService } from '../aliados/aliados.service';
import { VeterinariosService } from '../aliados/veterinarios.service';
import { CitasService } from '../citas/citas.service';
import { AgendaRepository } from './agenda.repository';
import { ServiciosRepository } from './servicios.repository';

/**
 * HU-022: calendario de disponibilidad que ve el tutor. Se calcula en cada consulta con lo
 * que hay guardado (horario, bloqueos y citas), así que un cambio del aliado se ve de inmediato.
 */
@Injectable()
export class DisponibilidadService {
  constructor(
    private readonly db: DatabaseService,
    private readonly agenda: AgendaRepository,
    private readonly servicios: ServiciosRepository,
    private readonly aliados: AliadosService,
    private readonly veterinarios: VeterinariosService,
    private readonly citas: CitasService,
  ) {}

  async consultar(aliadoId: string, filtros: ConsultarDisponibilidad): Promise<Disponibilidad> {
    if (!(await this.aliados.estaActivo(this.db, aliadoId))) {
      throw new NotFoundException('El aliado no existe');
    }
    const servicio = await this.servicios.buscarDisponible(this.db, filtros.servicioId);
    if (!servicio || servicio.aliadoId !== aliadoId) {
      throw new NotFoundException('El servicio no está disponible en este aliado');
    }
    const veterinarios = await this.veterinarios.paraReservar(
      this.db,
      aliadoId,
      filtros.veterinarioId,
    );
    if (filtros.veterinarioId !== undefined && veterinarios.length === 0) {
      throw new NotFoundException('El veterinario no está disponible en este aliado');
    }
    const ids = veterinarios.map((v) => v.id);
    const nombres = new Map(veterinarios.map((v) => [v.id, v.nombre]));

    const espacios =
      ids.length === 0
        ? []
        : await this.agenda.espaciosLibres(this.db, {
            aliadoId,
            veterinarioIds: ids,
            desde: filtros.desde,
            hasta: filtros.hasta,
            duracionMin: servicio.duracionMin,
            ocupados: await this.citas.ocupadosEntre(this.db, ids, filtros.desde, filtros.hasta),
          });

    return {
      aliadoId,
      servicioId: servicio.id,
      duracionMin: servicio.duracionMin,
      espacios: espacios.map((e) => ({
        veterinarioId: e.veterinarioId,
        veterinarioNombre: nombres.get(e.veterinarioId) ?? '',
        inicio: e.inicio,
        fin: e.fin,
      })),
    };
  }
}
