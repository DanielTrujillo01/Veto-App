import { z } from 'zod';
import { celularSchema, correoSchema, contrasenaSchema } from './usuario';

/** Tipos de aliado que se registran solos (HU-007). Las fundaciones tienen su propio flujo: `registroFundacionSchema` (HU-078). */
export const tipoAliadoRegistroSchema = z.enum(['CLINICA', 'VET_INDEPENDIENTE', 'TIENDA'], {
  error: 'El tipo debe ser CLINICA, VET_INDEPENDIENTE o TIENDA',
});

export const registroAliadoSchema = z
  .object({
    nombre: z.string(),
    nombreAliado: z.string().optional(),
    celular: celularSchema,
    correo: correoSchema,

    contrasena: contrasenaSchema,
    password: z.string().optional(),

    tipo: tipoAliadoRegistroSchema,

    descripcion: z.string().optional(),
    contacto: z.string().optional(),

    ciudad: z.string().optional(),
    ubicacion: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === 'CLINICA' || data.tipo === 'TIENDA') {
      if (!data.ciudad?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ciudad'],
          message: 'La ciudad es obligatoria para clínicas y tiendas.',
        });
      }

      if (!data.ubicacion?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['ubicacion'],
          message: 'La ubicación es obligatoria para clínicas y tiendas.',
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    contrasena: data.contrasena ?? data.password ?? '',
  }));
export type RegistroAliado = z.infer<typeof registroAliadoSchema>;
