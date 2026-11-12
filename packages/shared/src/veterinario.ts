import { z } from 'zod';
import { urlImagenSchema } from './imagen';
import { celularSchema, contrasenaSchema, correoSchema } from './usuario';

/** Descripción del veterinario: un texto vacío se guarda como "sin descripción" (null). */
const descripcionSchema = z
  .string()
  .trim()
  .max(2_000, 'La descripción admite máximo 2000 caracteres')
  .transform((texto) => texto || null);

export const crearVeterinarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  celular: celularSchema,
  correo: correoSchema,
  contrasena: contrasenaSchema,
  fotoUrl: urlImagenSchema.optional(),
  descripcion: descripcionSchema.optional(),
});

export type CrearVeterinario = z.infer<typeof crearVeterinarioSchema>;

/**
 * HU-013: foto y descripción visibles en la ficha de la clínica. Envía solo lo que cambia;
 * null (o un texto vacío) quita la foto o la descripción.
 */
export const actualizarPerfilVeterinarioSchema = z
  .object({
    fotoUrl: z
      .preprocess((valor) => (valor === '' ? null : valor), urlImagenSchema.nullable())
      .optional(),
    descripcion: descripcionSchema.nullable().optional(),
  })
  .strict()
  .refine((datos) => datos.fotoUrl !== undefined || datos.descripcion !== undefined, {
    message: 'Indica la foto o la descripción que deseas actualizar',
    path: ['fotoUrl'],
  });

export type ActualizarPerfilVeterinario = z.infer<typeof actualizarPerfilVeterinarioSchema>;
