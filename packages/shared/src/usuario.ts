import { z } from 'zod';

export const celularSchema = z.string().regex(/^[0-9]{10}$/, 'El celular debe tener 10 dígitos');

export const correoSchema = z.string().trim().pipe(z.email('El correo no es válido'));

export const contrasenaSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

/** HU-001: registro con nombre, celular y correo (+ contraseña para HU-002). */
export const registroUsuarioSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  celular: celularSchema,
  correo: correoSchema,
  contrasena: contrasenaSchema,
});
export type RegistroUsuario = z.infer<typeof registroUsuarioSchema>;

/** HU-002: inicio de sesión. */
export const loginSchema = z.object({
  correo: correoSchema,
  contrasena: z.string().min(1, 'La contraseña es obligatoria'),
});
export type Login = z.infer<typeof loginSchema>;
