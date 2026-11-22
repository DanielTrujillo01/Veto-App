'use client';

/**
 * HU-026 · Filtrar servicios por especie, tipo de servicio y modalidad (combinables).
 * HU-027 · Ordenar por nombre o por precio ("Desde $X").
 *
 * API: GET /servicios?especieId&tipoServicioId&modalidad&orden, GET /servicios/tipos,
 * GET /mascotas/especies y GET /aliados/clinicas (solo para mostrar el nombre de la clínica).
 * La API devuelve la lista completa; aquí se pagina (8 por página) con la página en la URL.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MODALIDADES_SERVICIO,
  type ModalidadServicio,
  type OrdenServicios,
  type ServicioConReglas,
} from '@veto/shared';
import { Paginacion } from '@/components/Paginacion';
import { iniciales } from '@/components/PortadaCapas';
import {
  IconoCasa,
  IconoReloj,
  IconoTipoServicio,
  IconoUbicacion,
  IconoVerificado,
} from '@/components/ui/iconos';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { formatoPrecio } from '@/lib/formato';
import { paginar } from '@/lib/paginacion';
import { NOMBRE_MODALIDAD } from '@/lib/servicios';
import { useFiltrosUrl } from '@/lib/useFiltrosUrl';
import { useBusquedaUrl } from '@/lib/useBusquedaUrl';
import { coincideBusqueda } from '@/lib/busqueda';
import { CampoBusqueda } from '@/components/CampoBusqueda';

const POR_PAGINA = 6;

const OPCIONES_ORDEN: { valor: OrdenServicios; texto: string }[] = [
  { valor: 'nombre', texto: 'Nombre (A–Z)' },
  { valor: 'precio_asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio_desc', texto: 'Precio: mayor a menor' },
];

type Opcion = { id: number; nombre: string };
type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; servicios: ServicioConReglas[] };

export function CatalogoServicios() {
  const { pagina, leer, cambiar, limpiar, hrefDe, resultadosRef } = useFiltrosUrl();
  const especieId = leer('especieId');
  const tipoServicioId = leer('tipoServicioId');
  const modalidadUrl = leer('modalidad');
  const modalidad = MODALIDADES_SERVICIO.includes(modalidadUrl as ModalidadServicio)
    ? (modalidadUrl as ModalidadServicio)
    : '';
  const orden = OPCIONES_ORDEN.find((o) => o.valor === leer('orden'))?.valor ?? 'nombre';
  const nombre = leer('nombre');
  const [texto, setTexto] = useBusquedaUrl(nombre, cambiar);

  const [especies, setEspecies] = useState<Opcion[]>([]);
  const [tipos, setTipos] = useState<Opcion[]>([]);
  const [clinicas, setClinicas] = useState<Map<string, string>>(new Map());
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    void api<Opcion[]>('/mascotas/especies').then(setEspecies, () => setEspecies([]));
    void api<Opcion[]>('/servicios/tipos').then(setTipos, () => setTipos([]));
    void api<{ id: string; nombre: string }[]>('/aliados/clinicas').then(
      (lista) => setClinicas(new Map(lista.map((c) => [c.id, c.nombre]))),
      () => setClinicas(new Map()),
    );
  }, []);

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    const query = new URLSearchParams({ orden });
    if (especieId) query.set('especieId', especieId);
    if (tipoServicioId) query.set('tipoServicioId', tipoServicioId);
    if (modalidad) query.set('modalidad', modalidad);
    try {
      setEstado({
        tipo: 'listo',
        servicios: await api<ServicioConReglas[]>(`/servicios?${query.toString()}`),
      });
    } catch (causa) {
      setEstado({
        tipo: 'error',
        mensaje:
          causa instanceof ApiError && causa.status === 400
            ? causa.message
            : 'No pudimos cargar los servicios. Inténtalo de nuevo.',
      });
    }
  }, [especieId, tipoServicioId, modalidad, orden]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hayFiltros = Boolean(especieId || tipoServicioId || modalidad || nombre);
  // HU-025: la palabra clave busca en el nombre del servicio, y también en su tipo y en el
  // nombre de la clínica que lo ofrece. Se combina con los filtros y el orden de la API.
  const resultado = useMemo(() => {
    if (estado.tipo !== 'listo') return null;
    const encontrados = estado.servicios.filter((servicio) =>
      coincideBusqueda(
        nombre,
        servicio.nombre,
        servicio.tipoServicio,
        clinicas.get(servicio.aliadoId),
      ),
    );
    return paginar(encontrados, pagina, POR_PAGINA);
  }, [estado, pagina, nombre, clinicas]);

  return (
    <section aria-labelledby="servicios-encabezado" className="catalog-results">
      <div className="home-section-heading">
        <div>
          <span className="eyebrow eyebrow--dark">ENCUENTRA SU CUIDADO</span>
          <h2 id="servicios-encabezado">¿Qué servicio necesita?</h2>
        </div>
      </div>

      <div className="services-filters">
        <div className="catalog-toolbar">
          <CampoBusqueda
            ancho={3}
            etiqueta="Buscar servicios por nombre"
            onCambiar={setTexto}
            placeholder="Busca por nombre: consulta, baño, vacuna… o por clínica"
            valor={texto}
          />
          <label className="field">
            <span>Especie</span>
            <select
              className="control"
              onChange={(evento) => cambiar({ especieId: evento.target.value })}
              value={especieId}
            >
              <option value="">Todas las especies</option>
              {especies.map((especie) => (
                <option key={especie.id} value={especie.id}>
                  {especie.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tipo de servicio</span>
            <select
              className="control"
              onChange={(evento) => cambiar({ tipoServicioId: evento.target.value })}
              value={tipoServicioId}
            >
              <option value="">Todos los tipos</option>
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
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
          aria-label="Modalidad de atención"
          className="search-result-tags services-filters__modes"
        >
          <span aria-hidden="true" className="services-filters__label">
            Modalidad
          </span>
          <button
            aria-pressed={!modalidad}
            className={!modalidad ? 'is-active' : ''}
            onClick={() => cambiar({ modalidad: '' })}
            type="button"
          >
            Todas las modalidades
          </button>
          {MODALIDADES_SERVICIO.map((valor) => (
            <button
              aria-pressed={modalidad === valor}
              className={modalidad === valor ? 'is-active' : ''}
              key={valor}
              onClick={() => cambiar({ modalidad: valor })}
              type="button"
            >
              {NOMBRE_MODALIDAD[valor]}
            </button>
          ))}
          {hayFiltros && (
            <button className="search-result-tags__clear" onClick={limpiar} type="button">
              Quitar filtros ×
            </button>
          )}
        </nav>
      </div>

      <section
        aria-busy={estado.tipo === 'cargando'}
        aria-labelledby="servicios-titulo"
        className="catalog-results__list"
        ref={resultadosRef}
      >
        <h2 className="sr-only" id="servicios-titulo">
          Servicios disponibles
        </h2>
        {estado.tipo === 'cargando' && (
          <div className="clinic-grid service-grid" aria-label="Cargando servicios">
            {Array.from({ length: 3 }, (_, i) => (
              <span className="skeleton product-card-skeleton" key={i} />
            ))}
          </div>
        )}

        {estado.tipo === 'error' && (
          <AlertBox tone="error" title="No se pudieron cargar los servicios">
            {estado.mensaje}{' '}
            <VetoButton onClick={() => void cargar()} variant="secondary">
              Reintentar
            </VetoButton>
          </AlertBox>
        )}

        {resultado && resultado.total === 0 && (
          <div className="empty-state catalog-empty">
            <span className="empty-state__illustration" aria-hidden="true">
              ✚
            </span>
            <h3>
              {hayFiltros
                ? `Ningún servicio coincide${nombre ? ` con “${nombre}”` : ''}`
                : 'Aún no hay servicios'}
            </h3>
            <p>
              {hayFiltros
                ? 'Revisa la palabra o quita algún filtro para ver más opciones.'
                : 'Los aliados de Veto están publicando sus servicios. Vuelve pronto.'}
            </p>
            {hayFiltros && (
              <VetoButton onClick={limpiar} variant="secondary">
                Quitar filtros
              </VetoButton>
            )}
          </div>
        )}

        {resultado && resultado.total > 0 && (
          <>
            <p className="catalog-results__count" role="status">
              Mostrando {resultado.desde}–{resultado.hasta} de {resultado.total}{' '}
              {resultado.total === 1 ? 'servicio' : 'servicios'}
            </p>
            <div className="clinic-grid service-grid">
              {resultado.items.map((servicio) => {
                const clinica = clinicas.get(servicio.aliadoId);
                const varia = servicio.reglasPrecio.length > 0;
                const domicilio = servicio.modalidad === 'A_DOMICILIO';
                return (
                  <article className="offer-card" key={servicio.id}>
                    <span className="offer-card__head">
                      <span aria-hidden="true" className="offer-card__icon">
                        <IconoTipoServicio tamano={24} tipo={servicio.tipoServicio} />
                      </span>
                      <span className="offer-card__type">{servicio.tipoServicio}</span>
                    </span>
                    {/* El título es el enlace al detalle y cubre toda la tarjeta. */}
                    <Link className="offer-card__title" href={`/servicios/${servicio.id}`}>
                      {servicio.nombre}
                    </Link>
                    <small className="offer-card__provider">
                      <span aria-hidden="true" className="offer-card__mini">
                        {clinica ? iniciales(clinica) || '✚' : '✚'}
                      </span>
                      {clinica ? (
                        <>
                          por {clinica}
                          <span className="clinic-tile__check" title="Aliado verificado por Veto">
                            <IconoVerificado tamano={14} />
                            <span className="sr-only">Aliado verificado</span>
                          </span>
                        </>
                      ) : (
                        'por un veterinario independiente'
                      )}
                    </small>
                    <span className="offer-card__facts">
                      <span>
                        <IconoReloj tamano={16} /> {servicio.duracionMin} min
                      </span>
                      <span>
                        {domicilio ? <IconoCasa tamano={16} /> : <IconoUbicacion tamano={16} />}{' '}
                        {NOMBRE_MODALIDAD[servicio.modalidad]}
                      </span>
                    </span>
                    <small className="offer-card__desc">
                      {servicio.descripcion || 'Atención profesional para tu mascota.'}
                    </small>
                    <span className="offer-card__price">
                      <span>
                        <small>{varia ? 'Desde' : 'Precio'}</small>
                        <b>{formatoPrecio(servicio.precioDesde)}</b>
                      </span>
                      <Link
                        className="veto-button veto-button--primary offer-card__book"
                        href={`/reservar/${servicio.id}`}
                      >
                        Reservar
                      </Link>
                    </span>
                  </article>
                );
              })}
            </div>
            <Paginacion
              etiqueta="servicios"
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
