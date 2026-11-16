import { z } from 'zod';

/** true si hay caracteres de control que no son un salto de línea ni una tabulación (la base rechaza el NUL). */
export function tieneCaracteresDeControl(texto: string): boolean {
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

/**
 * Texto libre con límite de caracteres: motivo de la cita, observación al cerrarla,
 * recomendaciones. Se recortan los espacios de las puntas, los saltos de línea de Windows pasan
 * a `\n` y un texto vacío significa "sin texto" (`null`). Si pasa el límite, el mensaje dice
 * cuántos caracteres escribió la persona.
 */
export function textoLibreSchema(opciones: {
  maximo: number;
  /** Mensajes en español, con el nombre del campo ya puesto. */
  noEsTexto: string;
  conControl: string;
  demasiadoLargo: (escritos: number) => string;
}) {
  return z.string({ error: opciones.noEsTexto }).transform((texto, ctx) => {
    const limpio = texto.replace(/\r\n?/g, '\n').trim();
    if (tieneCaracteresDeControl(limpio)) {
      ctx.addIssue({ code: 'custom', message: opciones.conControl });
      return z.NEVER;
    }
    const cantidad = contarCaracteres(limpio);
    if (cantidad > opciones.maximo) {
      ctx.addIssue({ code: 'custom', message: opciones.demasiadoLargo(cantidad) });
      return z.NEVER;
    }
    return limpio === '' ? null : limpio;
  });
}
