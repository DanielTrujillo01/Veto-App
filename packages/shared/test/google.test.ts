import { describe, expect, it } from 'vitest';
import {
  MOTIVOS_ERROR_GOOGLE,
  RESULTADOS_GOOGLE,
  completarGoogleSchema,
  vincularGoogleSchema,
} from '../src';

describe('HU-003 · vincular una cuenta existente con Google', () => {
  it('pide la contraseña y deja el código 2FA como opcional', () => {
    expect(vincularGoogleSchema.parse({ contrasena: 'secreta' })).toEqual({
      contrasena: 'secreta',
    });
    expect(vincularGoogleSchema.parse({ contrasena: 'secreta', codigo: '123456' }).codigo).toBe(
      '123456',
    );
  });

  it('rechaza una contraseña vacía o ausente con un mensaje claro', () => {
    const vacia = vincularGoogleSchema.safeParse({ contrasena: '' });
    const ausente = vincularGoogleSchema.safeParse({});
    expect(vacia.success).toBe(false);
    expect(ausente.success).toBe(false);
    if (!ausente.success)
      expect(ausente.error.issues[0].message).toBe('La contraseña es obligatoria');
  });

  it.each(['12345', '1234567', 'abcdef', '12 456'])('rechaza el código %s', (codigo) => {
    expect(vincularGoogleSchema.safeParse({ contrasena: 'x', codigo }).success).toBe(false);
  });
});

describe('HU-003 · completar el registro hecho con Google', () => {
  it('acepta un celular de 10 dígitos', () => {
    expect(completarGoogleSchema.parse({ celular: '3001234567' })).toEqual({
      celular: '3001234567',
    });
  });

  it.each(['300123456', '30012345678', 'abc1234567', ''])('rechaza el celular «%s»', (celular) => {
    expect(completarGoogleSchema.safeParse({ celular }).success).toBe(false);
  });

  it('el celular es obligatorio', () => {
    const r = completarGoogleSchema.safeParse({});
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('El celular es obligatorio');
  });
});

describe('HU-003 · contrato con la web', () => {
  it('lista los resultados y motivos con los que la API redirige', () => {
    expect(RESULTADOS_GOOGLE).toEqual(['ok', '2fa', 'vincular', 'registro', 'reauth', 'error']);
    expect(MOTIVOS_ERROR_GOOGLE).toEqual([
      'cancelado',
      'proveedor',
      'correo_no_verificado',
      'estado',
      'cuenta_inactiva',
      'cuenta_vinculada',
      'cuenta_distinta',
      'no_disponible',
    ]);
  });
});
