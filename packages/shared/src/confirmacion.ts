import { z } from 'zod';
import { MODOS_CONFIRMACION, type EstadoCita, type ModoConfirmacion } from './enums';

/**
 * HU-023: el aliado Vet elige si sus citas se confirman solas (AUTOMATICA) o si él las acepta
 * (MANUAL). Solo afecta a las reservas nuevas: las citas pendientes siguen su curso.
 */
export const guardarConfirmacionSchema = z.object({
  modo: z.enum(MODOS_CONFIRMACION, { error: 'Elige confirmación automática o manual' }),
});
export type GuardarConfirmacion = z.infer<typeof guardarConfirmacionSchema>;

/**
 * Estado con el que nace una reserva válida según el modo. La base de datos aplica esta misma
 * regla al insertar la cita (trigger fn_cita_validar); aquí se usa para avisar al tutor antes de
 * reservar. Una cita AGENDADA es una cita confirmada.
 */
export function estadoInicialDeCita(
  modo: ModoConfirmacion,
): Extract<EstadoCita, 'AGENDADA' | 'PENDIENTE'> {
  return modo === 'MANUAL' ? 'PENDIENTE' : 'AGENDADA';
}

/** Configuración de confirmación de un aliado, tal como la devuelve la API. */
export type ConfirmacionAliado = {
  modo: ModoConfirmacion;
  /** Estado en que quedará la próxima reserva: lo que verá el tutor. */
  estadoInicialCita: 'AGENDADA' | 'PENDIENTE';
};

export function confirmacionDe(modo: ModoConfirmacion): ConfirmacionAliado {
  return { modo, estadoInicialCita: estadoInicialDeCita(modo) };
}
