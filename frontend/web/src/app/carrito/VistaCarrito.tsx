'use client';

/**
 * Carrito (vista previa de HU-047). Lee el carrito del navegador (HU-046), consulta cada
 * producto para mostrar nombre, foto, precio y stock actuales, y permite cambiar la cantidad o
 * quitar productos. Los precios nunca se guardan: siempre vienen del servidor.
 *
 * El pago y la creación del pedido son de HU-047; aquí solo se muestra el resumen.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MAX_CANTIDAD_CARRITO, type Carrito, type ProductoCatalogo } from '@veto/shared';
import { SelectorCantidad } from '@/components/ui/SelectorCantidad';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { guardarCarrito, leerCarrito, vaciarCarrito } from '@/lib/carrito';
import { formatoPrecio } from '@/lib/formato';

type Linea =
  | { tipo: 'ok'; productoId: string; cantidad: number; producto: ProductoCatalogo }
  | { tipo: 'no-disponible'; productoId: string; cantidad: number };

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'vacio' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; carrito: Carrito; lineas: Linea[] };

const topeDe = (producto: ProductoCatalogo) => Math.min(producto.stock, MAX_CANTIDAD_CARRITO);

export function VistaCarrito() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [ajustes, setAjustes] = useState<string[]>([]);
  const [preguntarVaciar, setPreguntarVaciar] = useState(false);

  const cargar = useCallback(async () => {
    const carrito = leerCarrito();
    if (!carrito || carrito.items.length === 0) {
      setEstado({ tipo: 'vacio' });
      return;
    }
    try {
      const lineas = await Promise.all(
        carrito.items.map(async (item): Promise<Linea> => {
          try {
            const producto = await api<ProductoCatalogo>(`/productos/${item.productoId}`);
            return { tipo: 'ok', ...item, producto };
          } catch (causa) {
            if (causa instanceof ApiError && (causa.status === 404 || causa.status === 400)) {
              return { tipo: 'no-disponible', ...item };
            }
            throw causa;
          }
        }),
      );

      // Si el stock bajó desde que se agregó, la cantidad se ajusta y se avisa.
      const avisos: string[] = [];
      const items = carrito.items.map((item) => {
        const linea = lineas.find((l) => l.productoId === item.productoId);
        if (linea?.tipo !== 'ok') return item;
        const tope = topeDe(linea.producto);
        if (tope > 0 && item.cantidad > tope) {
          avisos.push(
            `${linea.producto.nombre}: solo quedan ${tope}, así que ajustamos tu cantidad.`,
          );
          return { ...item, cantidad: tope };
        }
        return item;
      });
      if (avisos.length) guardarCarrito({ ...carrito, items });
      setAjustes(avisos);
      setEstado({
        tipo: 'listo',
        carrito: { ...carrito, items },
        lineas: lineas.map((linea) => ({
          ...linea,
          cantidad: items.find((i) => i.productoId === linea.productoId)?.cantidad ?? 0,
        })),
      });
    } catch {
      setEstado({ tipo: 'error', mensaje: 'No pudimos cargar tu carrito. Intenta de nuevo.' });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Si el carrito cambia en otra pestaña, se vuelve a leer.
  useEffect(() => {
    const alCambiar = (evento: StorageEvent) => {
      if (evento.key === null || evento.key === 'veto_carrito') void cargar();
    };
    window.addEventListener('storage', alCambiar);
    return () => window.removeEventListener('storage', alCambiar);
  }, [cargar]);

  function actualizar(productoId: string, cantidad: number | null) {
    if (estado.tipo !== 'listo') return;
    const items =
      cantidad === null
        ? estado.carrito.items.filter((item) => item.productoId !== productoId)
        : estado.carrito.items.map((item) =>
            item.productoId === productoId ? { ...item, cantidad } : item,
          );
    if (items.length === 0) {
      vaciarCarrito();
      setEstado({ tipo: 'vacio' });
      return;
    }
    const carrito = { ...estado.carrito, items };
    guardarCarrito(carrito);
    setEstado({
      tipo: 'listo',
      carrito,
      lineas: estado.lineas
        .filter((linea) => cantidad !== null || linea.productoId !== productoId)
        .map((linea) =>
          linea.productoId === productoId && cantidad !== null ? { ...linea, cantidad } : linea,
        ),
    });
  }

  if (estado.tipo === 'cargando') {
    return (
      <div className="cart-page">
        <EncabezadoCarrito />
        <span className="skeleton cart-skeleton" />
      </div>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <div className="cart-page">
        <EncabezadoCarrito />
        <AlertBox tone="error" title="Algo salió mal">
          {estado.mensaje}{' '}
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </div>
    );
  }

  if (estado.tipo === 'vacio') {
    return (
      <div className="cart-page">
        <EncabezadoCarrito />
        <div className="empty-state catalog-empty">
          <span aria-hidden="true" className="empty-state__illustration">
            ♡
          </span>
          <h2>Tu carrito está vacío</h2>
          <p>Encuentra alimento, accesorios e higiene para tu mascota en la tienda.</p>
          <Link className="veto-button veto-button--primary" href="/tienda">
            Ir a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const disponibles = estado.lineas.filter(
    (linea): linea is Extract<Linea, { tipo: 'ok' }> => linea.tipo === 'ok',
  );
  const total = disponibles.reduce((suma, l) => suma + l.producto.precio * l.cantidad, 0);
  const unidades = disponibles.reduce((suma, l) => suma + l.cantidad, 0);
  const tienda = disponibles[0]?.producto.aliado;

  return (
    <div className="cart-page">
      <EncabezadoCarrito tienda={tienda} />

      {ajustes.length > 0 && (
        <AlertBox tone="warning" title="Ajustamos tu carrito">
          {ajustes.join(' ')}
        </AlertBox>
      )}

      <div className="cart-layout">
        <section aria-label="Productos del carrito" className="cart-list">
          <div aria-hidden="true" className="cart-row cart-row--head">
            <span>Producto</span>
            <span>Precio</span>
            <span>Cantidad</span>
            <span>Subtotal</span>
            <span />
          </div>
          {estado.lineas.map((linea) =>
            linea.tipo === 'ok' ? (
              <FilaCarrito
                key={linea.productoId}
                linea={linea}
                onCambiar={(cantidad) => actualizar(linea.productoId, cantidad)}
                onQuitar={() => actualizar(linea.productoId, null)}
              />
            ) : (
              <div className="cart-row cart-row--off" key={linea.productoId}>
                <span className="cart-row__product">
                  <span aria-hidden="true" className="cart-row__thumb">
                    ♡
                  </span>
                  <span>
                    <strong>Producto no disponible</strong>
                    <small>La tienda lo retiró. Quítalo para continuar.</small>
                  </span>
                </span>
                <span />
                <span />
                <span />
                <BotonQuitar
                  etiqueta="Quitar producto no disponible"
                  onClick={() => actualizar(linea.productoId, null)}
                />
              </div>
            ),
          )}
          <div className="cart-list__foot">
            <Link className="text-action" href="/tienda">
              ← Seguir comprando
            </Link>
            {preguntarVaciar ? (
              <span className="cart-list__confirm">
                ¿Vaciar todo el carrito?
                <VetoButton onClick={() => setPreguntarVaciar(false)} variant="secondary">
                  No
                </VetoButton>
                <VetoButton
                  onClick={() => {
                    vaciarCarrito();
                    setPreguntarVaciar(false);
                    setEstado({ tipo: 'vacio' });
                  }}
                >
                  Sí, vaciar
                </VetoButton>
              </span>
            ) : (
              <button
                className="cart-list__clear"
                onClick={() => setPreguntarVaciar(true)}
                type="button"
              >
                Vaciar carrito
              </button>
            )}
          </div>
        </section>

        <aside aria-label="Resumen del pedido" className="cart-summary">
          <h2>Resumen</h2>
          <p>
            <span>
              {unidades} {unidades === 1 ? 'producto' : 'productos'}
            </span>
            <strong>{formatoPrecio(total)}</strong>
          </p>
          <p className="cart-summary__total">
            <span>Total</span>
            <strong>{formatoPrecio(total)}</strong>
          </p>
          <VetoButton disabled type="button">
            Finalizar compra
          </VetoButton>
          <small>
            El pago de pedidos llegará pronto. Tu carrito queda guardado en este navegador.
          </small>
        </aside>
      </div>
    </div>
  );
}

function EncabezadoCarrito({ tienda }: { tienda?: string }) {
  return (
    <header className="cart-heading">
      <span className="eyebrow eyebrow--dark">TU CARRITO</span>
      <h1>
        Lo que llevas <em>para tu mascota.</em>
      </h1>
      {tienda && <p>Productos de {tienda}. Cada pedido es de una sola tienda.</p>}
    </header>
  );
}

function FilaCarrito({
  linea,
  onCambiar,
  onQuitar,
}: {
  linea: Extract<Linea, { tipo: 'ok' }>;
  onCambiar: (cantidad: number) => void;
  onQuitar: () => void;
}) {
  const { producto, cantidad } = linea;
  const [fotoFallida, setFotoFallida] = useState(false);
  const foto = producto.fotos[0];
  const tope = topeDe(producto);
  const agotado = tope === 0;

  return (
    <div className={`cart-row${agotado ? ' cart-row--off' : ''}`}>
      <span className="cart-row__product">
        <span className="cart-row__thumb">
          {foto && !fotoFallida ? (
            <img alt="" onError={() => setFotoFallida(true)} src={foto} />
          ) : (
            <span aria-hidden="true">♡</span>
          )}
        </span>
        <span>
          <Link href={`/tienda/productos/${producto.id}`}>{producto.nombre}</Link>
          <small>{agotado ? 'Agotado: quítalo para continuar.' : producto.categoria}</small>
        </span>
      </span>
      <span className="cart-row__price" data-label="Precio">
        {formatoPrecio(producto.precio)}
      </span>
      <span className="cart-row__qty" data-label="Cantidad">
        {agotado ? (
          '—'
        ) : (
          <>
            <SelectorCantidad
              etiqueta={`Cantidad de ${producto.nombre}`}
              maximo={tope}
              onCambiar={onCambiar}
              valor={Math.min(cantidad, tope)}
            />
            {cantidad >= tope && <small>Máximo disponible</small>}
          </>
        )}
      </span>
      <strong className="cart-row__subtotal" data-label="Subtotal">
        {agotado ? '—' : formatoPrecio(producto.precio * cantidad)}
      </strong>
      <BotonQuitar etiqueta={`Quitar ${producto.nombre} del carrito`} onClick={onQuitar} />
    </div>
  );
}

function BotonQuitar({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) {
  return (
    <button aria-label={etiqueta} className="cart-row__remove" onClick={onClick} type="button">
      <svg
        aria-hidden="true"
        fill="none"
        height="18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="18"
      >
        <path d="M4 7h16" />
        <path d="M10 11v6M14 11v6" />
        <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
        <path d="M9 7V4h6v3" />
      </svg>
    </button>
  );
}
