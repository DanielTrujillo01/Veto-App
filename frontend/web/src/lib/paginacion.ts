/**
 * Paginación numerada en el navegador. La API de los catálogos devuelve la lista completa, así que
 * la página se recorta aquí. La página actual vive en la URL (?pagina=2) para que funcione al
 * recargar, al compartir el enlace y con los botones de atrás/adelante.
 */

export type Pagina<T> = {
  items: T[];
  /** Página mostrada, ya ajustada al rango válido (1…totalPaginas). */
  pagina: number;
  totalPaginas: number;
  total: number;
  /** Posición (desde 1) del primer y último elemento mostrado; 0 si no hay elementos. */
  desde: number;
  hasta: number;
};

/** Lee `?pagina=` de la URL: cualquier valor no entero o menor que 1 cuenta como la página 1. */
export function leerPagina(valor: string | null | undefined): number {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 ? numero : 1;
}

export function paginar<T>(lista: readonly T[], pagina: number, porPagina: number): Pagina<T> {
  const total = lista.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(Math.max(1, Math.trunc(pagina) || 1), totalPaginas);
  const inicio = (actual - 1) * porPagina;
  const items = lista.slice(inicio, inicio + porPagina);
  return {
    items,
    pagina: actual,
    totalPaginas,
    total,
    desde: items.length ? inicio + 1 : 0,
    hasta: inicio + items.length,
  };
}

/**
 * Números a mostrar en la barra de páginas. Siempre la primera y la última, la actual con una a
 * cada lado, y "…" donde se saltan páginas. Ej.: 1 … 4 5 6 … 12.
 */
export function numerosDePagina(pagina: number, totalPaginas: number): (number | '…')[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const visibles = new Set([1, totalPaginas, pagina - 1, pagina, pagina + 1]);
  if (pagina <= 3) [2, 3, 4].forEach((n) => visibles.add(n));
  if (pagina >= totalPaginas - 2) [0, 1, 2, 3].forEach((n) => visibles.add(totalPaginas - n));
  const ordenados = [...visibles].filter((n) => n >= 1 && n <= totalPaginas).sort((a, b) => a - b);
  const resultado: (number | '…')[] = [];
  ordenados.forEach((n, i) => {
    if (i > 0 && n - ordenados[i - 1] > 1) resultado.push('…');
    resultado.push(n);
  });
  return resultado;
}

/** Copia los parámetros de la URL cambiando solo `pagina` (la página 1 no se escribe). */
export function hrefConPagina(
  ruta: string,
  parametros: URLSearchParams | Record<string, string | undefined>,
  pagina: number,
): string {
  const copia =
    parametros instanceof URLSearchParams
      ? new URLSearchParams(parametros)
      : new URLSearchParams(
          Object.entries(parametros).filter((par): par is [string, string] => Boolean(par[1])),
        );
  if (pagina > 1) copia.set('pagina', String(pagina));
  else copia.delete('pagina');
  const query = copia.toString();
  return query ? `${ruta}?${query}` : ruta;
}
