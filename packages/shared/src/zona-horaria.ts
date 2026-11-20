/**
 * Zona horaria de Veto. Toda la aplicación opera en hora de Colombia: el horario de atención de
 * un aliado ("de 08:00 a 12:00") son horas de Colombia, y la API entrega las fechas con hora de
 * Colombia (`2026-12-07T08:00:00.000-05:00`) en vez de UTC (`2026-12-07T13:00:00.000Z`). Es el
 * mismo instante escrito de otra manera, así que ambas formas se pueden enviar y comparar.
 */
export const ZONA_HORARIA = 'America/Bogota';

/** Colombia no tiene horario de verano: el desfase respecto a UTC es siempre de 5 horas menos. */
export const DESFASE_HORARIO = '-05:00';
const DESFASE_MS = -5 * 60 * 60 * 1000;

/**
 * Escribe un instante en hora de Colombia, con milisegundos y desfase (`...-05:00`).
 * Acepta un `Date`, milisegundos desde 1970 o un texto de fecha y hora (con o sin desfase).
 */
export function aHoraLocal(instante: Date | string | number): string {
  const ms =
    instante instanceof Date
      ? instante.getTime()
      : typeof instante === 'number'
        ? instante
        : Date.parse(instante);
  if (Number.isNaN(ms)) throw new RangeError(`No es una fecha y hora válida: ${String(instante)}`);
  return new Date(ms + DESFASE_MS).toISOString().replace('Z', DESFASE_HORARIO);
}
