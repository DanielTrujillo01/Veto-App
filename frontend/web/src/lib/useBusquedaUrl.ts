'use client';

import { useEffect, useState } from 'react';

const ESPERA_MS = 300;

/**
 * Texto de un buscador guardado en la URL (?nombre=…). El campo responde al instante y la URL
 * se actualiza al dejar de escribir; si la URL cambia (atrás, limpiar filtros), el campo la sigue.
 */
export function useBusquedaUrl(
  valorUrl: string,
  cambiar: (cambios: Record<string, string>) => void,
  clave = 'nombre',
) {
  const [texto, setTexto] = useState(valorUrl);

  useEffect(() => setTexto(valorUrl), [valorUrl]);

  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === valorUrl) return;
    const espera = setTimeout(() => cambiar({ [clave]: limpio }), ESPERA_MS);
    return () => clearTimeout(espera);
  }, [texto, valorUrl, cambiar, clave]);

  return [texto, setTexto] as const;
}
