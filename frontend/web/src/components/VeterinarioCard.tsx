'use client';

import { useEffect, useRef, useState } from 'react';

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
          onError={() => setImagenFallidaUrl(fotoUrl)}
          className="h-24 w-24 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`Foto no disponible de ${nombre}`}
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-borde text-2xl font-semibold text-suave"
        >
          {nombre.trim().charAt(0).toLocaleUpperCase() || '?'}
        </div>
      )}
      <div className="min-w-0">
        <h2 className="font-semibold">{nombre}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-suave">
          {descripcion || 'Descripción no disponible.'}
        </p>
      </div>
    </article>
  );
}
