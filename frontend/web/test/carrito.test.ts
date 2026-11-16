import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLAVE_CARRITO,
  EVENTO_CARRITO,
  guardarCarrito,
  leerCarrito,
  unidadesEnCarrito,
  vaciarCarrito,
} from '../src/lib/carrito';

const TIENDA = '11111111-1111-4111-8111-111111111111';
const P1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('HU-046 · carrito en el navegador', () => {
  let almacen: Map<string, string>;
  let eventos: string[];

  beforeEach(() => {
    almacen = new Map();
    eventos = [];
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => almacen.get(k) ?? null,
        setItem: (k: string, v: string) => almacen.set(k, v),
        removeItem: (k: string) => almacen.delete(k),
      },
      dispatchEvent: (e: Event) => eventos.push(e.type),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('guarda y lee el mismo carrito, y avisa del cambio', () => {
    const carrito = { aliadoId: TIENDA, items: [{ productoId: P1, cantidad: 2 }] };
    guardarCarrito(carrito);
    expect(leerCarrito()).toEqual(carrito);
    expect(unidadesEnCarrito(leerCarrito())).toBe(2);
    expect(eventos).toEqual([EVENTO_CARRITO]);
  });

  it('lo guardado inválido o dañado se ignora', () => {
    almacen.set(CLAVE_CARRITO, '{no es json');
    expect(leerCarrito()).toBeNull();
    almacen.set(CLAVE_CARRITO, JSON.stringify({ aliadoId: 'x', items: [] }));
    expect(leerCarrito()).toBeNull();
  });

  it('vaciar lo borra', () => {
    guardarCarrito({ aliadoId: TIENDA, items: [{ productoId: P1, cantidad: 1 }] });
    vaciarCarrito();
    expect(leerCarrito()).toBeNull();
  });
});
