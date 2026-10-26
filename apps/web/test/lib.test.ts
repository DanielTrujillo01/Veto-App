import { registroUsuarioSchema } from '@veto/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../src/lib/api';
import { erroresPorCampo } from '../src/lib/errores';

afterEach(() => vi.unstubAllGlobals());

describe('erroresPorCampo + esquemas compartidos', () => {
  it('devuelve un mensaje por cada campo inválido del registro', () => {
    const r = registroUsuarioSchema.safeParse({
      nombre: '',
      celular: '123',
      correo: 'x',
      contrasena: 'corta',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const errores = erroresPorCampo(r.error);
      expect(Object.keys(errores).sort()).toEqual(['celular', 'contrasena', 'correo', 'nombre']);
      expect(errores.celular).toBe('El celular debe tener 10 dígitos');
    }
  });
});

describe('api()', () => {
  it('devuelve el JSON cuando la respuesta es correcta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }))),
    );
    await expect(api('/health')).resolves.toEqual({ status: 'ok' });
  });

  it('lanza ApiError con el estado HTTP cuando falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('no', { status: 503 })),
    );
    await expect(api('/health')).rejects.toMatchObject({ name: 'ApiError', status: 503 });
    await expect(api('/health')).rejects.toBeInstanceOf(ApiError);
  });
});
