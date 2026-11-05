import { z } from 'zod';

/**
 * URL de una imagen guardada en almacenamiento externo (la base solo guarda la URL).
 * Solo se aceptan http y https, para no mostrar en la web esquemas como javascript: o data:.
 */
export const urlImagenSchema = z
  .url({ protocol: /^https?$/, error: 'La foto debe ser una URL http o https válida' })
  .max(2_048, 'La URL de la foto es demasiado larga');
