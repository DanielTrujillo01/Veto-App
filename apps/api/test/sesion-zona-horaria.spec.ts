import { EventEmitter } from 'node:events';
import { prepararConexiones, SQL_DE_SESION } from '../src/database/sesion';

/**
 * HU-029 · El pooler de Supabase ignora `-c timezone` en las opciones de conexión. Cada conexión
 * nueva debe fijar la hora de Colombia con SQL antes de que la API la use.
 */
describe('zona horaria de cada conexión', () => {
  it('al abrir una conexión fija la hora de Colombia y el esquema veto', () => {
    const pool = new EventEmitter();
    prepararConexiones(pool);
    const conexion = { query: jest.fn().mockResolvedValue({}) };

    pool.emit('connect', conexion);

    expect(conexion.query).toHaveBeenCalledTimes(1);
    expect(conexion.query).toHaveBeenCalledWith(SQL_DE_SESION);
    expect(SQL_DE_SESION).toContain("SET TIME ZONE 'America/Bogota'");
    expect(SQL_DE_SESION).toContain('SET search_path TO veto, public');
  });

  it('si el ajuste falla lo registra en vez de ocultarlo', async () => {
    const pool = new EventEmitter();
    prepararConexiones(pool);
    const registro = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const conexion = { query: jest.fn().mockRejectedValue(new Error('sin permiso')) };

    pool.emit('connect', conexion);
    await new Promise((resolver) => setImmediate(resolver));

    expect(registro).toHaveBeenCalled();
    registro.mockRestore();
  });
});
