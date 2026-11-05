import { z } from 'zod';
import { celularSchema, correoSchema, contrasenaSchema } from './usuario';

/** Tipos de aliado que se registran solos (HU-007). Las fundaciones tienen su propio flujo (HU-078). */
export const tipoAliadoRegistroSchema = z.enum(['CLINICA', 'VET_INDEPENDIENTE', 'TIENDA'], {
  error: 'El tipo debe ser CLINICA, VET_INDEPENDIENTE o TIENDA',
});

/** HU-007: cuenta del administrador + datos del aliado. */
export const registroAliadoSchema = z.object({
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120),
  nombreAliado: z.string().trim().min(1).max(160).optional(),
  celular: celularSchema,
  correo: correoSchema,
  contrasena: contrasenaSchema,
  tipo: tipoAliadoRegistroSchema,
  descripcion: z.string().trim().max(2000).optional(),
  contacto: z.string().trim().max(160).optional(),
});
export type RegistroAliado = z.infer<typeof registroAliadoSchema>;
