import { describe, expect, it } from 'vitest';
import {
  agregarAlCarrito,
  cantidadMaximaProducto,
  carritoSchema,
  disponibilidadProducto,
  type Carrito,
} from '../src';

const TIENDA_A = '11111111-1111-4111-8111-111111111111';
const TIENDA_B = '22222222-2222-4222-8222-222222222222';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('HU-046 · disponibilidad (D-08)', () => {
  it.each([
    [0, 'Agotado'],
    [1, '¡Quedan 1!'],
    [3, '¡Quedan 3!'],
    [5, '¡Quedan 5!'],
    [6, 'Disponible'],
  ])('stock %i → %s', (stock, texto) => {
    expect(disponibilidadProducto(stock).texto).toBe(texto);
  });

  it('la cantidad va de 1 hasta el stock, máximo 99', () => {
    expect(cantidadMaximaProducto(3)).toBe(3);
    expect(cantidadMaximaProducto(500)).toBe(99);
    expect(cantidadMaximaProducto(0)).toBe(0);
  });
});

describe('HU-046 · agregar al carrito', () => {
  const producto = { id: P1, aliadoId: TIENDA_A, stock: 3 };

  it('crea el carrito de la tienda con el producto', () => {
    expect(agregarAlCarrito(null, producto, 2)).toEqual({
      tipo: 'OK',
      carrito: { aliadoId: TIENDA_A, items: [{ productoId: P1, cantidad: 2 }] },
    });
  });

  it('agregar 2 y luego 1 del mismo producto deja 3, nunca más que el stock', () => {
    const r1 = agregarAlCarrito(null, producto, 2);
    if (r1.tipo !== 'OK') throw new Error('debía agregar');
    const r2 = agregarAlCarrito(r1.carrito, producto, 1);
    expect(r2).toEqual({
      tipo: 'OK',
      carrito: { aliadoId: TIENDA_A, items: [{ productoId: P1, cantidad: 3 }] },
    });
    if (r2.tipo !== 'OK') throw new Error('debía agregar');
    expect(agregarAlCarrito(r2.carrito, producto, 1)).toEqual({
      tipo: 'SIN_STOCK',
      quedan: 3,
      enCarrito: 3,
    });
  });

  it('si el stock bajó, avisa cuántas quedan y no cambia nada', () => {
    const carrito: Carrito = { aliadoId: TIENDA_A, items: [{ productoId: P2, cantidad: 1 }] };
    expect(agregarAlCarrito(carrito, { ...producto, stock: 1 }, 2)).toEqual({
      tipo: 'SIN_STOCK',
      quedan: 1,
      enCarrito: 0,
    });
    expect(carrito.items).toHaveLength(1);
  });

  it('un producto de otra tienda pide confirmación; con carrito vacío (null) lo reemplaza', () => {
    const carrito: Carrito = { aliadoId: TIENDA_B, items: [{ productoId: P2, cantidad: 1 }] };
    expect(agregarAlCarrito(carrito, producto, 1)).toEqual({ tipo: 'OTRA_TIENDA' });
    expect(agregarAlCarrito(null, producto, 1)).toMatchObject({
      tipo: 'OK',
      carrito: { aliadoId: TIENDA_A, items: [{ productoId: P1, cantidad: 1 }] },
    });
  });

  it('un carrito vacío de otra tienda no pide confirmación', () => {
    expect(agregarAlCarrito({ aliadoId: TIENDA_B, items: [] }, producto, 1).tipo).toBe('OK');
  });

  it('no supera 99 unidades por producto', () => {
    const grande = { id: P1, aliadoId: TIENDA_A, stock: 500 };
    const r = agregarAlCarrito(null, grande, 99);
    if (r.tipo !== 'OK') throw new Error('debía agregar');
    expect(agregarAlCarrito(r.carrito, grande, 1)).toEqual({ tipo: 'MAXIMO', enCarrito: 99 });
  });

  it('el formato guardado no lleva precios y rechaza cantidades inválidas', () => {
    expect(
      carritoSchema.safeParse({ aliadoId: TIENDA_A, items: [{ productoId: P1, cantidad: 0 }] })
        .success,
    ).toBe(false);
    expect(
      carritoSchema.parse({
        aliadoId: TIENDA_A,
        items: [{ productoId: P1, cantidad: 2, precio: 1000 }],
      }),
    ).toEqual({ aliadoId: TIENDA_A, items: [{ productoId: P1, cantidad: 2 }] });
  });
});
