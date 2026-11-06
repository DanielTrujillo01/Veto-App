import { z } from 'zod';
import { celularSchema } from './usuario';

/**
 * HU-003: cómo termina el regreso desde Google. La API redirige a la web con
 * `?google=<resultado>` y, si falló, `&motivo=<motivo>`; nunca con datos personales.
 */
export const RESULTADOS_GOOGLE = ['ok', '2fa', 'vincular', 'registro', 'reauth', 'error'] as const;
export type ResultadoGoogle = (typeof RESULTADOS_GOOGLE)[number];

export const MOTIVOS_ERROR_GOOGLE = [
  'cancelado', // la persona canceló o rechazó el permiso en Google
  'proveedor', // Google respondió con un error o una respuesta inválida
  'correo_no_verificado', // Google no tiene verificado el correo de esa cuenta
  'estado', // el intento venció, ya se usó o no salió de este navegador
  'cuenta_inactiva', // la cuenta de Veto está suspendida o eliminada
  'cuenta_vinculada', // la cuenta de Veto ya está vinculada a otra cuenta de Google
  'cuenta_distinta', // al reautenticar, la cuenta de Google no es la vinculada a esta sesión
  'no_disponible', // el inicio con Google no está configurado en este servidor
] as const;
export type MotivoErrorGoogle = (typeof MOTIVOS_ERROR_GOOGLE)[number];

/** Cuerpo de `POST /identidad/google/vincular`: demuestra que la cuenta existente es suya. */
export const vincularGoogleSchema = z.object({
  contrasena: z
    .string({ error: 'La contraseña es obligatoria' })
    .min(1, 'La contraseña es obligatoria'),
  /** Código de Google Authenticator; obligatorio solo si la cuenta tiene 2FA activo. */
  codigo: z
    .string()
    .regex(/^\d{6}$/, 'El código debe tener 6 dígitos')
    .optional(),
});
export type VincularGoogle = z.infer<typeof vincularGoogleSchema>;

/** Cuerpo de `POST /identidad/google/completar`: el dato que Google no entrega. */
export const completarGoogleSchema = z.object({ celular: celularSchema });
export type CompletarGoogle = z.infer<typeof completarGoogleSchema>;

/** Qué le falta a una persona que ya se autenticó con Google (`GET /identidad/google/pendiente`). */
export type PendienteGoogle =
  | { tipo: 'VINCULAR'; correo: string; nombre: string; requiereCodigo: boolean }
  | { tipo: 'REGISTRO'; correo: string; nombre: string };

/** `GET /identidad/google/estado`: le dice a la web cómo confirmar una acción delicada. */
export type EstadoGoogle = {
  /** La cuenta de Veto tiene una cuenta de Google vinculada. */
  vinculada: boolean;
  /** Entra solo con Google: confirma con `GET /identidad/google/reautenticar`, no con contraseña. */
  sinContrasena: boolean;
};
