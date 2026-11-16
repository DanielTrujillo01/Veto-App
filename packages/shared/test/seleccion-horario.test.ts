import { describe, expect, it } from 'vitest';
import {
  MENSAJES_HORARIO_NO_DISPONIBLE,
  MOTIVOS_HORARIO_NO_DISPONIBLE,
  seleccionarHorarioSchema,
} from '../src';

const SERVICIO = '55555555-5555-4555-8555-555555555555';
const VET = '44444444-4444-4444-8444-444444444444';

describe('HU-029 · seleccionarHorarioSchema', () => {
  const valido = { servicioId: SERVICIO, veterinarioId: VET, inicio: '2030-06-03T08:00:00-05:00' };

  it('acepta el servicio, el veterinario y el inicio con zona horaria', () => {
    expect(seleccionarHorarioSchema.parse(valido)).toEqual(valido);
  });

  it('acepta un instante en UTC', () => {
    const r = seleccionarHorarioSchema.parse({ ...valido, inicio: '2030-06-03T13:00:00Z' });
    expect(r.inicio).toBe('2030-06-03T13:00:00Z');
  });

  it('ignora lo que no le corresponde, como un fin enviado por el cliente', () => {
    const r = seleccionarHorarioSchema.parse({ ...valido, fin: '2030-06-03T23:00:00Z' });
    expect(r).not.toHaveProperty('fin');
  });

  it.each([
    ['sin servicio', { ...valido, servicioId: undefined }, 'servicioId'],
    ['servicio que no es un id', { ...valido, servicioId: '123' }, 'servicioId'],
    ['sin veterinario', { ...valido, veterinarioId: undefined }, 'veterinarioId'],
    ['veterinario que no es un id', { ...valido, veterinarioId: 'x' }, 'veterinarioId'],
    ['sin inicio', { ...valido, inicio: undefined }, 'inicio'],
    ['inicio sin zona horaria', { ...valido, inicio: '2030-06-03T08:00:00' }, 'inicio'],
    ['solo la fecha', { ...valido, inicio: '2030-06-03' }, 'inicio'],
    ['texto cualquiera', { ...valido, inicio: 'mañana a las 8' }, 'inicio'],
    ['inicio numérico', { ...valido, inicio: 1_900_000_000 }, 'inicio'],
  ])('rechaza %s', (_caso, cuerpo, campo) => {
    const r = seleccionarHorarioSchema.safeParse(cuerpo);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(campo);
  });
});

describe('HU-029 · motivos por los que un horario no se puede elegir', () => {
  it('cada motivo tiene su mensaje para la persona', () => {
    expect(MOTIVOS_HORARIO_NO_DISPONIBLE).toEqual(['PASADO', 'OCUPADO', 'NO_DISPONIBLE']);
    for (const motivo of MOTIVOS_HORARIO_NO_DISPONIBLE) {
      expect(MENSAJES_HORARIO_NO_DISPONIBLE[motivo].length).toBeGreaterThan(10);
    }
  });
});
