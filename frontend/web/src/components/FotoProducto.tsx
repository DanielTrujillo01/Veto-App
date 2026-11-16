'use client';

import { useState } from 'react';
import { Avatar } from '@/components/ui/veto-components';

/**
 * Portada de un producto en miniatura. Sin foto, o si la foto no carga, muestra la inicial del
 * nombre con el `Avatar` del sistema de diseño (§2.7), sin romper la fila.
 */
export function FotoProducto({ nombre, url }: { nombre: string; url?: string }) {
  const [fallida, setFallida] = useState(false);
  if (!url || fallida) return <Avatar name={nombre} />;
  return (
    <span className="avatar" role="img" aria-label={`Foto de ${nombre}`}>
      <img alt="" onError={() => setFallida(true)} src={url} />
    </span>
  );
}
