import { describe, expect, it } from 'vitest';
import { DESFASE_HORARIO, ZONA_HORARIA, aHoraLocal } from '../src';

describe('aHoraLocal · hora de Colombia', () => {
  it('Colombia es America/Bogota, cinco horas por debajo de UTC', () => {
    expect(ZONA_HORARIA).toBe('America/Bogota');
    expect(DESFASE_HORARIO).toBe('-05:00');
  });

  it('escribe un instante UTC con la hora de Colombia', () => {
    expect(aHoraLocal('2026-12-07T13:00:00.000Z')).toBe('2026-12-07T08:00:00.000-05:00');
  });

  it('acepta un Date y milisegundos desde 1970', () => {
    const ms = Date.parse('2026-12-07T13:30:00.000Z');
    expect(aHoraLocal(new Date(ms))).toBe('2026-12-07T08:30:00.000-05:00');
    expect(aHoraLocal(ms)).toBe('2026-12-07T08:30:00.000-05:00');
  });

  it('conserva los milisegundos', () => {
    expect(aHoraLocal('2026-12-07T13:00:00.123Z')).toBe('2026-12-07T08:00:00.123-05:00');
  });

  it('cuando en UTC ya es otro día, la fecha local es la del día anterior', () => {
    expect(aHoraLocal('2027-01-01T03:00:00.000Z')).toBe('2026-12-31T22:00:00.000-05:00');
    expect(aHoraLocal('2026-03-01T04:59:59.999Z')).toBe('2026-02-28T23:59:59.999-05:00');
  });

  it('un texto que ya trae desfase se pasa a Colombia sin cambiar el instante', () => {
    expect(aHoraLocal('2026-12-07T15:00:00.000+02:00')).toBe('2026-12-07T08:00:00.000-05:00');
    expect(aHoraLocal('2026-12-07T08:00:00-05:00')).toBe('2026-12-07T08:00:00.000-05:00');
  });

  it('es siempre el mismo instante: leerlo de vuelta da lo mismo', () => {
    for (const utc of [
      '2026-12-07T13:00:00.000Z',
      '2027-01-01T03:00:00.000Z',
      '2026-07-15T00:00:00.000Z',
    ]) {
      expect(Date.parse(aHoraLocal(utc))).toBe(Date.parse(utc));
    }
  });

  it('no hay horario de verano: el desfase es el mismo en cualquier mes', () => {
    for (const mes of ['01', '04', '07', '10']) {
      expect(aHoraLocal(`2026-${mes}-15T12:00:00.000Z`)).toMatch(/-05:00$/);
    }
  });

  it('una fecha inválida se rechaza en vez de inventar una hora', () => {
    expect(() => aHoraLocal('mañana')).toThrow(RangeError);
    expect(() => aHoraLocal(new Date('x'))).toThrow(RangeError);
    expect(() => aHoraLocal(Number.NaN)).toThrow(RangeError);
  });
});
