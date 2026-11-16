import { z } from 'zod';

// ---------------------------------------------------------------------------------------------
// HU-046 · Elegir un producto y agregarlo al carrito (acuerdo A-17)
//
// El carrito se guarda en el navegador y es de UNA sola tienda, porque cada pedido es de una sola
// tienda. No guarda precios: se consultan siempre al servidor. HU-047 (carrito y pedido) debe leer
// este mismo formato.
// ---------------------------------------------------------------------------------------------

/** Máximo de unidades de un producto en el carrito. */
export const MAX_CANTIDAD_CARRITO = 99;
/** Con este stock o menos se muestra "¡Quedan N!" (decisión D-08). */
export const STOCK_BAJO = 5;

const cantidadSchema = z
  .number()
  .int('La cantidad debe ser un número entero')
  .min(1, 'La cantidad mínima es 1')
  .max(MAX_CANTIDAD_CARRITO, `La cantidad máxima es ${MAX_CANTIDAD_CARRITO}`);

export const itemCarritoSchema = z.object({
  productoId: z.uuid(),
  cantidad: cantidadSchema,
});
export type ItemCarrito = z.infer<typeof itemCarritoSchema>;

/** Formato del carrito: la tienda (aliadoId) y cuántas unidades de cada producto. */
export const carritoSchema = z.object({
  aliadoId: z.uuid(),
  items: z.array(itemCarritoSchema).max(100),
});
export type Carrito = z.infer<typeof carritoSchema>;

export type DisponibilidadProducto =
  | { tipo: 'AGOTADO'; texto: 'Agotado' }
  | { tipo: 'POCAS'; texto: string }
  | { tipo: 'DISPONIBLE'; texto: 'Disponible' };

/** "Agotado" (0), "¡Quedan N!" (1 a 5) o "Disponible" (más de 5). */
export function disponibilidadProducto(stock: number): DisponibilidadProducto {
  if (stock <= 0) return { tipo: 'AGOTADO', texto: 'Agotado' };
  if (stock <= STOCK_BAJO) return { tipo: 'POCAS', texto: `¡Quedan ${stock}!` };
  return { tipo: 'DISPONIBLE', texto: 'Disponible' };
}

/** Cantidad máxima que se puede elegir en el detalle: lo que haya en stock, hasta 99. */
export function cantidadMaximaProducto(stock: number) {
  return Math.max(0, Math.min(stock, MAX_CANTIDAD_CARRITO));
}

/** Unidades de un producto que ya están en el carrito. */
export function cantidadEnCarrito(carrito: Carrito | null, productoId: string) {
  return carrito?.items.find((item) => item.productoId === productoId)?.cantidad ?? 0;
}

export type ResultadoAgregar =
  | { tipo: 'OK'; carrito: Carrito }
  /** El carrito tiene productos de otra tienda: hay que preguntar si se vacía. */
  | { tipo: 'OTRA_TIENDA' }
  /** Lo pedido más lo que ya había supera el stock. */
  | { tipo: 'SIN_STOCK'; quedan: number; enCarrito: number }
  /** Lo pedido más lo que ya había supera el máximo por producto. */
  | { tipo: 'MAXIMO'; enCarrito: number };

/**
 * Agrega `cantidad` unidades de un producto (con su stock recién consultado) al carrito.
 * Agregar un producto que ya estaba suma la cantidad, nunca por encima del stock ni de 99.
 * Para reemplazar un carrito de otra tienda, llama con `carrito = null`.
 * No modifica el carrito recibido.
 */
export function agregarAlCarrito(
  carrito: Carrito | null,
  producto: { id: string; aliadoId: string; stock: number },
  cantidad: number,
): ResultadoAgregar {
  const base =
    carrito && carrito.items.length > 0 ? carrito : { aliadoId: producto.aliadoId, items: [] };
  if (base.aliadoId !== producto.aliadoId) return { tipo: 'OTRA_TIENDA' };

  const enCarrito = cantidadEnCarrito(base, producto.id);
  const total = enCarrito + cantidad;
  if (total > producto.stock) return { tipo: 'SIN_STOCK', quedan: producto.stock, enCarrito };
  if (total > MAX_CANTIDAD_CARRITO) return { tipo: 'MAXIMO', enCarrito };

  const items = enCarrito
    ? base.items.map((item) =>
        item.productoId === producto.id ? { ...item, cantidad: total } : item,
      )
    : [...base.items, { productoId: producto.id, cantidad }];
  return { tipo: 'OK', carrito: { aliadoId: producto.aliadoId, items } };
}
