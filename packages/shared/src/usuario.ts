import { z } from 'zod';

export const celularSchema = z
  .string({ error: 'El celular es obligatorio' })
  .regex(/^[0-9]{10}$/, 'El celular debe tener 10 dígitos');

export const correoSchema = z
  .string({ error: 'El correo es obligatorio' })
  .trim()
  .pipe(z.email('El correo no es válido'));

export const contrasenaSchema = z
  .string({ error: 'La contraseña es obligatoria' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(128, 'La contraseña es demasiado larga');

/** HU-001: registro con nombre, celular y correo (+ contraseña para HU-002). */
export const registroUsuarioSchema = z.object({
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .max(120),
  celular: celularSchema,
  correo: correoSchema,
  contrasena: contrasenaSchema,
});
export type RegistroUsuario = z.infer<typeof registroUsuarioSchema>;

/** HU-002: inicio de sesión. */
export const loginSchema = z.object({
  correo: correoSchema,
  contrasena: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria'),
});
export type Login = z.infer<typeof loginSchema>;

/** HU-006: editar el perfil. Cambiar el correo exige la contraseña actual. */
export const actualizarPerfilSchema = z
  .object({
    nombre: registroUsuarioSchema.shape.nombre.optional(),
    celular: celularSchema.optional(),
    correo: correoSchema.optional(),
    contrasenaActual: z.string().min(1, 'La contraseña es obligatoria').optional(),
  })
  .strict()
  .refine(
    (datos) =>
      datos.nombre !== undefined || datos.celular !== undefined || datos.correo !== undefined,
    { message: 'Debes enviar al menos un dato para actualizar', path: ['nombre'] },
  );
export type ActualizarPerfil = z.infer<typeof actualizarPerfilSchema>;

/** Texto que el usuario debe escribir para confirmar que quiere eliminar su cuenta. */
export const CONFIRMACION_ELIMINAR_CUENTA = 'ELIMINAR';

/** HU-006: eliminar la cuenta requiere la contraseña y una confirmación explícita. */
export const eliminarCuentaSchema = z.object({
  contrasena: z.string().min(1, 'La contraseña es obligatoria'),
  confirmacion: z.literal(CONFIRMACION_ELIMINAR_CUENTA, {
    error: `Escribe ${CONFIRMACION_ELIMINAR_CUENTA} para confirmar la eliminación`,
  }),
});
export type EliminarCuenta = z.infer<typeof eliminarCuentaSchema>;

/** Perfil del usuario autenticado tal como lo devuelve la API. */
export type PerfilUsuario = {
  id: string;
  nombre: string;
  celular: string;
  correo: string;
  rol: string;
};
