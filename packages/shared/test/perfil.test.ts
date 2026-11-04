import { describe, expect, it } from 'vitest';
import { actualizarPerfilSchema, eliminarCuentaSchema } from '../src';

describe('actualizarPerfilSchema (HU-006)', () => {
  it('acepta cambiar solo un campo', () => {
    expect(actualizarPerfilSchema.safeParse({ nombre: 'Ana María' }).success).toBe(true);
  });

  it('exige al menos un campo', () => {
    expect(actualizarPerfilSchema.safeParse({}).success).toBe(false);
  });

  it('aplica las mismas reglas que el registro', () => {
    expect(actualizarPerfilSchema.safeParse({ celular: '123' }).success).toBe(false);
    expect(actualizarPerfilSchema.safeParse({ correo: 'no-es-correo' }).success).toBe(false);
    expect(actualizarPerfilSchema.safeParse({ nombre: '   ' }).success).toBe(false);
  });

  it('rechaza campos que no se pueden editar', () => {
    expect(actualizarPerfilSchema.safeParse({ nombre: 'X', rol: 'EQUIPO_VETO' }).success).toBe(
      false,
    );
  });
});

describe('eliminarCuentaSchema (HU-006)', () => {
  it('exige la confirmación explícita', () => {
    expect(eliminarCuentaSchema.safeParse({ contrasena: 'x' }).success).toBe(false);
    expect(eliminarCuentaSchema.safeParse({ contrasena: 'x', confirmacion: 'si' }).success).toBe(
      false,
    );
    expect(
      eliminarCuentaSchema.safeParse({ contrasena: 'x', confirmacion: 'ELIMINAR' }).success,
    ).toBe(true);
  });
});
