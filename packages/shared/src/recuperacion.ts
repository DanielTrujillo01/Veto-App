import { z } from 'zod';
import { contrasenaSchema, correoSchema } from './usuario';

const tokenRecuperacionSchema = z
  .string()
  .min(32, 'El enlace de recuperación no es válido')
  .max(128, 'El enlace de recuperación no es válido');

export const solicitarRecuperacionSchema = z.object({
  correo: correoSchema,
});
export type SolicitarRecuperacion = z.infer<typeof solicitarRecuperacionSchema>;

export const verificarRecuperacionSchema = z.object({
  token: tokenRecuperacionSchema,
  codigo: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});
export type VerificarRecuperacion = z.infer<typeof verificarRecuperacionSchema>;

export const completarRecuperacionSchema = z.object({
  token: tokenRecuperacionSchema,
  contrasena: contrasenaSchema,
});
export type CompletarRecuperacion = z.infer<typeof completarRecuperacionSchema>;
