import { z } from 'zod';
import type { EstadoCita } from './enums';
import type { CitaDetalle } from './reserva';
import { textoLibreSchema } from './texto-libre';

/** Límite de la observación con que el aliado marca una inasistencia (HU-032). */
export const OBSERVACION_CITA_MAX_CARACTERES = 500;

/** Límite de las recomendaciones del aliado al finalizar una cita (HU-033). La base lo exige igual. */
export const RECOMENDACIONES_MAX_CARACTERES = 2000;

/** Nota interna sobre la inasistencia (solo la ve el aliado). Vacía o `null` significa "sin observación". */
export const observacionCitaSchema = textoLibreSchema({
  maximo: OBSERVACION_CITA_MAX_CARACTERES,
  noEsTexto: 'La observación debe ser un texto',
  conControl: 'La observación tiene caracteres que no se permiten',
  demasiadoLargo: (escritos) =>
    `La observación admite máximo ${OBSERVACION_CITA_MAX_CARACTERES} caracteres (escribiste ${escritos})`,
});

/** Lo que el aliado recomienda al tutor. Vacío o `null` significa "sin recomendaciones". */
export const recomendacionesCitaSchema = textoLibreSchema({
  maximo: RECOMENDACIONES_MAX_CARACTERES,
  noEsTexto: 'Las recomendaciones deben ser un texto',
  conControl: 'Las recomendaciones tienen caracteres que no se permiten',
  demasiadoLargo: (escritos) =>
    `Las recomendaciones admiten máximo ${RECOMENDACIONES_MAX_CARACTERES} caracteres (escribiste ${escritos})`,
});

/**
 * HU-032 y HU-033: el aliado marca una cita agendada como finalizada. Las recomendaciones (las ve
 * el tutor) son opcionales y el cuerpo puede venir vacío. Finalizar no lleva observación: la
 * atención se documenta en la consulta clínica y lo que el tutor debe saber, en las
 * recomendaciones; si llega una `observacion`, se ignora.
 */
export const finalizarCitaSchema = z.object({
  recomendaciones: recomendacionesCitaSchema.nullable().optional(),
});
export type FinalizarCita = z.infer<typeof finalizarCitaSchema>;

/** HU-032: el aliado marca que el tutor no asistió. La observación (nota interna) es opcional. */
export const noAsistioCitaSchema = z.object({
  observacion: observacionCitaSchema.nullable().optional(),
});
export type NoAsistioCita = z.infer<typeof noAsistioCitaSchema>;

/** Estados a los que el aliado puede llevar una cita agendada una vez que su hora llegó. */
export type EstadoDeCierre = Extract<EstadoCita, 'FINALIZADA' | 'NO_ASISTIO'>;

/** Respuesta de finalizar o marcar la inasistencia: la cita ya actualizada y quién la cambió. */
export type CitaActualizada = CitaDetalle & {
  /** Cuándo se registró el cambio (lo mismo que quedó en el historial de estados). */
  actualizadoEn: string;
  actualizadoPor: string;
};

/** Un cambio de estado de una cita, tal como queda en `historial_estado`. */
export type CambioDeEstado = {
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  cambiadoEn: string;
  /** Quién lo hizo; `null` si lo hizo el sistema. */
  cambiadoPor: string | null;
  /** Observación o motivo del cambio. Solo la ve el aliado; para el tutor es `null`. */
  observacion: string | null;
};
