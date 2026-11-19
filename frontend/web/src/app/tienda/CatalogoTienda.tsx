'use client';

/**
 * HU-045 · Productos por categoría y búsqueda por texto (combinables).
 * HU-027 · Orden por nombre o precio.
 *
 * API: GET /productos/categorias y GET /productos?categoriaId&nombre&orden. La API devuelve la
 * lista completa; aquí se pagina (12 por página) con la página en la URL.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  disponibilidadProducto,
  type CategoriaProducto,
  type OrdenProductos,
  type ProductoCatalogo,
} from '@veto/shared';
import { Paginacion } from '@/components/Paginacion';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { formatoPrecio } from '@/lib/formato';
import { paginar } from '@/lib/paginacion';
import { useFiltrosUrl } from '@/lib/useFiltrosUrl';

const POR_PAGINA = 12;
const ESPERA_BUSQUEDA_MS = 350;

export const OPCIONES_ORDEN: { valor: OrdenProductos; texto: string }[] = [
  { valor: 'nombre', texto: 'Nombre (A–Z)' },
  { valor: 'precio_asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio_desc', texto: 'Precio: mayor a menor' },
];

const TONO_DISPONIBILIDAD = {
  AGOTADO: 'neutral',
  POCAS: 'warning',
  DISPONIBLE: 'success',
} as const;

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; productos: ProductoCatalogo[] };

function TarjetaProducto({ producto }: { producto: ProductoCatalogo }) {
  const [fotoFallida, setFotoFallida] = useState(false);
  const foto = producto.fotos[0];
  const disponibilidad = disponibilidadProducto(producto.stock);

  return (
    <Link className="product-card" href={`/tienda/productos/${producto.id}`}>
      <span className="product-card__media">
        {foto && !fotoFallida ? (
          <img alt="" loading="lazy" onError={() => setFotoFallida(true)} src={foto} />
        ) : (
          <span aria-hidden="true" className="product-card__fallback">
            ♡
          </span>
        )}
        <StatusBadge tone={TONO_DISPONIBILIDAD[disponibilidad.tipo]}>
          {disponibilidad.texto}
        </StatusBadge>
      </span>
      <span className="product-card__body">
        <small className="product-card__category">{producto.categoria}</small>
        <strong>{producto.nombre}</strong>
        <small className="product-card__store">{producto.aliado}</small>
        <span className="product-card__price">{formatoPrecio(producto.precio)}</span>
      </span>
    </Link>
  );
}

export function CatalogoTienda() {
  const { pagina, leer, cambiar, limpiar, hrefDe, resultadosRef } = useFiltrosUrl();
  const categoriaId = leer('categoriaId');
  const nombre = leer('nombre');
  const orden = (OPCIONES_ORDEN.find((o) => o.valor === leer('orden'))?.valor ??
    'nombre') as OrdenProductos;

  const [categorias, setCategorias] = useState<CategoriaProducto[]>([]);
  const [texto, setTexto] = useState(nombre);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    api<CategoriaProducto[]>('/productos/categorias')
      .then(setCategorias)
      .catch(() => setCategorias([]));
  }, []);

  // Si la URL cambia (atrás/adelante, limpiar filtros), el campo de búsqueda la sigue.
  useEffect(() => setTexto(nombre), [nombre]);

  // La búsqueda se aplica sola al dejar de escribir.
  useEffect(() => {
    const limpio = texto.trim();
    if (limpio === nombre) return;
    const espera = setTimeout(() => cambiar({ nombre: limpio }), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(espera);
  }, [texto, nombre, cambiar]);

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    const query = new URLSearchParams({ orden });
    if (categoriaId) query.set('categoriaId', categoriaId);
    if (nombre) query.set('nombre', nombre);
    try {
      setEstado({
        tipo: 'listo',
        productos: await api<ProductoCatalogo[]>(`/productos?${query.toString()}`),
      });
    } catch (causa) {
      setEstado({
        tipo: 'error',
        mensaje:
          causa instanceof ApiError && causa.status === 400
            ? causa.message
            : 'No pudimos cargar los productos. Inténtalo de nuevo.',
      });
    }
  }, [categoriaId, nombre, orden]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hayFiltros = Boolean(categoriaId || nombre);
  const categoriaActiva = categorias.find((c) => String(c.id) === categoriaId);
  const resultado = estado.tipo === 'listo' ? paginar(estado.productos, pagina, POR_PAGINA) : null;

  return (
    <section aria-labelledby="productos-titulo" className="catalog-results" id="productos">
      <div className="home-section-heading">
        <div>
          <span className="eyebrow eyebrow--dark">UN MUNDO POR DESCUBRIR</span>
          <h2 id="productos-titulo">¿Qué le hace falta hoy?</h2>
        </div>
      </div>

      <div className="services-filters">
        <div className="catalog-toolbar">
          <div className="field services-filters__search">
            <span>Buscar</span>
            <label className="catalog-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label="Buscar productos por nombre"
                onChange={(evento) => setTexto(evento.target.value)}
                placeholder="Busca por nombre: alimento, arena, juguete…"
                type="search"
                value={texto}
              />
            </label>
          </div>
          <label className="field catalog-toolbar__sort">
            <span>Ordenar por</span>
            <select
              className="control"
              onChange={(evento) => cambiar({ orden: evento.target.value })}
              value={orden}
            >
              {OPCIONES_ORDEN.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.texto}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav
          aria-label="Categorías de productos"
          className="search-result-tags services-filters__modes"
        >
          <span aria-hidden="true" className="services-filters__label">
            Categoría
          </span>
          <button
            aria-pressed={!categoriaId}
            className={!categoriaId ? 'is-active' : ''}
            onClick={() => cambiar({ categoriaId: '' })}
            type="button"
          >
            Todas
          </button>
          {categorias.map((categoria) => {
            const activa = String(categoria.id) === categoriaId;
            return (
              <button
                aria-pressed={activa}
                className={activa ? 'is-active' : ''}
                key={categoria.id}
                onClick={() => cambiar({ categoriaId: String(categoria.id) })}
                type="button"
              >
                {categoria.nombre}
              </button>
            );
          })}
        </nav>
      </div>

      <section
        aria-busy={estado.tipo === 'cargando'}
        aria-label="Resultados"
        className="catalog-results__list"
        ref={resultadosRef}
      >
        {estado.tipo === 'cargando' && (
          <div className="product-grid" aria-label="Cargando productos">
            {Array.from({ length: 8 }, (_, i) => (
              <span className="skeleton product-card-skeleton" key={i} />
            ))}
          </div>
        )}

        {estado.tipo === 'error' && (
          <AlertBox tone="error" title="No se pudo cargar la tienda">
            {estado.mensaje}{' '}
            <VetoButton onClick={() => void cargar()} variant="secondary">
              Reintentar
            </VetoButton>
          </AlertBox>
        )}

        {resultado && resultado.total === 0 && (
          <div className="empty-state catalog-empty">
            <span className="empty-state__illustration" aria-hidden="true">
              ⌕
            </span>
            <h3>{hayFiltros ? 'No encontramos productos' : 'La tienda aún no tiene productos'}</h3>
            <p>
              {hayFiltros
                ? `Nada coincide${nombre ? ` con “${nombre}”` : ''}${
                    categoriaActiva ? ` en ${categoriaActiva.nombre}` : ''
                  }. Prueba con otra palabra o categoría.`
                : 'Vuelve pronto: las tiendas aliadas están cargando su catálogo.'}
            </p>
            {hayFiltros && (
              <VetoButton onClick={limpiar} variant="secondary">
                Limpiar filtros
              </VetoButton>
            )}
          </div>
        )}

        {resultado && resultado.total > 0 && (
          <>
            <p className="catalog-results__count" role="status">
              Mostrando {resultado.desde}–{resultado.hasta} de {resultado.total}{' '}
              {resultado.total === 1 ? 'producto' : 'productos'}
            </p>
            <div className="product-grid">
              {resultado.items.map((producto) => (
                <TarjetaProducto key={producto.id} producto={producto} />
              ))}
            </div>
            <Paginacion
              etiqueta="productos"
              hrefDe={hrefDe}
              pagina={resultado.pagina}
              totalPaginas={resultado.totalPaginas}
            />
          </>
        )}
      </section>
    </section>
  );
}
