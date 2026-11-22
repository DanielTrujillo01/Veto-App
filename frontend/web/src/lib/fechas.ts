/**
 * Fechas y horas de las citas, siempre en hora de Colombia: los aliados atienden en Colombia. La
 * API entrega los instantes con desfase de Colombia (`…-05:00`); antes los entregaba en UTC (`…Z`).
 * Aquí se leen con `new Date()` y se muestran en `America/Bogota`, así que ambas formas funcionan
 * y la hora mostrada no depende del reloj del dispositivo.
 */
export const ZONA_HORARIA = 'America/Bogota';

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const formatoHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const formatoFechaLarga = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA_HORARIA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const formatoDiaCorto = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Día de calendario en Colombia (`AAAA-MM-DD`) de un instante. */
export function diaEnColombia(instante: string | Date): string {
  return formatoDia.format(new Date(instante));
}

/** Suma días a una fecha `AAAA-MM-DD` (sin horas, así no influye la zona horaria). */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "8:00 a. m." */
export function horaEnColombia(instante: string): string {
  return formatoHora.format(new Date(instante));
}

/** "lunes, 23 de noviembre de 2026" */
export function fechaLarga(instante: string): string {
  return formatoFechaLarga.format(new Date(instante));
}

/** "lun, 23 nov" para una fecha `AAAA-MM-DD`. */
export function diaCorto(fecha: string): string {
  return formatoDiaCorto.format(new Date(`${fecha}T12:00:00Z`));
}

/** "lunes, 23 de noviembre de 2026 · 8:00 a. m. – 9:00 a. m." */
export function rangoDeCita(inicio: string, fin: string): string {
  return `${fechaLarga(inicio)} · ${horaEnColombia(inicio)} – ${horaEnColombia(fin)}`;
}
