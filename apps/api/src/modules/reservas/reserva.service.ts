import { Injectable, NotFoundException } from '@nestjs/common';
import {
  MENSAJES_HORARIO_NO_DISPONIBLE,
  type CitaDetalle,
  type PendienteDeReserva,
  type ReservaConfirmada,
  type ResumenReserva,
} from '@veto/shared';
import { esErrorPg, PG } from '../../common/validacion';
import { DatabaseService } from '../../database/database.service';
import { AliadoConfirmacionService } from '../aliados/aliado-confirmacion.service';
import { AliadoEspeciesService } from '../aliados/aliado-especies.service';
import { AliadosService } from '../aliados/aliados.service';
import { VeterinariosService } from '../aliados/veterinarios.service';
import { CitasService } from '../citas/citas.service';
import { MascotasService } from '../mascotas/mascotas.service';
import { DisponibilidadService } from '../servicios/disponibilidad.service';
import { ServiciosService } from '../servicios/servicios.service';
import { conflictoDeReserva, errorDeCampo, errorDeHorario } from './errores';
import { SeleccionHorarioService } from './seleccion-horario.service';

const MS_MINUTO = 60_000;
const VIGENTES = ['PENDIENTE', 'AGENDADA'];

/**
 * HU-031: el tutor revisa los datos de su reserva y la confirma.
 *
 * - `resumen` muestra todo lo que se va a reservar y dice qué falta o ya no sirve, sin crear nada.
 * - `confirmar` vuelve a validar todo dentro de una transacción y crea la cita con la fecha, hora,
 *   mascota, servicio, aliado y motivo elegidos. El estado lo fija la base de datos según cómo el
 *   aliado confirma sus citas (AGENDADA o PENDIENTE); aquí solo se devuelve el que quedó.
 *
 * Sin duplicados: la confirmación bloquea la reserva en curso del tutor, así que un doble clic
 * espera a la primera y recibe la misma cita (`repetida: true`) en vez de crear otra. La base
 * también impide una cita igual (misma mascota, servicio y hora) y dos citas en el mismo espacio.
 */
@Injectable()
export class ReservaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly seleccion: SeleccionHorarioService,
    private readonly servicios: ServiciosService,
    private readonly disponibilidad: DisponibilidadService,
    private readonly veterinarios: VeterinariosService,
    private readonly aliados: AliadosService,
    private readonly confirmacion: AliadoConfirmacionService,
    private readonly especies: AliadoEspeciesService,
    private readonly mascotas: MascotasService,
    private readonly citas: CitasService,
  ) {}

  /** Datos principales de la reserva, el precio, el estado en que quedará y lo que falta. */
  async resumen(tutorId: string): Promise<ResumenReserva> {
    const seleccion = await this.seleccion.obtener(tutorId);
    const pendientes: PendienteDeReserva[] = [];

    const aliado = await this.aliados.obtenerPublico(seleccion.aliadoId).catch(() => null);
    const modo = await this.confirmacion.obtenerPublica(seleccion.aliadoId).catch(() => null);

    if (seleccion.citaId) {
      pendientes.push({ campo: 'reserva', mensaje: 'Esta reserva ya se confirmó' });
    } else if (!seleccion.vigente) {
      pendientes.push({
        campo: 'horario',
        mensaje: MENSAJES_HORARIO_NO_DISPONIBLE[seleccion.razon],
      });
    }

    let precio: number | null = null;
    if (!seleccion.mascotaId) {
      pendientes.push({ campo: 'mascotaId', mensaje: 'Elige la mascota para la cita' });
    } else {
      const mascota = await this.mascotas.obtener(tutorId, seleccion.mascotaId).catch(() => null);
      if (!mascota) {
        pendientes.push({
          campo: 'mascotaId',
          mensaje: 'La mascota elegida ya no está disponible',
        });
      } else if (
        !(await this.especies.atiendeEspecie(this.db, seleccion.aliadoId, mascota.especieId))
      ) {
        pendientes.push({
          campo: 'mascotaId',
          mensaje: `El aliado no atiende la especie de ${mascota.nombre} (${mascota.especie})`,
        });
      } else if (seleccion.vigente || seleccion.citaId) {
        precio = (
          await this.servicios.cotizarParaMascota(tutorId, seleccion.servicioId, mascota.id)
        ).precio;
      }
    }

    return {
      seleccion,
      aliadoNombre: aliado?.nombre ?? '',
      precio,
      estadoInicial: modo?.estadoInicialCita ?? null,
      listo: pendientes.length === 0,
      pendientes,
    };
  }

  /** Crea la cita con la reserva en curso, o devuelve la que ya se creó con ella. */
  async confirmar(tutorId: string): Promise<ReservaConfirmada> {
    return this.db.withUser(tutorId, async (client) => {
      // Bloquea la reserva del tutor: dos confirmaciones a la vez se turnan
      const borrador = await this.citas.obtenerSeleccionParaReservar(client, tutorId);
      if (!borrador) {
        throw new NotFoundException('No hay una reserva en curso: elige fecha y hora primero');
      }

      // Doble clic o reintento: ya se creó la cita de esta reserva
      if (borrador.citaId) {
        const existente = await this.citas.detalle(client, borrador.citaId);
        if (existente && VIGENTES.includes(existente.estado)) {
          return { ...existente, repetida: true };
        }
        throw conflictoDeReserva(
          'YA_CONFIRMADA',
          'Esa reserva ya terminó: elige fecha y hora para hacer otra',
        );
      }

      // Campos requeridos
      if (!borrador.mascotaId) throw errorDeCampo('mascotaId', 'Elige la mascota para la cita');
      const mascota = await this.mascotas.buscarDelTutor(client, tutorId, borrador.mascotaId);
      if (!mascota) throw errorDeCampo('mascotaId', 'La mascota elegida ya no está disponible');

      // Disponibilidad: lo elegido sigue siendo un espacio libre del aliado
      const servicio = await this.servicios.buscarDisponibleParaReservar(
        client,
        borrador.servicioId,
      );
      const [veterinario] = servicio
        ? await this.veterinarios.paraReservar(client, borrador.aliadoId, borrador.veterinarioId)
        : [];
      if (!servicio || !veterinario) throw errorDeHorario('NO_DISPONIBLE');
      const inicio = new Date(borrador.inicio);
      const fin = new Date(inicio.getTime() + servicio.duracionMin * MS_MINUTO);
      if (fin.getTime() !== Date.parse(borrador.fin)) throw errorDeHorario('NO_DISPONIBLE');
      const razon = await this.disponibilidad.razonNoDisponible(client, {
        aliadoId: borrador.aliadoId,
        veterinarioId: veterinario.id,
        duracionMin: servicio.duracionMin,
        inicio,
      });
      if (razon) throw errorDeHorario(razon);

      if (!(await this.especies.atiendeEspecie(client, borrador.aliadoId, mascota.especieId))) {
        throw conflictoDeReserva(
          'ESPECIE_NO_ATENDIDA',
          `El aliado no atiende la especie de ${mascota.nombre} (${mascota.especie})`,
        );
      }

      // Una cita igual que ya tiene el tutor (misma mascota, servicio y hora)
      const igual = await this.citas.buscarVigenteIgual(client, {
        tutorId,
        mascotaId: mascota.id,
        servicioId: servicio.id,
        inicio: inicio.toISOString(),
      });
      if (igual) {
        throw conflictoDeReserva(
          'DUPLICADA',
          `Ya tienes una cita para ${mascota.nombre} en ese horario`,
          { citaId: igual },
        );
      }

      let citaId: string;
      try {
        citaId = await this.citas.crearCita(client, {
          tutorId,
          mascotaId: mascota.id,
          aliadoId: borrador.aliadoId,
          servicioId: servicio.id,
          veterinarioId: veterinario.id,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          motivo: borrador.motivo,
        });
      } catch (error) {
        // Otra reserva se llevó el espacio entre la comprobación y la inserción
        if (esErrorPg(error, PG.EXCLUSION)) throw errorDeHorario('OCUPADO');
        if (esErrorPg(error, PG.UNICO)) {
          throw conflictoDeReserva(
            'DUPLICADA',
            `Ya tienes una cita para ${mascota.nombre} en ese horario`,
          );
        }
        // Las demás reglas de la base (horario, bloqueo, especie, servicio) traen su propio mensaje
        if (esErrorPg(error, PG.CHECK)) {
          throw errorDeHorario('NO_DISPONIBLE', (error as Error).message);
        }
        throw error;
      }

      await this.citas.marcarSeleccionReservada(client, tutorId, citaId);
      const creada = await this.citas.detalle(client, citaId);
      if (!creada) throw new Error('La cita recién creada no se pudo leer');
      return { ...creada, repetida: false };
    });
  }

  /** HU-030: el detalle de una cita (con su motivo) para quien tiene permiso de verla. */
  async detalleDeCita(usuarioId: string, citaId: string): Promise<CitaDetalle> {
    const detalle = await this.citas.detalleVisiblePara(this.db, citaId, usuarioId);
    if (!detalle) throw new NotFoundException('La cita no existe');
    return detalle;
  }
}
