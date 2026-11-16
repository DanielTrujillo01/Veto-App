import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CompletarReserva,
  EstadoSeleccionHorario,
  SeleccionarHorario,
  SeleccionHorario,
} from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
import { AliadoEspeciesService } from '../aliados/aliado-especies.service';
import { VeterinariosService } from '../aliados/veterinarios.service';
import { CitasService, type SeleccionGuardada } from '../citas/citas.service';
import { MascotasService } from '../mascotas/mascotas.service';
import { DisponibilidadService } from '../servicios/disponibilidad.service';
import { ServiciosService } from '../servicios/servicios.service';
import { conflictoDeReserva, errorDeCampo, errorDeHorario } from './errores';

const MS_MINUTO = 60_000;

/**
 * Lo que el tutor lleva elegido de su reserva mientras avanza por el flujo (HU-029, HU-030).
 *
 * La API vuelve a comprobar en cada elección que el espacio sea uno de los que ofrece la
 * disponibilidad (HU-022): no pasado, dentro del horario, fuera de bloqueos y sin otra cita.
 * Lo elegido se conserva por tutor (tabla `seleccion_horario`, del módulo citas) para que siga ahí
 * al avanzar o recargar, pero NO se reserva: el espacio solo queda ocupado cuando se confirma la
 * reserva (HU-031), cuya validación en la base sigue siendo la que manda.
 */
@Injectable()
export class SeleccionHorarioService {
  constructor(
    private readonly db: DatabaseService,
    private readonly servicios: ServiciosService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly veterinarios: VeterinariosService,
    private readonly citas: CitasService,
    private readonly mascotas: MascotasService,
    private readonly especies: AliadoEspeciesService,
  ) {}

  /** Elige (o cambia) la fecha y hora. Responde 400 si ya pasó y 409 si está ocupada o no se atiende. */
  async seleccionar(tutorId: string, datos: SeleccionarHorario): Promise<EstadoSeleccionHorario> {
    return this.db.withUser(tutorId, async (client) => {
      const servicio = await this.servicios.buscarDisponibleParaReservar(client, datos.servicioId);
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
      const razon = await this.disponibilidad.razonNoDisponible(client, {
        aliadoId: servicio.aliadoId,
        veterinarioId: veterinario.id,
        duracionMin: servicio.duracionMin,
        inicio,
      });
      if (razon) throw errorDeHorario(razon);

      const fin = new Date(inicio.getTime() + servicio.duracionMin * MS_MINUTO);
      const guardada = await this.citas.guardarSeleccion(client, {
        tutorId,
        aliadoId: servicio.aliadoId,
        servicioId: servicio.id,
        veterinarioId: veterinario.id,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
      });
      const mascota = guardada.mascotaId
        ? await this.mascotas.buscarDelTutor(client, tutorId, guardada.mascotaId)
        : null;
      return {
        aliadoId: servicio.aliadoId,
        servicioId: servicio.id,
        servicioNombre: servicio.nombre,
        veterinarioId: veterinario.id,
        veterinarioNombre: veterinario.nombre,
        inicio: inicio.toISOString(),
        fin: fin.toISOString(),
        venceEn: guardada.venceEn,
        mascotaId: mascota?.id ?? null,
        mascotaNombre: mascota?.nombre ?? null,
        motivo: guardada.motivo,
        citaId: null,
        vigente: true,
      };
    });
  }

  /**
   * HU-030 y HU-031: guarda la mascota y/o el motivo de la cita. El motivo se valida con
   * `motivoCitaSchema` (máximo 500 caracteres) antes de llegar aquí; texto vacío o `null` lo quita.
   * La mascota debe ser del tutor y de una especie que el aliado atienda. Solo se puede mientras
   * la reserva no se haya confirmado.
   */
  async completar(tutorId: string, datos: CompletarReserva): Promise<EstadoSeleccionHorario> {
    return this.db.withUser(tutorId, async (client) => {
      const guardada = await this.citas.obtenerSeleccion(client, tutorId);
      if (!guardada) throw new NotFoundException('Primero elige fecha y hora en el calendario');
      if (guardada.citaId) throw this.yaConfirmada();

      if (datos.mascotaId !== undefined) {
        const mascota = await this.mascotas.buscarDelTutor(client, tutorId, datos.mascotaId);
        if (!mascota) throw errorDeCampo('mascotaId', 'La mascota no existe o no es tuya');
        if (!(await this.especies.atiendeEspecie(client, guardada.aliadoId, mascota.especieId))) {
          throw conflictoDeReserva(
            'ESPECIE_NO_ATENDIDA',
            `El aliado no atiende la especie de ${mascota.nombre} (${mascota.especie})`,
          );
        }
      }

      const cambios: { mascotaId?: string; motivo?: string | null } = {};
      if (datos.mascotaId !== undefined) cambios.mascotaId = datos.mascotaId;
      if (datos.motivo !== undefined) cambios.motivo = datos.motivo;
      if (!(await this.citas.actualizarSeleccion(client, tutorId, cambios))) {
        // Entre la lectura y la escritura la reserva se confirmó o venció
        const ahora = await this.citas.obtenerSeleccion(client, tutorId);
        if (!ahora) throw new NotFoundException('Primero elige fecha y hora en el calendario');
        throw this.yaConfirmada();
      }
      const actual = await this.citas.obtenerSeleccion(client, tutorId);
      return this.estadoDe(client, tutorId, actual ?? guardada);
    });
  }

  /**
   * La reserva en curso, vuelta a comprobar: si entretanto otra persona tomó el espacio, el aliado
   * lo bloqueó o la hora pasó, responde `vigente: false` con la `razon` para que la web pida
   * elegir de nuevo en vez de seguir con un horario que ya no sirve.
   */
  async obtener(tutorId: string): Promise<EstadoSeleccionHorario> {
    const guardada = await this.citas.obtenerSeleccion(this.db, tutorId);
    if (!guardada) throw new NotFoundException('No hay una fecha y hora seleccionadas');
    return this.estadoDe(this.db, tutorId, guardada);
  }

  /** Descarta la reserva en curso (por ejemplo, al cancelar). No falla si no había. */
  async descartar(tutorId: string): Promise<void> {
    await this.db.withUser(tutorId, (client) => this.citas.eliminarSeleccion(client, tutorId));
  }

  private yaConfirmada() {
    return conflictoDeReserva(
      'YA_CONFIRMADA',
      'Esta reserva ya se confirmó: elige fecha y hora para hacer otra',
    );
  }

  /** Arma la respuesta con los nombres y comprueba si el horario sigue sirviendo. */
  private async estadoDe(
    client: Consultor,
    tutorId: string,
    guardada: SeleccionGuardada,
  ): Promise<EstadoSeleccionHorario> {
    const servicio = await this.servicios.buscarDisponibleParaReservar(client, guardada.servicioId);
    const [veterinario] = servicio
      ? await this.veterinarios.paraReservar(client, guardada.aliadoId, guardada.veterinarioId)
      : [];
    const mascota = guardada.mascotaId
      ? await this.mascotas.buscarDelTutor(client, tutorId, guardada.mascotaId)
      : null;
    const base: SeleccionHorario = {
      aliadoId: guardada.aliadoId,
      servicioId: guardada.servicioId,
      servicioNombre: servicio?.nombre ?? '',
      veterinarioId: guardada.veterinarioId,
      veterinarioNombre: veterinario?.nombre ?? '',
      inicio: guardada.inicio,
      fin: guardada.fin,
      venceEn: guardada.venceEn,
      mascotaId: mascota?.id ?? null,
      mascotaNombre: mascota?.nombre ?? null,
      motivo: guardada.motivo,
      citaId: guardada.citaId,
    };

    // Ya se confirmó: el espacio es de su propia cita, no hay nada que volver a comprobar
    if (guardada.citaId) return { ...base, vigente: true };

    // El servicio o el veterinario ya no están, o el servicio cambió de duración desde que se eligió
    const finActual = servicio && Date.parse(guardada.inicio) + servicio.duracionMin * MS_MINUTO;
    if (!servicio || !veterinario || finActual !== Date.parse(guardada.fin)) {
      return { ...base, vigente: false, razon: 'NO_DISPONIBLE' };
    }
    const razon = await this.disponibilidad.razonNoDisponible(client, {
      aliadoId: guardada.aliadoId,
      veterinarioId: veterinario.id,
      duracionMin: servicio.duracionMin,
      inicio: new Date(guardada.inicio),
    });
    return razon ? { ...base, vigente: false, razon } : { ...base, vigente: true };
  }
}
