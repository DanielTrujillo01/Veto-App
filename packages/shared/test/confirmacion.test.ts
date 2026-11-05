import { describe, expect, it } from 'vitest';
import { confirmacionDe, estadoInicialDeCita, guardarConfirmacionSchema } from '../src';

describe('HU-023 · guardarConfirmacionSchema', () => {
  it.each(['AUTOMATICA', 'MANUAL'])('acepta el modo %s', (modo) => {
    expect(guardarConfirmacionSchema.safeParse({ modo }).success).toBe(true);
  });

  it.each([
    ['sin modo', {}],
    ['modo vacío', { modo: '' }],
    ['en minúsculas', { modo: 'manual' }],
    ['modo desconocido', { modo: 'SEMI' }],
    ['número', { modo: 1 }],
    ['nulo', { modo: null }],
  ])('rechaza %s', (_caso, cuerpo) => {
    const r = guardarConfirmacionSchema.safeParse(cuerpo);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['modo']);
  });

  it('ignora campos de más (no se puede colar otro estado)', () => {
    const r = guardarConfirmacionSchema.parse({ modo: 'MANUAL', estado: 'ACTIVO' });
    expect(r).toEqual({ modo: 'MANUAL' });
  });
});

describe('HU-023 · estado con el que nace la cita', () => {
  it('automática → AGENDADA (confirmada)', () => {
    expect(estadoInicialDeCita('AUTOMATICA')).toBe('AGENDADA');
  });

  it('manual → PENDIENTE de aceptación', () => {
    expect(estadoInicialDeCita('MANUAL')).toBe('PENDIENTE');
  });

  it('confirmacionDe junta el modo y el estado que verá el tutor', () => {
    expect(confirmacionDe('MANUAL')).toEqual({ modo: 'MANUAL', estadoInicialCita: 'PENDIENTE' });
    expect(confirmacionDe('AUTOMATICA')).toEqual({
      modo: 'AUTOMATICA',
      estadoInicialCita: 'AGENDADA',
    });
  });
});
