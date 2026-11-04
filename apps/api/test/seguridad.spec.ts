import { hashContrasena, verificarContrasena } from '../src/modules/identidad/seguridad';

describe('seguridad de contraseñas', () => {
  it('una contraseña hasheada se verifica con el mismo formato que usa el login', async () => {
    const hash = await hashContrasena('clave-segura-1');
    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(verificarContrasena('clave-segura-1', hash)).resolves.toBe(true);
    await expect(verificarContrasena('otra-clave', hash)).resolves.toBe(false);
  });

  it('un hash con otro formato nunca verifica', async () => {
    await expect(verificarContrasena('x', 'ELIMINADA')).resolves.toBe(false);
  });
});
