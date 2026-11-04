import { z } from 'zod';
import { celularSchema, contrasenaSchema, correoSchema } from './usuario';

export const crearVeterinarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  celular: celularSchema,
  correo: correoSchema,
  contrasena: contrasenaSchema,
  fotoUrl: z.string().url('La foto no es válida').max(2_048).optional(),
  descripcion: z.string().trim().max(2_000).optional(),
});

export type CrearVeterinario = z.infer<typeof crearVeterinarioSchema>;

export const actualizarPerfilVeterinarioSchema = z
  .object({
    fotoUrl: z.string().url('La foto no es válida').max(2_048).nullable().optional(),
    descripcion: z.string().trim().max(2_000).nullable().optional(),
  })
  .refine((datos) => datos.fotoUrl !== undefined || datos.descripcion !== undefined, {
    message: 'Indica la foto o la descripción que deseas actualizar',
  });

export type ActualizarPerfilVeterinario = z.infer<typeof actualizarPerfilVeterinarioSchema>;
