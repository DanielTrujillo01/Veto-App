import { describe, expect, it } from 'vitest';
import { consultarDisponibilidadSchema, crearBloqueoSchema } from '../src';

const SERVICIO = '55555555-5555-4555-8555-555555555555';

describe('HU-022 · crearBloqueoSchema', () => {
  const valido = { inicio: '2030-12-24T08:00:00-05:00', fin: '2030-12-26T08:00:00-05:00' };

  it('acepta un intervalo con zona horaria y un motivo', () => {
    const r = crearBloqueoSchema.parse({ ...valido, motivo: '  Vacaciones  ' });
    expect(r.motivo).toBe('Vacaciones');
  });

  it('acepta instantes en UTC y sin motivo', () => {
    const r = crearBloqueoSchema.parse({
      inicio: '2030-12-24T13:00:00Z',
      fin: '2030-12-24T17:00:00Z',
    });
    expect(r.motivo).toBeUndefined();
  });

  it('un motivo vacío se trata como ausente', () => {
    expect(crearBloqueoSchema.parse({ ...valido, motivo: '   ' }).motivo).toBeUndefined();
  });

  it.each([
    ['sin inicio', { fin: valido.fin }, 'inicio'],
    ['sin fin', { inicio: valido.inicio }, 'fin'],
    ['sin zona horaria', { ...valido, inicio: '2030-12-24T08:00:00' }, 'inicio'],
    ['solo fecha', { ...valido, fin: '2030-12-26' }, 'fin'],
    ['texto cualquiera', { ...valido, inicio: 'mañana' }, 'inicio'],
    ['fin igual al inicio', { ...valido, fin: valido.inicio }, 'fin'],
    ['fin antes del inicio', { inicio: valido.fin, fin: valido.inicio }, 'fin'],
    ['más de 366 días', { ...valido, fin: '2032-01-01T00:00:00-05:00' }, 'fin'],
    ['motivo de 201 caracteres', { ...valido, motivo: 'x'.repeat(201) }, 'motivo'],
    ['motivo no es texto', { ...valido, motivo: 5 }, 'motivo'],
  ])('rechaza %s', (_caso, cuerpo, campo) => {
    const r = crearBloqueoSchema.safeParse(cuerpo);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(campo);
  });

  it('acepta exactamente 366 días', () => {
    const r = crearBloqueoSchema.safeParse({
      inicio: '2030-01-01T00:00:00Z',
      fin: '2031-01-02T00:00:00Z',
    });
    expect(r.success).toBe(true);
  });
});

describe('HU-022 · consultarDisponibilidadSchema', () => {
  const valido = { servicioId: SERVICIO, desde: '2030-06-03', hasta: '2030-06-09' };

  it('acepta una semana', () => {
    expect(consultarDisponibilidadSchema.parse(valido)).toEqual(valido);
  });

  it('acepta un solo día y un veterinario', () => {
    const r = consultarDisponibilidadSchema.parse({
      ...valido,
      hasta: valido.desde,
      veterinarioId: SERVICIO,
    });
    expect(r.veterinarioId).toBe(SERVICIO);
  });

  it('acepta 31 días y rechaza 32', () => {
    expect(
      consultarDisponibilidadSchema.safeParse({
        ...valido,
        desde: '2030-07-01',
        hasta: '2030-07-31',
      }).success,
    ).toBe(true);
    const r = consultarDisponibilidadSchema.safeParse({
      ...valido,
      desde: '2030-07-01',
      hasta: '2030-08-01',
    });
    expect(r.success).toBe(false);
  });

  it.each([
    ['sin servicio', { desde: valido.desde, hasta: valido.hasta }, 'servicioId'],
    ['servicio que no es UUID', { ...valido, servicioId: 'abc' }, 'servicioId'],
    ['sin desde', { servicioId: SERVICIO, hasta: valido.hasta }, 'desde'],
    ['sin hasta', { servicioId: SERVICIO, desde: valido.desde }, 'hasta'],
    ['fecha con otro formato', { ...valido, desde: '03/06/2030' }, 'desde'],
    ['fecha que no existe', { ...valido, desde: '2030-02-31' }, 'desde'],
    ['hasta antes de desde', { ...valido, desde: '2030-06-10' }, 'hasta'],
    ['veterinario que no es UUID', { ...valido, veterinarioId: '1' }, 'veterinarioId'],
  ])('rechaza %s', (_caso, consulta, campo) => {
    const r = consultarDisponibilidadSchema.safeParse(consulta);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0])).toContain(campo);
  });
});
