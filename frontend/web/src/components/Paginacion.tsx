import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconoFlecha } from '@/components/ui/iconos';
import { numerosDePagina } from '@/lib/paginacion';

type PaginacionProps = {
  pagina: number;
  totalPaginas: number;
  /** Qué se está paginando, para el lector de pantalla (ej. "productos"). */
  etiqueta: string;
} & (
  | {
      /** Enlace de cada página (la página queda en la URL). Funciona en servidor y cliente. */
      hrefDe: (pagina: number) => string;
      onCambiar?: never;
    }
  | {
      /** Para listas dentro de un panel que no usa la URL: botones en vez de enlaces. */
      onCambiar: (pagina: number) => void;
      hrefDe?: never;
    }
);

/**
 * Barra de páginas numerada: Anterior · 1 … 4 5 6 … 12 · Siguiente. No se muestra si todo cabe
 * en una página.
 */
export function Paginacion({ pagina, totalPaginas, hrefDe, onCambiar, etiqueta }: PaginacionProps) {
  if (totalPaginas <= 1) return null;
  const anterior = pagina > 1 ? pagina - 1 : null;
  const siguiente = pagina < totalPaginas ? pagina + 1 : null;

  function ir(numero: number, clase: string, contenido: ReactNode, extra: object = {}) {
    return hrefDe ? (
      <Link className={clase} href={hrefDe(numero)} scroll={false} {...extra}>
        {contenido}
      </Link>
    ) : (
      <button className={clase} onClick={() => onCambiar(numero)} type="button" {...extra}>
        {contenido}
      </button>
    );
  }

  const deshabilitado = (contenido: ReactNode) => (
    <span aria-disabled="true" className="pagination__step is-disabled">
      {contenido}
    </span>
  );
  const textoAnterior = (
    <>
      <IconoFlecha direccion="izquierda" tamano={16} /> Anterior
    </>
  );
  const textoSiguiente = (
    <>
      Siguiente <IconoFlecha tamano={16} />
    </>
  );

  return (
    <nav aria-label={`Páginas de ${etiqueta}`} className="pagination">
      {anterior ? ir(anterior, 'pagination__step', textoAnterior) : deshabilitado(textoAnterior)}
      <ol className="pagination__pages">
        {numerosDePagina(pagina, totalPaginas).map((numero, indice) =>
          numero === '…' ? (
            <li aria-hidden="true" className="pagination__gap" key={`gap-${indice}`}>
              …
            </li>
          ) : (
            <li key={numero}>
              {ir(numero, `pagination__page${numero === pagina ? ' is-active' : ''}`, numero, {
                'aria-current': numero === pagina ? 'page' : undefined,
                'aria-label': `Página ${numero}`,
              })}
            </li>
          ),
        )}
      </ol>
      {siguiente
        ? ir(siguiente, 'pagination__step', textoSiguiente)
        : deshabilitado(textoSiguiente)}
    </nav>
  );
}
