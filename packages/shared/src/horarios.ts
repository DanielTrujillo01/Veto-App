import { z } from 'zod';

const horaSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:MM');
const fechaSchema = z.coerce.date();

export const franjaHorarioSchema = z
  .object({
    diaSemana: z.number().int().min(1).max(7),
    horaInicio: horaSchema,
    horaFin: horaSchema,
    vigenteDesde: fechaSchema.optional(),
    vigenteHasta: fechaSchema.optional(),
  })
  .refine((horario) => horario.horaInicio < horario.horaFin, {
    message: 'La hora de fin debe ser posterior a la hora de inicio',
    path: ['horaFin'],
  })
  .refine(
    (horario) =>
      horario.vigenteHasta === undefined ||
      horario.vigenteDesde === undefined ||
      horario.vigenteHasta >= horario.vigenteDesde,
    {
      message: 'La fecha final debe ser posterior o igual a la fecha inicial',
      path: ['vigenteHasta'],
    },
  );

export const guardarHorariosSchema = z.object({
  horarios: z.array(franjaHorarioSchema).min(1, 'Debe configurar al menos un horario'),
});

export type GuardarHorarios = z.infer<typeof guardarHorariosSchema>;
