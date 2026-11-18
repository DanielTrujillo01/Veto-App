import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConsultarDisponibilidad,
  Disponibilidad,
  RazonHorarioNoDisponible,
} from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
import { AliadosService } from '../aliados/aliados.service';
import { VeterinariosService } from '../aliados/veterinarios.service';
import { CitasService } from '../citas/citas.service';
import { AgendaRepository } from './agenda.repository';
import { ServiciosRepository } from './servicios.repository';

const MS_MINUTO = 60_000;
const MS_DIA = 24 * 60 * MS_MINUTO;

/** Fecha `AAAA-MM-DD` (UTC) del instante, corrida `dias` días. */
function fechaUtc(instante: Date, dias: number): string {
  return new Date(instante.getTime() + dias * MS_DIA).toISOString().slice(0, 10);
}

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

  /**
   * HU-029 y HU-031: `null` si `inicio` es uno de los espacios que ofrece el calendario de ese
   * veterinario para un servicio de `duracionMin`; si no, la razón. Reutiliza el cálculo de
   * `consultar`, así que lo que el calendario muestra y lo que se acepta nunca se contradicen.
   * Recibe el `client` de la transacción abierta.
   */
  async razonNoDisponible(
    client: Consultor,
    p: { aliadoId: string; veterinarioId: string; duracionMin: number; inicio: Date },
  ): Promise<RazonHorarioNoDisponible | null> {
    if (p.inicio.getTime() <= Date.now()) return 'PASADO';

    // Un día de margen a cada lado: las horas del horario se interpretan en la zona de la base,
    // que no tiene por qué coincidir con el día UTC del instante.
    const desde = fechaUtc(p.inicio, -1);
    const hasta = fechaUtc(p.inicio, 1);
    const libres = await this.agenda.espaciosLibres(client, {
      aliadoId: p.aliadoId,
      veterinarioIds: [p.veterinarioId],
      desde,
      hasta,
      duracionMin: p.duracionMin,
      ocupados: await this.citas.ocupadosEntre(client, [p.veterinarioId], desde, hasta),
    });
    if (libres.some((e) => Date.parse(e.inicio) === p.inicio.getTime())) return null;

    const fin = new Date(p.inicio.getTime() + p.duracionMin * MS_MINUTO);
    const ocupadas = await this.citas.vigentesEnIntervalo(
      client,
      p.veterinarioId,
      p.inicio.toISOString(),
      fin.toISOString(),
    );
    return ocupadas.length > 0 ? 'OCUPADO' : 'NO_DISPONIBLE';
  }
}
