import { z } from 'zod';

/** Días máximos que cubre una consulta de disponibilidad o un bloqueo del calendario. */
export const MAX_DIAS_DISPONIBILIDAD = 31;
export const MAX_DIAS_BLOQUEO = 366;
const MS_DIA = 24 * 60 * 60 * 1000;

/** Instante con zona horaria explícita (`2026-12-24T08:00:00-05:00` o `...Z`). */
const instanteSchema = z.iso.datetime({
  offset: true,
  error: 'Usa fecha y hora con zona horaria, por ejemplo 2026-12-24T08:00:00-05:00',
});

/** Fecha de calendario `AAAA-MM-DD` que existe de verdad (no acepta 2026-02-31). */
const fechaSchema = z.iso.date({ error: 'La fecha debe tener formato AAAA-MM-DD' });

/**
 * HU-022: el aliado bloquea un intervalo de su calendario (vacaciones, permiso, día libre).
 * El bloqueo le gana al horario semanal: en ese intervalo no se puede reservar.
 */
export const crearBloqueoSchema = z
  .object({
    inicio: instanteSchema,
    fin: instanteSchema,
    motivo: z
      .string()
      .trim()
      .max(200, 'El motivo admite máximo 200 caracteres')
      .optional()
      .transform((m) => (m ? m : undefined)),
  })
  .refine((b) => Date.parse(b.fin) > Date.parse(b.inicio), {
    message: 'El fin debe ser posterior al inicio',
    path: ['fin'],
  })
  .refine((b) => Date.parse(b.fin) <= Date.parse(b.inicio) + MAX_DIAS_BLOQUEO * MS_DIA, {
    message: `Un bloqueo no puede durar más de ${MAX_DIAS_BLOQUEO} días`,
    path: ['fin'],
  });
export type CrearBloqueo = z.infer<typeof crearBloqueoSchema>;

/** Bloqueo tal como lo devuelve la API. */
export type BloqueoAgenda = {
  id: string;
  veterinarioId: string;
  inicio: string;
  fin: string;
  motivo: string | null;
};

/**
 * HU-022: el tutor consulta los espacios libres de un aliado para un servicio.
 * `desde` y `hasta` son fechas de calendario (ambas incluidas).
 */
export const consultarDisponibilidadSchema = z
  .object({
    servicioId: z.uuid('El servicio no es válido'),
    desde: fechaSchema,
    hasta: fechaSchema,
    veterinarioId: z.uuid('El veterinario no es válido').optional(),
  })
  .refine((q) => q.hasta >= q.desde, {
    message: 'La fecha final no puede ser anterior a la inicial',
    path: ['hasta'],
  })
  .refine((q) => diasEntre(q.desde, q.hasta) < MAX_DIAS_DISPONIBILIDAD, {
    message: `Consulta como máximo ${MAX_DIAS_DISPONIBILIDAD} días a la vez`,
    path: ['hasta'],
  });
export type ConsultarDisponibilidad = z.infer<typeof consultarDisponibilidadSchema>;

function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(hasta) - Date.parse(desde)) / MS_DIA);
}

/** Un espacio reservable: el servicio cabe completo entre `inicio` y `fin`. */
export type EspacioDisponible = {
  veterinarioId: string;
  veterinarioNombre: string;
  inicio: string;
  fin: string;
};

export type Disponibilidad = {
  aliadoId: string;
  servicioId: string;
  duracionMin: number;
  espacios: EspacioDisponible[];
};

/** Minutos que se conserva la selección de fecha y hora si la persona no la cambia ni la confirma. */
export const MINUTOS_VIGENCIA_SELECCION = 60;

/**
 * HU-029: el tutor elige un espacio del calendario del aliado. Solo se envía lo que el calendario
 * le mostró (servicio, veterinario e inicio): el fin lo calcula la API con la duración del servicio.
 */
export const seleccionarHorarioSchema = z.object({
  servicioId: z.uuid('El servicio no es válido'),
  veterinarioId: z.uuid('El veterinario no es válido'),
  inicio: instanteSchema,
});
export type SeleccionarHorario = z.infer<typeof seleccionarHorarioSchema>;

/**
 * Por qué un horario no se puede elegir:
 * - `PASADO`: la fecha y hora ya pasaron.
 * - `OCUPADO`: otra cita ya ocupa ese espacio.
 * - `NO_DISPONIBLE`: el aliado no atiende así (fuera del horario, bloqueado o no es uno de los espacios que ofrece).
 */
export const MOTIVOS_HORARIO_NO_DISPONIBLE = ['PASADO', 'OCUPADO', 'NO_DISPONIBLE'] as const;
export type MotivoHorarioNoDisponible = (typeof MOTIVOS_HORARIO_NO_DISPONIBLE)[number];

export const MENSAJES_HORARIO_NO_DISPONIBLE: Record<MotivoHorarioNoDisponible, string> = {
  PASADO: 'No puedes elegir una fecha u hora que ya pasó',
  OCUPADO: 'Ese horario ya fue tomado: elige otro',
  NO_DISPONIBLE: 'El aliado no atiende en ese horario: elige uno del calendario',
};

/** Fecha y hora elegidas en el calendario, tal como se conservan mientras avanza la reserva. */
export type SeleccionHorario = {
  aliadoId: string;
  servicioId: string;
  servicioNombre: string;
  veterinarioId: string;
  veterinarioNombre: string;
  inicio: string;
  fin: string;
  /** Hasta cuándo se conserva si no se vuelve a elegir. */
  venceEn: string;
};

/**
 * La selección guardada y si todavía se puede reservar: otra persona pudo tomar el espacio, el
 * aliado pudo bloquearlo o la hora pudo pasar desde que se eligió.
 */
export type EstadoSeleccionHorario =
  | (SeleccionHorario & { vigente: true })
  | (SeleccionHorario & { vigente: false; motivo: MotivoHorarioNoDisponible });
