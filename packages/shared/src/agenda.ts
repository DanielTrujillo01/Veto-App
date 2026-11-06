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
