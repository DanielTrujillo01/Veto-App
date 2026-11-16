import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  CambioDeEstado,
  CitaActualizada,
  EstadoCita,
  EstadoDeCierre,
  FinalizarCita,
  NoAsistioCita,
} from '@veto/shared';
import { esErrorPg } from '../../common/validacion';
import { DatabaseService } from '../../database/database.service';
import { CitasService } from '../citas/citas.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

const NO_EXISTE = { codigo: 'CITA_NO_ENCONTRADA', message: 'La cita no existe' };
const SIN_PERMISOS = {
  codigo: 'SIN_PERMISOS_CITA',
  message: 'No tienes permiso para gestionar las citas de este aliado',
};

/** Por qué una cita que no está AGENDADA no se puede cerrar. */
function mensajeDeEstado(estado: EstadoCita): string {
  switch (estado) {
    case 'PENDIENTE':
      return 'La cita está pendiente de aceptación: acéptala antes de cerrarla';
    case 'FINALIZADA':
      return 'La cita ya fue finalizada y no admite más cambios';
    case 'NO_ASISTIO':
      return 'La cita ya fue marcada como no asistió y no admite más cambios';
    case 'CANCELADA':
      return 'La cita fue cancelada y no admite cambios';
    default:
      return `La cita está en estado ${estado} y no admite esta operación`;
  }
}

/**
 * HU-032 y HU-033: el aliado cierra una cita agendada cuya hora ya llegó, como finalizada
 * (con recomendaciones para el tutor) o como no asistió (con una observación interna).
 *
 * Todo ocurre en una transacción a nombre del usuario (`app.usuario_id`): se bloquea la cita, se
 * comprueban existencia, permisos, estado y hora, se actualiza —fn_cita_validar vuelve a validar
 * la transición y el trigger de historial anota estado anterior, nuevo, responsable y
 * observación— y, al final, se avisa al tutor. Si algo falla, no queda nada a medias.
 *
 * La notificación se crea después de que el cambio de estado ya se aplicó y dentro de la misma
 * transacción, protegida por un SAVEPOINT: si falla, se pierde solo el aviso (queda en el
 * registro del servidor) y el cambio de estado se confirma igual; si el cambio no se confirma,
 * tampoco queda el aviso. Así nunca hay un aviso de una cita que no cambió ni un cambio perdido
 * por un aviso.
 */
@Injectable()
export class GestionCitaService {
  constructor(
    private readonly db: DatabaseService,
    private readonly citas: CitasService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  finalizar(usuarioId: string, citaId: string, datos: FinalizarCita): Promise<CitaActualizada> {
    return this.cerrar(usuarioId, citaId, 'FINALIZADA', {
      observacion: null,
      recomendaciones: datos.recomendaciones ?? null,
    });
  }

  marcarNoAsistio(
    usuarioId: string,
    citaId: string,
    datos: NoAsistioCita,
  ): Promise<CitaActualizada> {
    return this.cerrar(usuarioId, citaId, 'NO_ASISTIO', {
      observacion: datos.observacion ?? null,
      recomendaciones: null,
    });
  }

  /**
   * Los cambios de estado de la cita. Los ve el tutor de la cita y quienes la gestionan; la
   * observación de una inasistencia solo la ven estos últimos.
   */
  async historial(usuarioId: string, citaId: string): Promise<CambioDeEstado[]> {
    const cita = await this.citas.detalleVisiblePara(this.db, citaId, usuarioId);
    if (!cita) throw new NotFoundException(NO_EXISTE);
    const esAliado = await this.citas.puedeGestionar(this.db, cita.aliado.id, usuarioId);
    return this.citas.historial(this.db, citaId, esAliado);
  }

  private async cerrar(
    usuarioId: string,
    citaId: string,
    estado: EstadoDeCierre,
    datos: { observacion: string | null; recomendaciones: string | null },
  ): Promise<CitaActualizada> {
    return this.db.withUser(usuarioId, async (client) => {
      const cita = await this.citas.bloquearParaCierre(client, citaId);
      if (!cita) throw new NotFoundException(NO_EXISTE);
      if (!(await this.citas.puedeGestionar(client, cita.aliadoId, usuarioId))) {
        throw new ForbiddenException(SIN_PERMISOS);
      }
      if (cita.estado !== 'AGENDADA') {
        throw new ConflictException({
          codigo: 'ESTADO_CITA_INVALIDO',
          message: mensajeDeEstado(cita.estado),
          estadoActual: cita.estado,
        });
      }
      if (!cita.yaOcurrio) {
        throw new UnprocessableEntityException({
          codigo: 'CITA_NO_FINALIZABLE',
          message: 'La cita todavía no ha ocurrido: solo se puede cerrar desde su fecha y hora',
        });
      }

      let cambio;
      try {
        cambio = await this.citas.cerrar(client, { citaId, estado, ...datos });
      } catch (error) {
        // Reglas de fn_cita_validar que la base vuelve a aplicar (permiso, estado final)
        if (esErrorPg(error, '42501')) throw new ForbiddenException(SIN_PERMISOS);
        if (esErrorPg(error, '55000') || esErrorPg(error, '23514')) {
          throw new ConflictException({
            codigo: 'ESTADO_CITA_INVALIDO',
            message: error instanceof Error ? error.message : mensajeDeEstado(cita.estado),
          });
        }
        throw error;
      }
      if (!cambio) {
        // No debería pasar con la cita bloqueada; si pasa, no se confirma nada a medias
        throw new ConflictException({
          codigo: 'ESTADO_CITA_INVALIDO',
          message: 'La cita cambió mientras se procesaba: vuelve a intentarlo',
        });
      }

      const detalle = await this.citas.detalle(client, citaId);
      if (!detalle) throw new Error('La cita recién actualizada no se pudo leer');

      const cuando = `de ${detalle.servicio.nombre} para ${detalle.mascota.nombre} en ${detalle.aliado.nombre}`;
      await this.notificaciones.crearSinRomper(client, {
        usuarioId: detalle.tutor.id,
        tipo: estado === 'FINALIZADA' ? 'CITA_FINALIZADA' : 'CITA_NO_ASISTIO',
        mensaje:
          estado === 'FINALIZADA'
            ? `Tu cita ${cuando} fue marcada como finalizada.` +
              (detalle.recomendaciones ? ' El aliado dejó recomendaciones para ti.' : '')
            : `Tu cita ${cuando} fue marcada como no asistió.`,
        referenciaId: citaId,
      });

      return { ...detalle, ...cambio };
    });
  }
}
