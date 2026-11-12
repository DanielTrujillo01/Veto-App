import { randomBytes, scryptSync } from 'node:crypto';
import {
  generarCodigoTotp,
  generarSecretoTotp,
  hashContrasena,
  uriTotp,
  verificarCodigoTotp,
  verificarContrasena,
} from '../src/modules/identidad/seguridad';

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

  it('mantiene acceso a cuentas creadas con el formato hexadecimal anterior', async () => {
    const salt = randomBytes(16);
    const clave = scryptSync('test1234', salt, 64);
    const hashAnterior = `scrypt$${salt.toString('hex')}$${clave.toString('hex')}`;

    await expect(verificarContrasena('test1234', hashAnterior)).resolves.toBe(true);
    await expect(verificarContrasena('otra-clave', hashAnterior)).resolves.toBe(false);
  });

  it('genera códigos TOTP compatibles con Google Authenticator', () => {
    const secreto = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    expect(generarCodigoTotp(secreto, 59_000)).toBe('287082');
    expect(verificarCodigoTotp(secreto, '287082', 59_000)).toBe(true);
    expect(verificarCodigoTotp(secreto, '000000', 59_000)).toBe(false);
  });

  it('genera un secreto Base32 y una URI de configuración', () => {
    const secreto = generarSecretoTotp();
    expect(secreto).toMatch(/^[A-Z2-7]{32}$/);
    expect(uriTotp(secreto, 'ana@mail.com')).toContain(`secret=${secreto}`);
    expect(uriTotp(secreto, 'ana@mail.com')).toContain('issuer=Veto');
  });
});
