import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashContrasena(contrasena: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(contrasena, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

export async function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  const [algoritmo, saltCodificado, claveCodificada] = hash.split('$');
  if (algoritmo !== 'scrypt' || !saltCodificado || !claveCodificada) return false;

  try {
    const salt = Buffer.from(saltCodificado, 'base64url');
    const claveEsperada = Buffer.from(claveCodificada, 'base64url');
    const clave = (await scrypt(contrasena, salt, claveEsperada.length)) as Buffer;
    return clave.length === claveEsperada.length && timingSafeEqual(clave, claveEsperada);
  } catch {
    return false;
  }
}

export function hashSesion(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
