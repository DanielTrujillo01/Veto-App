import { z } from 'zod';
import type { EstadoSeleccionHorario } from './agenda';
import type { EstadoCita } from './enums';

/** Límite de caracteres del motivo de la cita (HU-030). La base lo exige igual (`cita.motivo`). */
export const MOTIVO_CITA_MAX_CARACTERES = 500;

/** true si hay caracteres de control que no son un salto de línea ni una tabulación (la base rechaza el NUL). */
function tieneCaracteresDeControl(texto: string): boolean {
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 0;
    const esControl = codigo < 0x20 || codigo === 0x7f;
    if (esControl && codigo !== 0x09 && codigo !== 0x0a) return true;
  }
  return false;
}

/**
 * Cuenta los caracteres como los ve la persona (un emoji cuenta como uno), igual que
 * `char_length` en la base. Sirve para mostrar el contador "120 / 500" mientras se escribe.
 */
export function contarCaracteres(texto: string): number {
  return Array.from(texto).length;
}

/** Cuántos caracteres le quedan al motivo; 0 cuando ya se alcanzó el límite. */
export function caracteresRestantesDelMotivo(texto: string): number {
  return Math.max(0, MOTIVO_CITA_MAX_CARACTERES - contarCaracteres(texto.trim()));
}

/**
 * HU-030: motivo de la cita en texto libre. Se recortan los espacios de las puntas, los saltos
 * de línea de Windows pasan a `\n` y un texto vacío significa "sin motivo" (`null`). Si pasa
 * el límite, el mensaje dice cuántos caracteres escribió la persona.
 */
export const motivoCitaSchema = z
  .string({ error: 'El motivo debe ser un texto' })
  .transform((texto, ctx) => {
    const limpio = texto.replace(/\r\n?/g, '\n').trim();
    if (tieneCaracteresDeControl(limpio)) {
      ctx.addIssue({ code: 'custom', message: 'El motivo tiene caracteres que no se permiten' });
      return z.NEVER;
    }
    const cantidad = contarCaracteres(limpio);
    if (cantidad > MOTIVO_CITA_MAX_CARACTERES) {
      ctx.addIssue({
        code: 'custom',
        message: `El motivo admite máximo ${MOTIVO_CITA_MAX_CARACTERES} caracteres (escribiste ${cantidad})`,
      });
      return z.NEVER;
    }
    return limpio === '' ? null : limpio;
  });

/**
 * HU-030 y HU-031: lo que el tutor completa después de elegir fecha y hora, antes de confirmar.
 * Se envía solo lo que cambia: `motivo: null` (o texto vacío) lo quita.
 */
export const completarReservaSchema = z
  .object({
    mascotaId: z.uuid('La mascota no es válida').optional(),
    motivo: motivoCitaSchema.nullable().optional(),
  })
  .refine((d) => d.mascotaId !== undefined || d.motivo !== undefined, {
    message: 'Indica la mascota o el motivo de la cita',
  });
export type CompletarReserva = z.infer<typeof completarReservaSchema>;

/** Lo que falta o no sirve para confirmar, con el campo al que se refiere. */
export type PendienteDeReserva = {
  campo: 'horario' | 'mascotaId' | 'reserva';
  mensaje: string;
};

/** Datos de una persona o cosa de la cita para mostrar: su id y su nombre. */
export type NombreConId = { id: string; nombre: string };

/**
 * Detalle de una cita para quien tiene permiso de verla: el tutor, el administrador del aliado
 * y los veterinarios activos de ese aliado (HU-030, HU-031).
 */
export type CitaDetalle = {
  id: string;
  estado: EstadoCita;
  inicio: string;
  fin: string;
  precio: number;
  /** Lo que el tutor escribió al reservar; `null` si no indicó motivo. */
  motivo: string | null;
  creadaEn: string;
  tutor: NombreConId;
  mascota: NombreConId & { especie: string };
  aliado: NombreConId;
  servicio: NombreConId;
  veterinario: NombreConId | null;
};

/** Respuesta de confirmar: `repetida` es true si ya estaba confirmada (doble clic o reintento). */
export type ReservaConfirmada = CitaDetalle & { repetida: boolean };

/**
 * HU-031: lo que se muestra antes de confirmar. `listo` es true solo si la reserva se puede
 * confirmar ahora; si no, `pendientes` dice qué falta o ya no sirve.
 */
export type ResumenReserva = {
  /** Fecha y hora, servicio, veterinario, mascota y motivo elegidos. */
  seleccion: EstadoSeleccionHorario;
  aliadoNombre: string;
  /** Precio del servicio para esa mascota; `null` mientras no se pueda calcular. */
  precio: number | null;
  /** Estado en que quedará la cita según cómo confirma sus citas el aliado. */
  estadoInicial: 'AGENDADA' | 'PENDIENTE' | null;
  listo: boolean;
  pendientes: PendienteDeReserva[];
};
