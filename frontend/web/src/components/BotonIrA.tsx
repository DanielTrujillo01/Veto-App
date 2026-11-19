'use client';

import type { ReactNode } from 'react';

/**
 * Botón de los encabezados que baja a una sección de la misma página. Desplaza con
 * scrollIntoView (funciona aunque la URL ya tenga ese #ancla) y deja el enlace como respaldo.
 */
export function BotonIrA({ destino, children }: { destino: string; children: ReactNode }) {
  return (
    <a
      className="veto-button veto-button--primary"
      href={`#${destino}`}
      onClick={(evento) => {
        const seccion = document.getElementById(destino);
        if (!seccion) return;
        evento.preventDefault();
        const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        seccion.scrollIntoView({ behavior: sinMovimiento ? 'auto' : 'smooth', block: 'start' });
      }}
    >
      {children}
    </a>
  );
}
