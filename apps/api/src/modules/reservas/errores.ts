import { BadRequestException, ConflictException } from '@nestjs/common';
import { MENSAJES_HORARIO_NO_DISPONIBLE, type RazonHorarioNoDisponible } from '@veto/shared';

/**
 * Otras causas por las que una reserva no avanza, además de las del horario:
 * - `ESPECIE_NO_ATENDIDA`: el aliado no atiende la especie de la mascota.
 * - `YA_CONFIRMADA`: esa reserva ya terminó en una cita; para otra hay que elegir de nuevo.
 * - `DUPLICADA`: el tutor ya tiene una cita igual (misma mascota, servicio y hora).
 */
export type CodigoDeReserva = 'ESPECIE_NO_ATENDIDA' | 'YA_CONFIRMADA' | 'DUPLICADA';

/**
 * El horario no se puede elegir. `razon` le dice a la web qué mostrar: una hora que ya pasó es
 * un dato inválido (400); un espacio ocupado o fuera de la atención es un conflicto (409).
 */
export function errorDeHorario(razon: RazonHorarioNoDisponible, detalle?: string) {
  const cuerpo = { message: detalle ?? MENSAJES_HORARIO_NO_DISPONIBLE[razon], razon };
  return razon === 'PASADO' ? new BadRequestException(cuerpo) : new ConflictException(cuerpo);
}

/** Conflicto de la reserva que no es de horario: `codigo` identifica la causa. */
export function conflictoDeReserva(
  codigo: CodigoDeReserva,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return new ConflictException({ message, codigo, ...extra });
}

/** Un campo del cuerpo no sirve: 400 con el mensaje en `errores.<campo>`. */
export function errorDeCampo(campo: string, mensaje: string) {
  return new BadRequestException({
    message: 'Revisa los datos ingresados',
    errores: { [campo]: mensaje },
  });
}
