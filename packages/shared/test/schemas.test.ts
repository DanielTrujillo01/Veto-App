import { describe, expect, it } from 'vitest';
import { crearMascotaSchema, loginSchema, registroUsuarioSchema } from '../src';

describe('registroUsuarioSchema (HU-001)', () => {
  const valido = {
    nombre: 'Ana Pérez',
    celular: '3001112233',
    correo: 'ana@mail.com',
    contrasena: 'clave-segura-1',
  };

  it('acepta datos válidos', () => {
    expect(registroUsuarioSchema.safeParse(valido).success).toBe(true);
  });

  it('rechaza un celular que no tiene 10 dígitos', () => {
    expect(registroUsuarioSchema.safeParse({ ...valido, celular: '300123' }).success).toBe(false);
  });

  it('rechaza un correo con formato inválido', () => {
    expect(registroUsuarioSchema.safeParse({ ...valido, correo: 'no-es-correo' }).success).toBe(
      false,
    );
  });

  it('rechaza si falta un dato obligatorio', () => {
    const { nombre: _nombre, ...sinNombre } = valido;
    expect(registroUsuarioSchema.safeParse(sinNombre).success).toBe(false);
  });
});

describe('loginSchema (HU-002)', () => {
  it('exige correo y contraseña', () => {
    expect(loginSchema.safeParse({ correo: 'ana@mail.com', contrasena: '' }).success).toBe(false);
    expect(loginSchema.safeParse({ correo: 'ana@mail.com', contrasena: 'x' }).success).toBe(true);
  });
});

describe('crearMascotaSchema (HU-008)', () => {
  it('solo exige nombre, especie y sexo', () => {
    const r = crearMascotaSchema.safeParse({ nombre: 'Firulais', especieId: 1, sexo: 'MACHO' });
    expect(r.success).toBe(true);
  });

  it('rechaza un sexo que no existe', () => {
    const r = crearMascotaSchema.safeParse({ nombre: 'X', especieId: 1, sexo: 'OTRO' });
    expect(r.success).toBe(false);
  });
});

describe('crearMascotaSchema · validaciones de formato (HU-008 / HU-010)', () => {
  const base = { nombre: 'Firulais', especieId: 1, sexo: 'MACHO' };

  it('acepta todos los opcionales válidos', () => {
    const r = crearMascotaSchema.safeParse({
      ...base,
      raza: 'Criollo',
      fechaNacimiento: '2020-05-01',
      color: 'Café',
      pesoKg: 12.5,
      chip: 'ABC-123',
      fotos: ['https://fotos.veto.co/firulais.jpg'],
    });
    expect(r.success).toBe(true);
  });

  it('rechaza una fecha de nacimiento futura', () => {
    expect(crearMascotaSchema.safeParse({ ...base, fechaNacimiento: '2999-01-01' }).success).toBe(
      false,
    );
  });

  it('no permite fecha de nacimiento y edad a la vez', () => {
    expect(
      crearMascotaSchema.safeParse({ ...base, fechaNacimiento: '2020-01-01', edadMeses: 3 })
        .success,
    ).toBe(false);
  });

  it('rechaza peso no positivo, fotos que no son URL y más de 5 fotos', () => {
    expect(crearMascotaSchema.safeParse({ ...base, pesoKg: 0 }).success).toBe(false);
    expect(crearMascotaSchema.safeParse({ ...base, fotos: ['no-es-url'] }).success).toBe(false);
    const fotos = Array.from({ length: 6 }, (_, i) => `https://x.co/${i}.jpg`);
    expect(crearMascotaSchema.safeParse({ ...base, fotos }).success).toBe(false);
  });

  it('exige especie y nombre', () => {
    expect(crearMascotaSchema.safeParse({ nombre: 'X', sexo: 'HEMBRA' }).success).toBe(false);
    expect(
      crearMascotaSchema.safeParse({ nombre: ' ', especieId: 1, sexo: 'HEMBRA' }).success,
    ).toBe(false);
  });
});

describe('mensajes de campos obligatorios en español', () => {
  it('registro y login dicen qué falta', () => {
    const r = registroUsuarioSchema.safeParse({});
    const mensajes = Object.fromEntries(
      (r.error?.issues ?? []).map((i) => [i.path.join('.'), i.message]),
    );
    expect(mensajes).toEqual({
      nombre: 'El nombre es obligatorio',
      celular: 'El celular es obligatorio',
      correo: 'El correo es obligatorio',
      contrasena: 'La contraseña es obligatoria',
    });
    expect(loginSchema.safeParse({ correo: 'a@b.co' }).error?.issues[0].message).toBe(
      'La contraseña es obligatoria',
    );
  });
});
