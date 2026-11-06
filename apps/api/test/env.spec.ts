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

describe('parseEnv · Google (HU-003)', () => {
  it('Google es opcional: sin variables queda sin configurar', () => {
    const env = parseEnv({ DATABASE_URL: 'postgres://x' });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.GOOGLE_REDIRECT_URI).toBeUndefined();
  });

  it('una variable vacía cuenta como no configurada', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://x',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
    });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
  });

  it('lee las credenciales cuando existen', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://x',
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secreto',
      GOOGLE_REDIRECT_URI: 'https://api.veto.co/api/identidad/google/callback',
    });
    expect(env.GOOGLE_CLIENT_ID).toBe('id');
    expect(env.GOOGLE_REDIRECT_URI).toBe('https://api.veto.co/api/identidad/google/callback');
  });
});
