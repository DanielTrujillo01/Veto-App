'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IconoCarrito } from '@/components/ui/iconos';
import { EVENTO_CARRITO, leerCarrito, unidadesEnCarrito } from '@/lib/carrito';

/**
 * Acceso al carrito en el header, con el número de unidades. El carrito vive en el navegador
 * (HU-046): se actualiza al agregar productos (evento EVENTO_CARRITO) y si cambia en otra pestaña.
 */
export function CarritoEnlace({ onClick }: { onClick?: () => void }) {
  const [unidades, setUnidades] = useState(0);

  useEffect(() => {
    const actualizar = () => setUnidades(unidadesEnCarrito(leerCarrito()));
    actualizar();
    window.addEventListener(EVENTO_CARRITO, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(EVENTO_CARRITO, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);

  return (
    <Link
      aria-label={
        unidades ? `Carrito, ${unidades} ${unidades === 1 ? 'producto' : 'productos'}` : 'Carrito'
      }
      className="public-cart"
      href="/carrito"
      onClick={onClick}
    >
      <IconoCarrito tamano={24} />
      {unidades > 0 && (
        <span aria-hidden="true" className="public-cart__count">
          {unidades > 99 ? '99+' : unidades}
        </span>
      )}
    </Link>
  );
}
