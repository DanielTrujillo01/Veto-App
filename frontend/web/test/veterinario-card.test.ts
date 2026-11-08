import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VeterinarioCard, inicialDe } from '../src/components/VeterinarioCard';

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
    expect(html).toContain('>L<');
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
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('Medicina felina');
  });

  it('usa un encabezado h3 dentro de la sección del equipo y un texto si no hay descripción', () => {
    const html = renderToStaticMarkup(
      createElement(VeterinarioCard, { nombre: '  luna ', fotoUrl: null, descripcion: null }),
    );
    expect(html).toContain('<h3');
    expect(html).toContain('Descripción no disponible.');
    expect(html).toContain('>L<');
  });

  it('la inicial ignora el título profesional', () => {
    expect(inicialDe('Dr. Mateo Ríos')).toBe('M');
    expect(inicialDe('dra luna')).toBe('L');
    expect(inicialDe('Doctora Ana')).toBe('A');
    expect(inicialDe('Drake Soto')).toBe('D');
    expect(inicialDe('Dr.')).toBe('D');
    expect(inicialDe('   ')).toBe('?');
  });
});
