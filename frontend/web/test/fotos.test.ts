import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepararVistasPrevias, separarEnlaces, urlDeImagen } from '../src/lib/fotos';

afterEach(() => vi.unstubAllGlobals());

describe('fotos por enlace (§2.7)', () => {
  it('separa una URL por línea o por comas, sin vacíos y respetando el máximo', () => {
    expect(
      separarEnlaces(' https://a.co/1.jpg \n\nhttps://a.co/2.jpg, https://a.co/3.jpg', 2),
    ).toEqual(['https://a.co/1.jpg', 'https://a.co/2.jpg']);
  });

  it('convierte un enlace compartido de Drive en la imagen directa', async () => {
    await expect(urlDeImagen('https://drive.google.com/file/d/abc123/view')).resolves.toBe(
      'https://drive.google.com/uc?export=view&id=abc123',
    );
  });

  it('un enlace que falla se marca y los demás siguen', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () => new Response(JSON.stringify({ error: 'No es una imagen' }), { status: 422 }),
      ),
    );
    const previews = await prepararVistasPrevias(['https://postimg.cc/xyz', 'https://a.co/1.jpg']);
    expect(previews[0]).toMatchObject({ estado: 'error', mensaje: 'No es una imagen' });
    expect(previews[1]).toMatchObject({ estado: 'lista', url: 'https://a.co/1.jpg' });
  });
});
