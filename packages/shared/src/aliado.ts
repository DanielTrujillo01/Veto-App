import { z } from 'zod';
import { celularSchema, correoSchema, contrasenaSchema } from './usuario';

export const tipoAliadoRegistroSchema = z.enum(['CLINICA', 'VET_INDEPENDIENTE', 'TIENDA']);
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

export const sedeInputSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  direccion: z.string().trim().min(1).max(240),
  ciudad: z.string().trim().min(1).max(120),
});
export type SedeInput = z.infer<typeof sedeInputSchema>;

export const servicioInputSchema = z
  .object({
    tipoServicioId: z.coerce.number().int().positive(),
    nombre: z.string().trim().min(1).max(160),
    descripcion: z.string().trim().max(4000).nullable().optional(),
    modalidad: z.enum(['EN_SEDE', 'A_DOMICILIO']),
    sedeId: z.string().uuid().nullable().optional(),
    precioBase: z.coerce.number().finite().nonnegative(),
    duracionMin: z.coerce.number().int().positive().default(30),
  })
  .superRefine((data, ctx) => {
    if (data.modalidad === 'EN_SEDE' && !data.sedeId) {
      ctx.addIssue({
        code: 'custom',
        path: ['sedeId'],
        message: 'Selecciona una sede para la modalidad en sede.',
      });
    }
  });
export type ServicioInput = z.infer<typeof servicioInputSchema>;
