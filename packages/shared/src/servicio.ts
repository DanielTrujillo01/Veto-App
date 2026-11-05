import { z } from 'zod';
import { MODALIDADES_SERVICIO } from './enums';

/**
 * HU-018: datos de un servicio del aliado. Crear y editar usan el mismo esquema.
 * Si el servicio es en sede, la sede es obligatoria.
 */
export const guardarServicioSchema = z
  .object({
    tipoServicioId: z.number({ error: 'El tipo de servicio es obligatorio' }).int().positive(),
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
    descripcion: z.string().trim().min(1).max(2_000).optional(),
    modalidad: z.enum(MODALIDADES_SERVICIO, {
      error: 'La modalidad debe ser EN_SEDE o A_DOMICILIO',
    }),
    sedeId: z.uuid('La sede no es válida').optional(),
    duracionMin: z
      .number({ error: 'La duración es obligatoria' })
      .int()
      .min(5, 'La duración mínima es 5 minutos')
      .max(480, 'La duración máxima es 480 minutos')
      .multipleOf(5, 'La duración debe ser múltiplo de 5 minutos'),
    precioBase: z
      .number({ error: 'El precio es obligatorio' })
      .min(0, 'El precio no puede ser negativo')
      .max(9_999_999_999.99)
      .multipleOf(0.01, 'El precio admite máximo dos decimales'),
  })
  .refine((s) => s.modalidad !== 'EN_SEDE' || s.sedeId !== undefined, {
    message: 'Un servicio en sede debe indicar la sede',
    path: ['sedeId'],
  });
export type GuardarServicio = z.infer<typeof guardarServicioSchema>;

/** Servicio tal como lo devuelve la API. */
export type Servicio = {
  id: string;
  aliadoId: string;
  tipoServicioId: number;
  tipoServicio: string;
  nombre: string;
  descripcion: string | null;
  modalidad: (typeof MODALIDADES_SERVICIO)[number];
  sedeId: string | null;
  duracionMin: number;
  precioBase: number;
  activo: boolean;
  creadoEn: string;
};
