import { describe, expect, it } from 'vitest';
import { diaEnColombia, fechaLarga, horaEnColombia } from '../src/lib/fechas';

/**
 * HU-029 · La API entrega las horas con desfase de Colombia (`…-05:00`); antes, en UTC (`…Z`).
 * Es el mismo instante, así que la web debe mostrar lo mismo con cualquiera de las dos formas.
 */
const UTC = '2026-11-24T13:00:00.000Z';
const COLOMBIA = '2026-11-24T08:00:00.000-05:00';
const sinEspacios = (texto: string) => texto.replace(/\s/g, ' ');

describe('fechas en hora de Colombia', () => {
  it('muestra las 8:00 a. m. con ambas formas del mismo instante', () => {
    expect(sinEspacios(horaEnColombia(COLOMBIA))).toMatch(/^8:00 a\.? ?m\.?$/);
    expect(horaEnColombia(COLOMBIA)).toBe(horaEnColombia(UTC));
  });

  it('el día y la fecha larga no cambian según el formato', () => {
    expect(diaEnColombia(COLOMBIA)).toBe('2026-11-24');
    expect(diaEnColombia(UTC)).toBe('2026-11-24');
    expect(fechaLarga(COLOMBIA)).toBe(fechaLarga(UTC));
  });

  it('una cita a las 11 p. m. de Colombia sigue siendo de ese día (en UTC ya es el siguiente)', () => {
    expect(diaEnColombia('2026-11-24T23:00:00.000-05:00')).toBe('2026-11-24');
    expect(diaEnColombia('2026-11-25T04:00:00.000Z')).toBe('2026-11-24');
  });
});
