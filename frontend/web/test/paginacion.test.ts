import { describe, expect, it } from 'vitest';
import { hrefConPagina, leerPagina, numerosDePagina, paginar } from '../src/lib/paginacion';

describe('paginar', () => {
  const lista = Array.from({ length: 25 }, (_, i) => i + 1);

  it('recorta la página pedida y dice qué rango muestra', () => {
    expect(paginar(lista, 2, 10)).toEqual({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      pagina: 2,
      totalPaginas: 3,
      total: 25,
      desde: 11,
      hasta: 20,
    });
  });

  it('ajusta una página fuera de rango a la última válida', () => {
    const r = paginar(lista, 9, 10);
    expect(r.pagina).toBe(3);
    expect(r.items).toEqual([21, 22, 23, 24, 25]);
  });

  it('una lista vacía tiene una sola página sin elementos', () => {
    expect(paginar([], 1, 10)).toMatchObject({ items: [], pagina: 1, totalPaginas: 1, desde: 0 });
  });
});

describe('leerPagina', () => {
  it('acepta solo enteros desde 1', () => {
    expect(leerPagina('3')).toBe(3);
    expect(leerPagina('0')).toBe(1);
    expect(leerPagina('-2')).toBe(1);
    expect(leerPagina('1.5')).toBe(1);
    expect(leerPagina('abc')).toBe(1);
    expect(leerPagina(null)).toBe(1);
  });
});

describe('numerosDePagina', () => {
  it('muestra todas cuando son pocas', () => {
    expect(numerosDePagina(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('salta páginas con … alrededor de la actual', () => {
    expect(numerosDePagina(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12]);
    expect(numerosDePagina(1, 12)).toEqual([1, 2, 3, 4, '…', 12]);
    expect(numerosDePagina(12, 12)).toEqual([1, '…', 9, 10, 11, 12]);
  });
});

describe('hrefConPagina', () => {
  it('conserva los filtros y cambia solo la página', () => {
    const params = new URLSearchParams('categoriaId=2&orden=precio_asc&pagina=4');
    expect(hrefConPagina('/tienda', params, 2)).toBe(
      '/tienda?categoriaId=2&orden=precio_asc&pagina=2',
    );
    expect(hrefConPagina('/tienda', params, 1)).toBe('/tienda?categoriaId=2&orden=precio_asc');
  });

  it('acepta un objeto e ignora los valores vacíos', () => {
    expect(hrefConPagina('/clinicas/x', { especieId: '', otro: undefined }, 3)).toBe(
      '/clinicas/x?pagina=3',
    );
  });
});
