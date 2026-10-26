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
