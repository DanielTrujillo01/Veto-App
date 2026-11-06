import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
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
    const formatoHexadecimal =
      /^[0-9a-f]+$/i.test(saltCodificado) && /^[0-9a-f]+$/i.test(claveCodificada);
    const codificacion = formatoHexadecimal ? 'hex' : 'base64url';
    const salt = Buffer.from(saltCodificado, codificacion);
    const claveEsperada = Buffer.from(claveCodificada, codificacion);
    const clave = (await scrypt(contrasena, salt, claveEsperada.length)) as Buffer;
    return clave.length === claveEsperada.length && timingSafeEqual(clave, claveEsperada);
  } catch {
    return false;
  }
}

export function hashSesion(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

const ALFABETO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generarSecretoTotp(): string {
  let resultado = '';
  let acumulado = 0;
  let bits = 0;
  for (const byte of randomBytes(20)) {
    acumulado = (acumulado << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      resultado += ALFABETO_BASE32[(acumulado >>> bits) & 31];
    }
  }
  if (bits > 0) resultado += ALFABETO_BASE32[(acumulado << (5 - bits)) & 31];
  return resultado;
}

function decodificarBase32(valor: string): Buffer {
  let acumulado = 0;
  let bits = 0;
  const bytes: number[] = [];
  for (const caracter of valor.replace(/=+$/, '').toUpperCase()) {
    const indice = ALFABETO_BASE32.indexOf(caracter);
    if (indice < 0) throw new Error('Secreto TOTP inválido');
    acumulado = (acumulado << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulado >>> bits) & 255);
    }
  }
  return Buffer.from(bytes);
}

export function generarCodigoTotp(secreto: string, ahora = Date.now()): string {
  const contador = Math.floor(ahora / 30_000);
  const mensaje = Buffer.alloc(8);
  mensaje.writeBigInt64BE(BigInt(contador));
  const digest = createHmac('sha1', decodificarBase32(secreto)).update(mensaje).digest();
  const desplazamiento = digest[digest.length - 1] & 15;
  const numero =
    ((digest[desplazamiento] & 127) << 24) |
    (digest[desplazamiento + 1] << 16) |
    (digest[desplazamiento + 2] << 8) |
    digest[desplazamiento + 3];
  return String(numero % 1_000_000).padStart(6, '0');
}

export function contadorCodigoTotp(
  secreto: string,
  codigo: string,
  ahora = Date.now(),
): number | null {
  try {
    if (!/^\d{6}$/.test(codigo)) return null;
    const esperado = Buffer.from(generarCodigoTotp(secreto, ahora));
    const recibido = Buffer.from(codigo);
    return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
      ? Math.floor(ahora / 30_000)
      : null;
  } catch {
    return null;
  }
}

export function verificarCodigoTotp(secreto: string, codigo: string, ahora = Date.now()): boolean {
  return contadorCodigoTotp(secreto, codigo, ahora) !== null;
}

export function uriTotp(secreto: string, correo: string): string {
  const etiqueta = encodeURIComponent(`Veto:${correo}`);
  return `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=Veto&algorithm=SHA1&digits=6&period=30`;
}
