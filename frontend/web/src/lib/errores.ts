import type { ZodError } from 'zod';

/** Convierte los errores de un esquema Zod en { campo: mensaje } para mostrarlos en un formulario. */
export function erroresPorCampo(error: ZodError): Record<string, string> {
  const resultado: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join('.');
    if (!(campo in resultado)) resultado[campo] = issue.message;
  }
  return resultado;
}
