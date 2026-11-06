import { NOMBRE_COOKIE_SESION } from './identidad.service';

const seguro = () => (process.env.NODE_ENV === 'production' ? '; Secure' : '');

/** Cookie de sesión: HttpOnly, para que ningún script de la web pueda leer el token. */
export function cookieSesion(valor: string, maxAge: number): string {
  return `${NOMBRE_COOKIE_SESION}=${valor}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${seguro()}`;
}

/**
 * Cookie de corta vida del flujo de Google (HU-003). Solo viaja a las rutas de ese flujo.
 * SameSite=Lax permite que el navegador la envíe al volver de Google (navegación de nivel superior).
 */
export function cookieGoogle(nombre: string, valor: string, maxAge: number): string {
  return `${nombre}=${valor}; HttpOnly; Path=/api/identidad/google; SameSite=Lax; Max-Age=${maxAge}${seguro()}`;
}

/** Valor de la cookie `nombre` en el encabezado `Cookie`, o undefined si no está. */
export function leerCookie(encabezado: string | undefined, nombre: string): string | undefined {
  const valor = encabezado
    ?.split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
  return valor ? valor : undefined;
}

export const COOKIE_REAUTENTICACION = 'veto_reauth';

/**
 * Constancia de que la persona volvió a pasar por Google (HU-003). Vale para las rutas de
 * identidad (eliminar cuenta) y no la lee ningún script.
 */
export function cookieReautenticacion(valor: string, maxAge: number): string {
  return `${COOKIE_REAUTENTICACION}=${valor}; HttpOnly; Path=/api/identidad; SameSite=Lax; Max-Age=${maxAge}${seguro()}`;
}
