import { describe, expect, it } from 'vitest';
import { coincideBusqueda, normalizarTexto } from '../src/lib/busqueda';

describe('búsqueda por palabra clave (HU-025)', () => {
  it('ignora mayúsculas, tildes y espacios de más', () => {
    expect(normalizarTexto('  Clínica   DE  David ')).toBe('clinica de david');
    expect(coincideBusqueda('  clinica   DAVID ', 'Clínica de David')).toBe(true);
  });

  it('pide todas las palabras, en cualquier orden y en cualquier campo', () => {
    expect(coincideBusqueda('baño perro', 'Baño y peluquería', 'Para perro')).toBe(true);
    expect(coincideBusqueda('baño gato', 'Baño y peluquería', 'Para perro')).toBe(false);
  });

  it('sin consulta no filtra nada', () => {
    expect(coincideBusqueda('   ', 'Lo que sea')).toBe(true);
  });
});
