import { carritoSchema, type Carrito } from '@veto/shared';

/**
 * HU-046 · Carrito guardado en el navegador (acuerdo A-17).
 * El formato es `Carrito` de @veto/shared: { aliadoId, items: [{ productoId, cantidad }] }, de una
 * sola tienda y sin precios. HU-047 debe leerlo con `leerCarrito()`.
 */
export const CLAVE_CARRITO = 'veto_carrito';
/** Evento que se emite en `window` cada vez que cambia el carrito (por ejemplo, para un contador). */
export const EVENTO_CARRITO = 'veto:carrito';

/** El carrito guardado, o null si no hay o lo guardado no es válido. */
export function leerCarrito(): Carrito | null {
  if (typeof window === 'undefined') return null;
  try {
    const guardado = window.localStorage.getItem(CLAVE_CARRITO);
    if (!guardado) return null;
    const resultado = carritoSchema.safeParse(JSON.parse(guardado));
    return resultado.success ? resultado.data : null;
  } catch {
    return null;
  }
}

export function guardarCarrito(carrito: Carrito) {
  window.localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carritoSchema.parse(carrito)));
  window.dispatchEvent(new Event(EVENTO_CARRITO));
}

export function vaciarCarrito() {
  window.localStorage.removeItem(CLAVE_CARRITO);
  window.dispatchEvent(new Event(EVENTO_CARRITO));
}

/** Total de unidades en el carrito. */
export function unidadesEnCarrito(carrito: Carrito | null) {
  return carrito?.items.reduce((total, item) => total + item.cantidad, 0) ?? 0;
}
