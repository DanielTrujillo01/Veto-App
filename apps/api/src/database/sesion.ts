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
