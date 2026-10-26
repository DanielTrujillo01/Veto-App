import { parseEnv } from '../src/config/env';

describe('parseEnv', () => {
  it('aplica valores por defecto', () => {
    const env = parseEnv({ DATABASE_URL: 'postgres://x' });
    expect(env.API_PORT).toBe(3001);
    expect(env.WEB_ORIGIN).toBe('http://localhost:3000');
    expect(env.NODE_ENV).toBe('development');
  });

  it('convierte el puerto a número', () => {
    expect(parseEnv({ DATABASE_URL: 'postgres://x', API_PORT: '4000' }).API_PORT).toBe(4000);
  });

  it('falla con un mensaje claro si falta DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });
});
