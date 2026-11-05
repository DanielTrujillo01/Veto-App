import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VeterinarioCard } from '../src/components/VeterinarioCard';

describe('VeterinarioCard · HU-013', () => {
  it('muestra un fallback visual accesible cuando el veterinario no tiene foto', () => {
    const html = renderToStaticMarkup(
      createElement(VeterinarioCard, {
        nombre: 'Dra. Luna',
        fotoUrl: null,
        descripcion: 'Medicina felina',
      }),
    );
    expect(html).toContain('Foto no disponible de Dra. Luna');
    expect(html).toContain('D');
    expect(html).toContain('Medicina felina');
    expect(html).not.toContain('<img');
  });

  it('presenta una foto registrada con texto alternativo y la descripción', () => {
    const html = renderToStaticMarkup(
      createElement(VeterinarioCard, {
        nombre: 'Dra. Luna',
        fotoUrl: 'https://images.example.com/luna.jpg',
        descripcion: 'Medicina felina',
      }),
    );
    expect(html).toContain('src="https://images.example.com/luna.jpg"');
    expect(html).toContain('alt="Foto de Dra. Luna"');
    expect(html).toContain('Medicina felina');
  });
});
