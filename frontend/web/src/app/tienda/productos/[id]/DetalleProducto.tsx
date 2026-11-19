'use client';

/**
 * HU-046 · Detalle del producto y "Agregar al carrito".
 *
 * API que consume (documentada en apps/api/src/modules/README.md, sección HU-046):
 *   GET /productos/:id  → producto visible (A-16) o 404 "Este producto ya no está disponible".
 * El carrito vive en el navegador (src/lib/carrito.ts) con el formato `Carrito` de @veto/shared.
 * No se necesita sesión para agregar (decisión D-07).
 *
 * Diseño: reutiliza la ficha de la clínica (clinic-profile, clinic-booking-card, clinic-section),
 * toast, workspace-modal, empty-state, StatusBadge, AlertBox y VetoButton. Solo se agregaron las
 * clases `.product-gallery*` y `.product-description` en globals.css.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  agregarAlCarrito,
  cantidadEnCarrito,
  cantidadMaximaProducto,
  disponibilidadProducto,
  type ProductoCatalogo,
} from '@veto/shared';
import { SelectorCantidad } from '@/components/ui/SelectorCantidad';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { guardarCarrito, leerCarrito } from '@/lib/carrito';
import { formatoPrecio } from '@/lib/formato';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'no-existe'; mensaje: string }
  | { tipo: 'listo'; producto: ProductoCatalogo };

const TONO_DISPONIBILIDAD = {
  AGOTADO: 'neutral',
  POCAS: 'warning',
  DISPONIBLE: 'success',
} as const;

/** 404 o un id inválido (400) significan que el producto no existe o ya no está visible. */
const esNoDisponible = (causa: unknown) =>
  causa instanceof ApiError && (causa.status === 404 || causa.status === 400);

function Galeria({ nombre, fotos }: { nombre: string; fotos: string[] }) {
  const [actual, setActual] = useState(0);
  const [fallidas, setFallidas] = useState<number[]>([]);
  const foto = fotos[actual];

  return (
    <div className="product-gallery">
      <div className="product-gallery__main">
        {foto && !fallidas.includes(actual) ? (
          <img
            alt={`${nombre}, foto ${actual + 1} de ${fotos.length}`}
            onError={() => setFallidas((previas) => [...previas, actual])}
            src={foto}
          />
        ) : (
          <span
            aria-label={`${nombre} sin foto disponible`}
            className="product-gallery__fallback"
            role="img"
          >
            ♡
          </span>
        )}
      </div>
      {fotos.length > 1 && (
        <div aria-label="Fotos del producto" className="product-gallery__thumbs" role="group">
          {fotos.map((url, i) => (
            <button
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === actual}
              className={i === actual ? 'is-active' : ''}
              key={url}
              onClick={() => setActual(i)}
              type="button"
            >
              {fallidas.includes(i) ? (
                <span aria-hidden="true">♡</span>
              ) : (
                <img alt="" onError={() => setFallidas((previas) => [...previas, i])} src={url} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DetalleProducto({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [agregado, setAgregado] = useState<{ cantidad: number } | null>(null);
  const [preguntarVaciar, setPreguntarVaciar] = useState(false);

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      setEstado({ tipo: 'listo', producto: await api<ProductoCatalogo>(`/productos/${id}`) });
    } catch (causa) {
      setEstado(
        esNoDisponible(causa)
          ? { tipo: 'no-existe', mensaje: 'Puede que la tienda lo haya retirado.' }
          : { tipo: 'error' },
      );
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El aviso "Agregado al carrito" se oculta solo.
  useEffect(() => {
    if (!agregado) return;
    const espera = setTimeout(() => setAgregado(null), 6000);
    return () => clearTimeout(espera);
  }, [agregado]);

  /**
   * Regla 3: al pulsar "Agregar" se vuelve a consultar el producto. Si ya no está visible o no
   * alcanza el stock (contando lo que ya está en el carrito), no se agrega nada y se actualiza la
   * pantalla con los datos nuevos.
   */
  async function agregar(vaciarOtraTienda = false, unidades = cantidad) {
    setAviso('');
    setPreguntarVaciar(false);
    setAgregando(true);
    try {
      let fresco: ProductoCatalogo;
      try {
        fresco = await api<ProductoCatalogo>(`/productos/${id}`);
      } catch (causa) {
        if (esNoDisponible(causa)) {
          setEstado({ tipo: 'no-existe', mensaje: 'La tienda lo retiró mientras lo mirabas.' });
          return;
        }
        throw causa;
      }
      setEstado({ tipo: 'listo', producto: fresco });

      const carrito = vaciarOtraTienda ? null : leerCarrito();
      const resultado = agregarAlCarrito(carrito, fresco, unidades);
      if (resultado.tipo === 'OTRA_TIENDA') {
        setPreguntarVaciar(true);
        return;
      }
      if (resultado.tipo === 'SIN_STOCK' || resultado.tipo === 'MAXIMO') {
        // Se dice cuántas se pueden agregar todavía y el selector se ajusta a eso.
        const tope = cantidadMaximaProducto(fresco.stock);
        const restantes = Math.max(0, tope - resultado.enCarrito);
        if (restantes > 0) setCantidad(restantes);
        const totalTexto =
          resultado.tipo === 'MAXIMO'
            ? `se pueden llevar hasta ${tope} por pedido`
            : `hay ${fresco.stock} ${fresco.stock === 1 ? 'unidad disponible' : 'unidades disponibles'}`;
        setAviso(
          fresco.stock === 0
            ? 'Este producto se agotó.'
            : restantes === 0
              ? `Ya tienes en tu carrito todas las unidades que puedes llevar (${resultado.enCarrito}).`
              : `Solo puedes agregar ${restantes} más: ${totalTexto} y ya tienes ${resultado.enCarrito} en tu carrito.`,
        );
        return;
      }
      guardarCarrito(resultado.carrito);
      setAgregado({ cantidad: unidades });
      setCantidad(1);
    } catch {
      setAviso('No pudimos agregar el producto. Intenta de nuevo.');
    } finally {
      setAgregando(false);
    }
  }

  if (estado.tipo === 'cargando') {
    return (
      <div className="clinic-profile" aria-busy="true" aria-label="Cargando producto">
        <div className="pet-card pet-card--skeleton">
          <span className="skeleton pet-skeleton-avatar" />
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
        </div>
      </div>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <div className="clinic-profile">
        <AlertBox tone="error" title="No pudimos cargar el producto">
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </div>
    );
  }

  if (estado.tipo === 'no-existe') {
    return (
      <div className="clinic-profile">
        <div className="empty-state empty-state--card">
          <span className="empty-state__illustration" aria-hidden="true">
            ⌂
          </span>
          <h1>Este producto ya no está disponible</h1>
          <p>{estado.mensaje} Mira otros productos en la tienda.</p>
          <Link className="veto-button veto-button--primary" href="/tienda">
            Volver a la tienda
          </Link>
        </div>
      </div>
    );
  }

  const { producto } = estado;
  const disponibilidad = disponibilidadProducto(producto.stock);
  const maximo = cantidadMaximaProducto(producto.stock);
  const agotado = disponibilidad.tipo === 'AGOTADO';
  const enCarrito = cantidadEnCarrito(leerCarrito(), producto.id);
  /** Lo que todavía se puede agregar, descontando lo que ya está en el carrito. */
  const puedeAgregar = Math.max(0, maximo - enCarrito);
  const completo = !agotado && puedeAgregar === 0;

  return (
    <div className="clinic-profile">
      <Link className="text-action" href="/tienda">
        ← Volver a la tienda
      </Link>
      <div className="detail-sheet">
        <div className="detail-sheet__media">
          <Galeria fotos={producto.fotos} nombre={producto.nombre} />
        </div>
        <section aria-labelledby="producto-nombre" className="detail-sheet__info">
          <div className="detail-panel__head">
            <div className="detail-sheet__chips">
              <span>{producto.categoria}</span>
            </div>
            <StatusBadge tone={TONO_DISPONIBILIDAD[disponibilidad.tipo]}>
              {disponibilidad.texto}
            </StatusBadge>
          </div>
          <h1 id="producto-nombre">{producto.nombre}</h1>
          <p className="detail-sheet__meta">
            <span>
              <i aria-hidden="true">⌂</i> Vendido por {producto.aliado}
            </span>
          </p>
          <p className="detail-sheet__price">{formatoPrecio(producto.precio)}</p>
          <p className="detail-sheet__text">
            {producto.descripcion || 'La tienda no agregó una descripción para este producto.'}
          </p>
          {aviso && (
            <AlertBox tone="warning" title="No se agregó al carrito">
              {aviso}
            </AlertBox>
          )}
          {/* Cantidad con − / + y el botón en la misma fila. */}
          <div className="detail-sheet__actions detail-sheet__buy">
            {!agotado && !completo && (
              <SelectorCantidad
                maximo={puedeAgregar}
                onCambiar={setCantidad}
                valor={Math.min(cantidad, puedeAgregar)}
              />
            )}
            <VetoButton
              disabled={agotado || completo}
              loading={agregando}
              onClick={() => void agregar(false, Math.min(cantidad, puedeAgregar))}
              type="button"
            >
              {agotado
                ? 'Agotado'
                : completo
                  ? 'Ya tienes todas en tu carrito'
                  : 'Agregar al carrito'}
            </VetoButton>
          </div>
          <p className="detail-sheet__note">
            <span aria-hidden="true">★</span>
            <span>
              {completo ? (
                <>
                  Ya tienes {enCarrito} en tu carrito: es todo lo que puedes llevar.{' '}
                  <Link href="/carrito">Ver carrito</Link>
                </>
              ) : cantidad >= puedeAgregar ? (
                <>
                  Seleccionaste el máximo que puedes agregar ({puedeAgregar}).
                  {enCarrito > 0 && (
                    <>
                      {' '}
                      Ya tienes {enCarrito} en tu carrito. <Link href="/carrito">Ver carrito</Link>
                    </>
                  )}
                </>
              ) : enCarrito > 0 ? (
                <>
                  Ya tienes {enCarrito} en tu carrito; puedes agregar hasta {puedeAgregar} más.{' '}
                  <Link href="/carrito">Ver carrito</Link>
                </>
              ) : (
                'No necesitas iniciar sesión para agregar; te la pediremos al comprar.'
              )}
            </span>
          </p>
        </section>
      </div>

      {preguntarVaciar && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="carrito-otra-tienda"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="alertdialog"
          >
            <p className="eyebrow eyebrow--dark">UN PEDIDO ES DE UNA SOLA TIENDA</p>
            <h2 id="carrito-otra-tienda">
              Tu carrito tiene productos de otra tienda. ¿Vaciarlo y agregar este?
            </h2>
            <div className="form-actions">
              <VetoButton onClick={() => setPreguntarVaciar(false)} variant="secondary">
                Cancelar
              </VetoButton>
              <VetoButton loading={agregando} onClick={() => void agregar(true)}>
                Vaciar y agregar
              </VetoButton>
            </div>
          </section>
        </div>
      )}

      {agregado && (
        <div className="toast" role="status">
          <span className="toast__check" aria-hidden="true">
            ✓
          </span>
          <div>
            <strong>Agregado al carrito</strong>
            <small>
              {agregado.cantidad} × {producto.nombre} ·{' '}
              <Link className="text-action" href="/carrito">
                Ver carrito
              </Link>
            </small>
          </div>
          <button aria-label="Cerrar aviso" onClick={() => setAgregado(null)} type="button">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
