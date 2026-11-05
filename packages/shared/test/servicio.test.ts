import { describe, expect, it } from 'vitest';
import { guardarServicioSchema } from '../src';

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
