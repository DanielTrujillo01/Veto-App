import { describe, expect, it } from 'vitest';
import { actualizarPerfilVeterinarioSchema, crearMascotaSchema, urlImagenSchema } from '../src';

describe('urlImagenSchema', () => {
  it('acepta http y https', () => {
    expect(urlImagenSchema.safeParse('https://fotos.veto.co/a.jpg').success).toBe(true);
    expect(urlImagenSchema.safeParse('http://fotos.veto.co/a.jpg').success).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'ftp://x.co/a.jpg', 'no-es-url'])(
    'rechaza %s',
    (url) => {
      expect(urlImagenSchema.safeParse(url).success).toBe(false);
    },
  );

  it('también aplica a las fotos de mascotas', () => {
    const r = crearMascotaSchema.safeParse({
      nombre: 'Firulais',
      especieId: 1,
      sexo: 'MACHO',
      fotos: ['javascript:alert(1)'],
    });
    expect(r.success).toBe(false);
  });
});

describe('actualizarPerfilVeterinarioSchema (HU-013)', () => {
  it('acepta solo la foto o solo la descripción', () => {
    expect(actualizarPerfilVeterinarioSchema.parse({ fotoUrl: 'https://x.co/v.jpg' })).toEqual({
      fotoUrl: 'https://x.co/v.jpg',
    });
    expect(actualizarPerfilVeterinarioSchema.parse({ descripcion: '  Felinos  ' })).toEqual({
      descripcion: 'Felinos',
    });
  });

  it('un texto vacío o null quitan la foto o la descripción', () => {
    expect(actualizarPerfilVeterinarioSchema.parse({ fotoUrl: '', descripcion: '   ' })).toEqual({
      fotoUrl: null,
      descripcion: null,
    });
    expect(actualizarPerfilVeterinarioSchema.parse({ fotoUrl: null })).toEqual({ fotoUrl: null });
  });

  it('exige al menos un campo y rechaza campos que no se editan aquí', () => {
    const vacio = actualizarPerfilVeterinarioSchema.safeParse({});
    expect(vacio.success).toBe(false);
    expect(vacio.error?.issues[0].path).toEqual(['fotoUrl']);
    expect(
      actualizarPerfilVeterinarioSchema.safeParse({ descripcion: 'x', activo: false }).success,
    ).toBe(false);
  });

  it('rechaza una foto que no es http(s) y una descripción demasiado larga', () => {
    expect(actualizarPerfilVeterinarioSchema.safeParse({ fotoUrl: 'javascript:x' }).success).toBe(
      false,
    );
    expect(
      actualizarPerfilVeterinarioSchema.safeParse({ descripcion: 'a'.repeat(2_001) }).success,
    ).toBe(false);
  });
});
