import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Valida `entrada` con un esquema de @veto/shared; si falla responde 400 con { campo: mensaje }. */
export function validar<T>(
  esquema: ZodType<T>,
  entrada: unknown,
  mensaje = 'Revisa los datos ingresados',
): T {
  const resultado = esquema.safeParse(entrada);
  if (!resultado.success) {
    const errores: Record<string, string> = {};
    for (const issue of resultado.error.issues) {
      const campo = issue.path.join('.') || '_';
      if (!(campo in errores)) errores[campo] = issue.message;
    }
    throw new BadRequestException({ message: mensaje, errores });
  }
  return resultado.data;
}

/** Códigos de PostgreSQL que la API traduce a errores HTTP. */
export const PG = {
  UNICO: '23505',
  LLAVE_FORANEA: '23503',
  CHECK: '23514',
  EXCLUSION: '23P01',
} as const;

/** true si `error` es un error de PostgreSQL con el código indicado. */
export function esErrorPg(error: unknown, codigo: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === codigo
  );
}
