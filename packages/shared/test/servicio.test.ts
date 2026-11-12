import { describe, expect, it } from 'vitest';
import { guardarReglasPrecioSchema, guardarServicioSchema } from '../src';

const valido = {
  tipoServicioId: 1,
  nombre: 'Consulta general',
  modalidad: 'A_DOMICILIO',
  duracionMin: 30,
  precioBase: 60000,
};

describe('guardarServicioSchema (HU-018)', () => {
  it('acepta un servicio a domicilio sin sede', () => {
    expect(guardarServicioSchema.safeParse(valido).success).toBe(true);
  });

  describe('guardarReglasPrecioSchema (HU-020)', () => {
    it('acepta reglas por especie, peso, edad y reglas generales', () => {
      expect(
        guardarReglasPrecioSchema.parse({
          reglas: [
            { especieId: 1, precio: 70000 },
            { pesoMinKg: 10, pesoMaxKg: 25, precio: 80000, prioridad: 2 },
            { edadMinMeses: 0, edadMaxMeses: 12, precio: 50000 },
            { precio: 60000 },
          ],
        }).reglas,
      ).toHaveLength(4);
    });

    it('acepta límites iguales e inclusivos', () => {
      expect(
        guardarReglasPrecioSchema.safeParse({
          reglas: [{ pesoMinKg: 10, pesoMaxKg: 10, edadMinMeses: 6, edadMaxMeses: 6, precio: 0 }],
        }).success,
      ).toBe(true);
    });

    it('acepta una lista vacía para quitar todas las reglas', () => {
      expect(guardarReglasPrecioSchema.parse({ reglas: [] })).toEqual({ reglas: [] });
    });

    it.each([
      ['precio negativo', { precio: -1 }],
      ['precio con más de dos decimales', { precio: 1.234 }],
      ['peso negativo', { pesoMinKg: -0.01, precio: 10 }],
      ['peso superior a numeric(6,2)', { pesoMaxKg: 10_000, precio: 10 }],
      ['edad negativa', { edadMinMeses: -1, precio: 10 }],
      ['especie fuera de smallint', { especieId: 32_768, precio: 10 }],
      ['prioridad fuera de smallint', { prioridad: 32_768, precio: 10 }],
      ['rango de peso invertido', { pesoMinKg: 5, pesoMaxKg: 4, precio: 10 }],
      ['rango de edad invertido', { edadMinMeses: 5, edadMaxMeses: 4, precio: 10 }],
    ])('rechaza %s', (_nombre, regla) => {
      expect(guardarReglasPrecioSchema.safeParse({ reglas: [regla] }).success).toBe(false);
    });
  });

  it('un servicio en sede exige la sede', () => {
    expect(guardarServicioSchema.safeParse({ ...valido, modalidad: 'EN_SEDE' }).success).toBe(
      false,
    );
    expect(
      guardarServicioSchema.safeParse({
        ...valido,
        modalidad: 'EN_SEDE',
        sedeId: '0b6f8f0e-8d7a-4d1a-9c55-3e1f7f2b9a10',
      }).success,
    ).toBe(true);
  });

  it.each([
    ['sin nombre', { ...valido, nombre: '' }],
    ['sin tipo', { ...valido, tipoServicioId: undefined }],
    ['precio negativo', { ...valido, precioBase: -1 }],
    ['precio con tres decimales', { ...valido, precioBase: 10.123 }],
    ['duración no múltiplo de 5', { ...valido, duracionMin: 32 }],
    ['modalidad inexistente', { ...valido, modalidad: 'VIRTUAL' }],
  ])('rechaza %s', (_caso, datos) => {
    expect(guardarServicioSchema.safeParse(datos).success).toBe(false);
  });
});
