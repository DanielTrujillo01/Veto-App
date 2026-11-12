import { describe, expect, it } from 'vitest';
import { filtrarServiciosSchema, guardarEspeciesSchema } from '../src';

describe('guardarEspeciesSchema (HU-021)', () => {
  it('acepta una selección de especies', () => {
    expect(guardarEspeciesSchema.parse({ especieIds: [1, 2, 5] })).toEqual({
      especieIds: [1, 2, 5],
    });
  });

  it.each([
    ['sin la lista', {}],
    ['lista vacía', { especieIds: [] }],
    ['especies repetidas', { especieIds: [1, 1] }],
    ['id negativo', { especieIds: [-1] }],
    ['id cero', { especieIds: [0] }],
    ['id decimal', { especieIds: [1.5] }],
    ['id como texto', { especieIds: ['1'] }],
    ['id mayor que un smallint', { especieIds: [40000] }],
    ['la lista no es un arreglo', { especieIds: 1 }],
    ['más de 50 especies', { especieIds: Array.from({ length: 51 }, (_, i) => i + 1) }],
  ])('rechaza %s', (_nombre, entrada) => {
    expect(guardarEspeciesSchema.safeParse(entrada).success).toBe(false);
  });
});

describe('filtrarServiciosSchema (HU-021)', () => {
  it('sin filtro devuelve un objeto vacío', () => {
    expect(filtrarServiciosSchema.parse({})).toEqual({});
  });

  it('convierte el texto de la URL en número', () => {
    expect(filtrarServiciosSchema.parse({ especieId: '2' })).toEqual({ especieId: 2 });
  });

  it.each([
    ['cero', '0'],
    ['negativo', '-3'],
    ['decimal', '1.5'],
    ['texto', 'perro'],
    ['vacío', ''],
    ['muy grande', '99999'],
  ])('rechaza especieId %s', (_nombre, valor) => {
    expect(filtrarServiciosSchema.safeParse({ especieId: valor }).success).toBe(false);
  });
});
