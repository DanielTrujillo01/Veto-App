/**
 * Fotos por enlace (§2.7 de las historias refinadas): no se suben archivos, se pegan enlaces.
 * Lo usan las mascotas del tutor y los productos de la tienda (HU-044).
 */

export type FotoPreview = {
  original: string;
  url: string;
  estado: 'cargando' | 'lista' | 'error';
  mensaje?: string;
};

/** Separa el texto del campo de fotos (una URL por línea o separadas por comas). */
export function separarEnlaces(texto: string, maximo?: number): string[] {
  const enlaces = texto
    .split(/\n|,/)
    .map((foto) => foto.trim())
    .filter(Boolean);
  return maximo === undefined ? enlaces : enlaces.slice(0, maximo);
}

/**
 * Convierte un enlace compartido en la URL directa de la imagen: los de Postimg se resuelven en
 * el servidor de la web y los de Google Drive se reescriben. Los demás se usan tal cual.
 */
export async function urlDeImagen(url: string) {
  const parsedUrl = new URL(url);
  if (['postimg.cc', 'www.postimg.cc'].includes(parsedUrl.hostname)) {
    const response = await fetch(`/api/photos/resolve?url=${encodeURIComponent(url)}`);
    const resultado = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !resultado.url) {
      throw new Error(resultado.error || 'No pudimos encontrar la imagen en Postimg.');
    }
    return resultado.url;
  }

  if (['drive.google.com', 'www.drive.google.com'].includes(parsedUrl.hostname)) {
    const id =
      parsedUrl.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? parsedUrl.searchParams.get('id');
    if (!id)
      throw new Error('Usa un enlace compartido de Google Drive que incluya el ID del archivo.');
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
  }

  return url;
}

/** Prepara la vista previa de cada enlace; un enlace que falla no afecta a los demás. */
export function prepararVistasPrevias(enlaces: string[]): Promise<FotoPreview[]> {
  return Promise.all(
    enlaces.map(async (original) => {
      try {
        return { original, url: await urlDeImagen(original), estado: 'lista' as const };
      } catch (causa) {
        return {
          original,
          url: '',
          estado: 'error' as const,
          mensaje:
            causa instanceof Error
              ? causa.message
              : 'No pudimos leer este enlace. Conservamos la URL para que puedas corregirla.',
        };
      }
    }),
  );
}
