import { z } from 'zod';

/** especie.id es smallint en la base de datos. */
const MAX_ID_ESPECIE = 32_767;
export const MAX_ESPECIES_POR_ALIADO = 50;

const idEspecie = z
  .number({ error: 'Cada especie debe ser un número' })
  .int('Cada especie debe ser un número entero')
  .positive('Cada especie debe ser un número positivo')
  .max(MAX_ID_ESPECIE, 'La especie no existe');

/**
 * HU-021: especies que atiende el aliado. Guardar y actualizar usan lo mismo: se envía la
 * selección completa y reemplaza a la anterior.
 */
export const guardarEspeciesSchema = z.object({
  especieIds: z
    .array(idEspecie, { error: 'Debes enviar la lista de especies' })
    .min(1, 'Selecciona al menos una especie')
    .max(MAX_ESPECIES_POR_ALIADO, `Máximo ${MAX_ESPECIES_POR_ALIADO} especies`)
    .refine((ids) => new Set(ids).size === ids.length, 'No repitas especies'),
});
export type GuardarEspecies = z.infer<typeof guardarEspeciesSchema>;

/** HU-021: filtro por especie del listado público de servicios (?especieId=). */
export const filtrarServiciosSchema = z.object({
  especieId: z.coerce
    .number({ error: 'La especie debe ser un número' })
    .int('La especie debe ser un número entero')
    .positive('La especie debe ser un número positivo')
    .max(MAX_ID_ESPECIE, 'La especie no existe')
    .optional(),
});
export type FiltrarServicios = z.infer<typeof filtrarServiciosSchema>;

/** Especie que atiende un aliado, tal como la devuelve la API. */
export type EspecieAtendida = { id: number; nombre: string };
