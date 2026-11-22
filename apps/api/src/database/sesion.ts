import { ZONA_HORARIA } from '@veto/shared';

/**
 * Parámetros que se fijan en cada conexión a la base:
 * - `search_path`: las tablas viven en el esquema `veto`.
 * - `timezone`: hora de Colombia. El horario de atención se guarda como hora del día ("08:00") y
 *   la base lo interpreta en la zona de la sesión; sin esto dependería de la zona con que se
 *   instaló el servidor (UTC en Docker y en Supabase), y un horario de 08:00 a 12:00 sería de
 *   03:00 a 07:00 en Colombia. Las fechas siguen guardándose como instantes absolutos.
 */
export const OPCIONES_DE_SESION = `-c search_path=veto,public -c timezone=${ZONA_HORARIA}`;

/**
 * Lo mismo, como SQL. El pooler de Supabase (`*.pooler.supabase.com`) aplica `search_path` desde
 * las opciones de conexión, pero **ignora `timezone`**: la sesión queda en UTC y el horario de
 * 08:00 se volvía a ofrecer a las 03:00. Por eso, además de las opciones, se ejecuta esto apenas
 * se abre cada conexión. En modo sesión del pooler (puerto 5432) el ajuste dura lo que dura la
 * conexión, igual que con una base directa o la de Docker.
 */
export const SQL_DE_SESION = `SET TIME ZONE '${ZONA_HORARIA}'; SET search_path TO veto, public`;

type Conexion = { query: (sql: string) => Promise<unknown> };
type PoolConEventos = {
  on: (evento: 'connect', escucha: (conexion: Conexion) => void) => unknown;
};

/**
 * Hace que cada conexión nueva del pool quede en hora de Colombia y con el esquema `veto`.
 * `pg` atiende las consultas de una conexión en orden, así que este ajuste se ejecuta antes de
 * cualquier consulta de la API que use esa conexión.
 */
export function prepararConexiones<T extends PoolConEventos>(pool: T): T {
  pool.on('connect', (conexion) => {
    conexion.query(SQL_DE_SESION).catch((error: unknown) => {
      // No debería pasar; si pasa, se registra para no ocultar un desfase de horario.
      console.error('No se pudo fijar la zona horaria de la conexión', error);
    });
  });
  return pool;
}
