'use client';

// HU-013: tarjeta del veterinario en la ficha pública de la clínica. Si no hay foto, o la URL
// no carga, muestra la inicial del nombre como alternativa visual.

import { useEffect, useRef, useState } from 'react';

/** Inicial para la alternativa visual, sin el título profesional (Dr., Dra., ...). */
export function inicialDe(nombre: string): string {
  const sinTitulo = nombre.trim().replace(/^(dra?|doctora?|mvz|mv)\.?\s+/i, '');
  return (sinTitulo || nombre.trim()).charAt(0).toLocaleUpperCase() || '?';
}

type Props = { nombre: string; fotoUrl: string | null; descripcion: string | null };

export function VeterinarioCard({ nombre, fotoUrl, descripcion }: Props) {
  const imagenRef = useRef<HTMLImageElement>(null);
  const [imagenFallidaUrl, setImagenFallidaUrl] = useState<string | null>(null);

  useEffect(() => {
    const imagen = imagenRef.current;
    if (fotoUrl && imagen?.complete && imagen.naturalWidth === 0) {
      setImagenFallidaUrl(fotoUrl);
    }
  }, [fotoUrl]);

  const mostrarFoto = Boolean(fotoUrl) && imagenFallidaUrl !== fotoUrl;

  return (
    <article className="flex gap-4 rounded-xl border border-borde bg-superficie p-5">
      {mostrarFoto ? (
        <img
          ref={imagenRef}
          src={fotoUrl!}
          alt={`Foto de ${nombre}`}
          loading="lazy"
          decoding="async"
          onError={() => setImagenFallidaUrl(fotoUrl)}
          className="h-24 w-24 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`Foto no disponible de ${nombre}`}
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-borde text-2xl font-semibold text-suave"
        >
          {inicialDe(nombre)}
        </div>
      )}
      <div className="min-w-0">
        <h3 className="font-semibold">{nombre}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-suave">
          {descripcion || 'Descripción no disponible.'}
        </p>
      </div>
    </article>
  );
}
