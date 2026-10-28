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
