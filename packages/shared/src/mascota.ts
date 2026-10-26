import { z } from 'zod';
import { SEXOS_ANIMAL } from './enums';

/** HU-008: nombre, especie y sexo son obligatorios; el resto es opcional. */
export const crearMascotaSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  especieId: z.number().int().positive(),
  sexo: z.enum(SEXOS_ANIMAL),
  raza: z.string().trim().max(80).optional(),
  fechaNacimiento: z.iso.date().optional(),
  edadMeses: z.number().int().min(0).max(600).optional(),
  color: z.string().trim().max(60).optional(),
  pesoKg: z.number().positive().max(500).optional(),
  chip: z.string().trim().max(40).optional(),
});
export type CrearMascota = z.infer<typeof crearMascotaSchema>;
