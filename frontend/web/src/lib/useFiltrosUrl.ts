'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { hrefConPagina, leerPagina } from '@/lib/paginacion';

/**
 * Filtros de un catálogo guardados en la URL. Cambiar un filtro vuelve a la página 1; la página
 * se cambia con los enlaces de <Paginacion>. Al cambiar de página se lleva la vista al inicio de
 * los resultados (la lista no crece hacia abajo: se pasa de página).
 */
export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const pagina = leerPagina(parametros.get('pagina'));
  const resultadosRef = useRef<HTMLElement>(null);
  const paginaAnterior = useRef(pagina);

  useEffect(() => {
    if (paginaAnterior.current === pagina) return;
    paginaAnterior.current = pagina;
    resultadosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [pagina]);

  const leer = useCallback((nombre: string) => parametros.get(nombre) ?? '', [parametros]);

  /** Cambia uno o varios filtros (vacío = quitarlo) y vuelve a la página 1. */
  const cambiar = useCallback(
    (cambios: Record<string, string>) => {
      const copia = new URLSearchParams(parametros);
      for (const [clave, valor] of Object.entries(cambios)) {
        if (valor) copia.set(clave, valor);
        else copia.delete(clave);
      }
      router.replace(hrefConPagina(pathname, copia, 1), { scroll: false });
    },
    [parametros, pathname, router],
  );

  const limpiar = useCallback(
    () => router.replace(pathname, { scroll: false }),
    [pathname, router],
  );

  const hrefDe = useCallback(
    (numero: number) => hrefConPagina(pathname, parametros, numero),
    [parametros, pathname],
  );

  return { pagina, leer, cambiar, limpiar, hrefDe, resultadosRef };
}
