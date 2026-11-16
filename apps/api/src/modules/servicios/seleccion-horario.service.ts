import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MENSAJES_HORARIO_NO_DISPONIBLE,
  type EstadoSeleccionHorario,
  type MotivoHorarioNoDisponible,
  type SeleccionarHorario,
} from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
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

/** La respuesta de error: `motivo` le dice a la web qué mensaje y qué acción mostrar. */
function errorDeHorario(motivo: MotivoHorarioNoDisponible) {
  const cuerpo = { message: MENSAJES_HORARIO_NO_DISPONIBLE[motivo], motivo };
  return motivo === 'PASADO' ? new BadRequestException(cuerpo) : new ConflictException(cuerpo);
}

/**
 * HU-029: el tutor elige fecha y hora en el calendario del aliado.
 *
 * La API vuelve a comprobar en cada elección que el espacio sea uno de los que ofrece la
 * disponibilidad (HU-022): no pasado, dentro del horario, fuera de bloqueos y sin otra cita.
 * Lo elegido se conserva por tutor (tabla `seleccion_horario`, del módulo citas) para que siga ahí
 * al avanzar en la reserva, pero NO se reserva: el espacio solo queda ocupado cuando se crea la
 * cita (HU-031), cuya validación en la base sigue siendo la que manda.
 */
@Injectable()
export class SeleccionHorarioService {
  constructor(
    private readonly db: DatabaseService,
    private readonly agenda: AgendaRepository,
    private readonly servicios: ServiciosRepository,
    private readonly veterinarios: VeterinariosService,
    private readonly citas: CitasService,
  ) {}

  /** Elige (o cambia) la fecha y hora. Responde 400 si ya pasó y 409 si está ocupada o no se atiende. */
  async seleccionar(tutorId: string, datos: SeleccionarHorario): Promise<EstadoSeleccionHorario> {
    return this.db.withUser(tutorId, async (client) => {
      const servicio = await this.servicios.buscarDisponible(client, datos.servicioId);
      if (!servicio) throw new NotFoundException('El servicio no está disponible');
      const [veterinario] = await this.veterinarios.paraReservar(
        client,
        servicio.aliadoId,
        datos.veterinarioId,
      );
      if (!veterinario) {
        throw new NotFoundException('El veterinario no está disponible en este aliado');
      }

      const inicio = new Date(datos.inicio);
      const motivo = await this.motivoNoDisponible(
        client,
        servicio.aliadoId,
        veterinario.id,
        servicio.duracionMin,
        inicio,
      );
      if (motivo) throw errorDeHorario(motivo);

      const fin = new Date(inicio.getTime() + servicio.duracionMin * MS_MINUTO);
      const { venceEn } = await this.citas.guardarSeleccion(client, {
        tutorId,
        aliadoId: servicio.aliadoId,
        servicioId: servicio.id,
        veterinarioId: veterinario.id,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
      });
      return {
        aliadoId: servicio.aliadoId,
        servicioId: servicio.id,
        servicioNombre: servicio.nombre,
        veterinarioId: veterinario.id,
        veterinarioNombre: veterinario.nombre,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        venceEn,
        vigente: true,
      };
    });
  }

  /**
   * La selección guardada, vuelta a revisar: si entretanto otra persona tomó el espacio, el
   * aliado lo bloqueó o la hora pasó, responde `vigente: false` con el `motivo` para que la web
   * pida elegir de nuevo en vez de seguir con un horario que ya no sirve.
   */
  async obtener(tutorId: string): Promise<EstadoSeleccionHorario> {
    const guardada = await this.citas.obtenerSeleccion(this.db, tutorId);
    if (!guardada) throw new NotFoundException('No hay una fecha y hora seleccionadas');

    const servicio = await this.servicios.buscarDisponible(this.db, guardada.servicioId);
    const [veterinario] = servicio
      ? await this.veterinarios.paraReservar(this.db, guardada.aliadoId, guardada.veterinarioId)
      : [];
    const base = {
      aliadoId: guardada.aliadoId,
      servicioId: guardada.servicioId,
      servicioNombre: servicio?.nombre ?? '',
      veterinarioId: guardada.veterinarioId,
      veterinarioNombre: veterinario?.nombre ?? '',
      inicio: guardada.inicio,
      fin: guardada.fin,
      venceEn: guardada.venceEn,
    };

    // El servicio o el veterinario ya no están, o el servicio cambió de duración desde que se eligió
    const finActual =
      servicio && new Date(Date.parse(guardada.inicio) + servicio.duracionMin * MS_MINUTO);
    if (
      !servicio ||
      !veterinario ||
      !finActual ||
      finActual.getTime() !== Date.parse(guardada.fin)
    ) {
      return { ...base, vigente: false, motivo: 'NO_DISPONIBLE' };
    }
    const motivo = await this.motivoNoDisponible(
      this.db,
      guardada.aliadoId,
      veterinario.id,
      servicio.duracionMin,
      new Date(guardada.inicio),
    );
    return motivo ? { ...base, vigente: false, motivo } : { ...base, vigente: true };
  }

  /** Descarta la selección (por ejemplo, al cancelar la reserva). No falla si no había. */
  async descartar(tutorId: string): Promise<void> {
    await this.db.withUser(tutorId, (client) => this.citas.eliminarSeleccion(client, tutorId));
  }

  /**
   * `null` si `inicio` es uno de los espacios que ofrece el calendario de ese veterinario; si no,
   * el motivo. Reutiliza el cálculo de la disponibilidad (HU-022), así que lo que el calendario
   * muestra y lo que acepta esta validación nunca se contradicen.
   */
  private async motivoNoDisponible(
    client: Consultor,
    aliadoId: string,
    veterinarioId: string,
    duracionMin: number,
    inicio: Date,
  ): Promise<MotivoHorarioNoDisponible | null> {
    if (inicio.getTime() <= Date.now()) return 'PASADO';

    // Un día de margen a cada lado: las horas del horario se interpretan en la zona de la base,
    // que no tiene por qué coincidir con el día UTC del instante.
    const desde = fechaUtc(inicio, -1);
    const hasta = fechaUtc(inicio, 1);
    const libres = await this.agenda.espaciosLibres(client, {
      aliadoId,
      veterinarioIds: [veterinarioId],
      desde,
      hasta,
      duracionMin,
      ocupados: await this.citas.ocupadosEntre(client, [veterinarioId], desde, hasta),
    });
    if (libres.some((e) => Date.parse(e.inicio) === inicio.getTime())) return null;

    const fin = new Date(inicio.getTime() + duracionMin * MS_MINUTO);
    const ocupadas = await this.citas.vigentesEnIntervalo(
      client,
      veterinarioId,
      inicio.toISOString(),
      fin.toISOString(),
    );
    return ocupadas.length > 0 ? 'OCUPADO' : 'NO_DISPONIBLE';
  }
}
