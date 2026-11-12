import { describe, expect, it } from 'vitest';
import { listarConsultasSchema } from '../src';

describe('listarConsultasSchema (HU-014)', () => {
  it('sin parámetros usa la página 1 y 20 por página', () => {
    expect(listarConsultasSchema.parse({})).toEqual({ pagina: 1, limite: 20 });
  });

  it('convierte los números que llegan como texto en la URL', () => {
    expect(listarConsultasSchema.parse({ estado: 'ABIERTA', pagina: '2', limite: '50' })).toEqual({
      estado: 'ABIERTA',
      pagina: 2,
      limite: 50,
    });
  });

  it.each([
    ['estado inexistente', { estado: 'PENDIENTE' }],
    ['página 0', { pagina: '0' }],
    ['página negativa', { pagina: '-1' }],
    ['página decimal', { pagina: '1.5' }],
    ['límite 0', { limite: '0' }],
    ['límite sobre el máximo', { limite: '101' }],
    ['límite no numérico', { limite: 'muchos' }],
    ['estado repetido', { estado: ['ABIERTA', 'CERRADA'] }],
  ])('rechaza %s', (_nombre, entrada) => {
    expect(listarConsultasSchema.safeParse(entrada).success).toBe(false);
  });

  it('ignora parámetros que no conoce (no permite elegir a otro veterinario)', () => {
    const r = listarConsultasSchema.parse({ veterinarioId: 'otro' });
    expect(r).not.toHaveProperty('veterinarioId');
  });
});
