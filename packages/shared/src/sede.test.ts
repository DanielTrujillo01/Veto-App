import { describe, expect, it } from 'vitest';
import { guardarSedeSchema } from './sede';

describe('HU-015 · validar sede', () => {
  it('acepta los datos obligatorios y elimina espacios exteriores', () => {
    expect(
      guardarSedeSchema.parse({
        nombre: ' Sede Norte ',
        direccion: ' Carrera 7 # 60-10 ',
        ciudad: ' Bogotá ',
      }),
    ).toEqual({
      nombre: 'Sede Norte',
      direccion: 'Carrera 7 # 60-10',
      ciudad: 'Bogotá',
    });
  });

  it.each([
    [{ nombre: ' ', direccion: 'Calle 1', ciudad: 'Bogotá' }, 'nombre'],
    [{ nombre: 'Sede', direccion: '', ciudad: 'Bogotá' }, 'direccion'],
    [{ nombre: 'Sede', direccion: 'Calle 1', ciudad: ' ' }, 'ciudad'],
    [{ nombre: 'n'.repeat(121), direccion: 'Calle 1', ciudad: 'Bogotá' }, 'nombre'],
  ])('rechaza datos de sede inválidos', (datos) => {
    expect(guardarSedeSchema.safeParse(datos).success).toBe(false);
  });
});
