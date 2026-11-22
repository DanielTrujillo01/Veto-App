'use client';

/**
 * Directorio de clínicas aliadas.
 *
 * Cada tarjeta muestra lo que sirve para elegir: ciudad y número de sedes, especies que atiende y
 * cuántos veterinarios y servicios tiene. La lista (GET /aliados/clinicas) solo trae nombre y
 * descripción, así que el resto se arma con los endpoints públicos de cada clínica (sedes,
 * especies, equipo y servicios); si uno falla, la tarjeta se muestra sin ese dato.
 *
 * Se filtra por especie y ciudad y se pagina de a 6, con filtros y página en la URL.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Paginacion } from '@/components/Paginacion';
import { iniciales, PortadaCapas } from '@/components/PortadaCapas';
import { IconoFlecha, IconoUbicacion, IconoVerificado } from '@/components/ui/iconos';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { paginar } from '@/lib/paginacion';
import { useFiltrosUrl } from '@/lib/useFiltrosUrl';
import { useBusquedaUrl } from '@/lib/useBusquedaUrl';
import { coincideBusqueda } from '@/lib/busqueda';
import { CampoBusqueda } from '@/components/CampoBusqueda';

const POR_PAGINA = 8;

type Clinica = { id: string; nombre: string; descripcion: string | null };
type Ficha = Clinica & {
  ciudades: string[];
  sedes: number | null;
  especies: string[];
  veterinarios: number | null;
  servicios: number | null;
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

async function completar(clinica: Clinica): Promise<Ficha> {
  const [sedes, especies, equipo, servicios] = await Promise.allSettled([
    api<{ ciudad: string }[]>(`/aliados/${clinica.id}/sedes`),
    api<{ nombre: string }[]>(`/aliados/${clinica.id}/especies`),
    api<{ veterinarios: unknown[] }>(`/aliados/${clinica.id}/veterinarios`),
    api<unknown[]>(`/aliados/${clinica.id}/servicios`),
  ]);
  const listaSedes = sedes.status === 'fulfilled' ? sedes.value : null;
  return {
    ...clinica,
    sedes: listaSedes?.length ?? null,
    ciudades: [...new Set((listaSedes ?? []).map((s) => s.ciudad.trim()).filter(Boolean))],
    especies: especies.status === 'fulfilled' ? especies.value.map((e) => e.nombre) : [],
    veterinarios: equipo.status === 'fulfilled' ? equipo.value.veterinarios.length : null,
    servicios: servicios.status === 'fulfilled' ? servicios.value.length : null,
  };
}

function TarjetaClinica({ clinica }: { clinica: Ficha }) {
  return (
    <Link className="clinic-tile" href={`/clinicas/${clinica.id}`}>
      <PortadaCapas />
      <span aria-hidden="true" className="clinic-tile__mono">
        {iniciales(clinica.nombre) || '✚'}
      </span>
      <span className="clinic-tile__body">
        <strong className="clinic-tile__name">
          {clinica.nombre}
          <span className="clinic-tile__check" title="Aliado verificado por Veto">
            <IconoVerificado tamano={17} />
            <span className="sr-only">Aliado verificado</span>
          </span>
        </strong>
        <small className="clinic-tile__meta">
          <IconoUbicacion tamano={15} />
          {clinica.ciudades.length ? clinica.ciudades.join(', ') : 'Ciudad por confirmar'}
          {clinica.sedes ? ` · ${plural(clinica.sedes, 'sede', 'sedes')}` : ''}
        </small>
        {clinica.especies.length > 0 ? (
          <span className="detail-sheet__chips clinic-tile__chips">
            {clinica.especies.slice(0, 3).map((especie) => (
              <span key={especie}>{especie}</span>
            ))}
            {clinica.especies.length > 3 && <span>+{clinica.especies.length - 3}</span>}
          </span>
        ) : (
          <small className="clinic-tile__desc">
            {clinica.descripcion || 'Pronto publicará las especies que atiende.'}
          </small>
        )}
        <span className="clinic-tile__stats">
          <span>
            <b>{clinica.veterinarios ?? '–'}</b>{' '}
            {clinica.veterinarios === 1 ? 'veterinario' : 'veterinarios'}
          </span>
          <span>
            <b>{clinica.servicios ?? '–'}</b> {clinica.servicios === 1 ? 'servicio' : 'servicios'}
          </span>
        </span>
        <span className="clinic-tile__go">
          Conocer clínica
          <span className="clinic-tile__arrow">
            <IconoFlecha tamano={16} />
          </span>
        </span>
      </span>
    </Link>
  );
}

type Estado =
  { tipo: 'cargando' } | { tipo: 'error'; mensaje: string } | { tipo: 'listo'; clinicas: Ficha[] };

export function DirectorioClinicas() {
  const { pagina, leer, cambiar, limpiar, hrefDe, resultadosRef } = useFiltrosUrl();
  const especie = leer('especie');
  const ciudad = leer('ciudad');
  const nombre = leer('nombre');
  const [texto, setTexto] = useBusquedaUrl(nombre, cambiar);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const clinicas = await api<Clinica[]>('/aliados/clinicas');
      setEstado({ tipo: 'listo', clinicas: await Promise.all(clinicas.map(completar)) });
    } catch (causa) {
      setEstado({
        tipo: 'error',
        mensaje:
          causa instanceof ApiError ? causa.message : 'No pudimos cargar las clínicas disponibles.',
      });
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const todas = useMemo(() => (estado.tipo === 'listo' ? estado.clinicas : []), [estado]);
  const opcionesEspecie = useMemo(
    () => [...new Set(todas.flatMap((c) => c.especies))].sort((a, b) => a.localeCompare(b, 'es')),
    [todas],
  );
  const opcionesCiudad = useMemo(
    () => [...new Set(todas.flatMap((c) => c.ciudades))].sort((a, b) => a.localeCompare(b, 'es')),
    [todas],
  );
  const filtradas = todas.filter(
    (c) =>
      (!especie || c.especies.includes(especie)) &&
      (!ciudad || c.ciudades.includes(ciudad)) &&
      coincideBusqueda(nombre, c.nombre),
  );
  const resultado = paginar(filtradas, pagina, POR_PAGINA);
  const hayFiltros = Boolean(especie || ciudad || nombre);

  return (
    <section
      aria-labelledby="clinicas-titulo"
      className="catalog-results clinic-directory"
      id="clinicas"
    >
      <div className="home-section-heading">
        <div>
          <span className="eyebrow eyebrow--dark">CLÍNICAS ALIADAS</span>
          <h2 id="clinicas-titulo">Conoce a nuestros aliados</h2>
        </div>
      </div>
      <div className="services-filters">
        <div className="catalog-toolbar">
          <CampoBusqueda
            ancho={opcionesCiudad.length > 1 ? 2 : 3}
            etiqueta="Buscar clínicas por nombre"
            onCambiar={setTexto}
            placeholder="Busca por nombre de la clínica…"
            valor={texto}
          />
          {opcionesCiudad.length > 1 && (
            <label className="field">
              <span>Ciudad</span>
              <select
                className="control"
                onChange={(evento) => cambiar({ ciudad: evento.target.value })}
                value={ciudad}
              >
                <option value="">Todas las ciudades</option>
                {opcionesCiudad.map((opcion) => (
                  <option key={opcion} value={opcion}>
                    {opcion}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {opcionesEspecie.length > 0 && (
          <nav
            aria-label="Filtrar por especie"
            className="search-result-tags services-filters__modes"
          >
            <span aria-hidden="true" className="services-filters__label">
              Especie
            </span>
            <button
              aria-pressed={!especie}
              className={!especie ? 'is-active' : ''}
              onClick={() => cambiar({ especie: '' })}
              type="button"
            >
              Todas
            </button>
            {opcionesEspecie.map((opcion) => (
              <button
                aria-pressed={especie === opcion}
                className={especie === opcion ? 'is-active' : ''}
                key={opcion}
                onClick={() => cambiar({ especie: opcion })}
                type="button"
              >
                {opcion}
              </button>
            ))}
            {hayFiltros && (
              <button className="search-result-tags__clear" onClick={limpiar} type="button">
                Quitar filtros ×
              </button>
            )}
          </nav>
        )}
      </div>

      <section aria-busy={estado.tipo === 'cargando'} aria-label="Clínicas" ref={resultadosRef}>
        {estado.tipo === 'cargando' && (
          <div className="clinic-grid" aria-label="Cargando clínicas">
            {Array.from({ length: POR_PAGINA }, (_, i) => (
              <span className="skeleton product-card-skeleton" key={i} />
            ))}
          </div>
        )}
        {estado.tipo === 'error' && (
          <AlertBox tone="error" title="No se pudo cargar el directorio">
            {estado.mensaje}{' '}
            <VetoButton onClick={() => void cargar()} variant="secondary">
              Reintentar
            </VetoButton>
          </AlertBox>
        )}
        {estado.tipo === 'listo' && resultado.total === 0 && (
          <div className="empty-state catalog-empty">
            <span className="empty-state__illustration" aria-hidden="true">
              ⌖
            </span>
            <h2>
              {hayFiltros
                ? `Ninguna clínica coincide${nombre ? ` con “${nombre}”` : ''}`
                : 'Estamos sumando clínicas a Veto'}
            </h2>
            <p>
              {hayFiltros
                ? 'Revisa el nombre o prueba con otra especie o ciudad.'
                : 'Cuando haya clínicas disponibles en tu zona, las encontrarás aquí.'}
            </p>
            {hayFiltros && (
              <VetoButton onClick={limpiar} variant="secondary">
                Quitar filtros
              </VetoButton>
            )}
          </div>
        )}
        {estado.tipo === 'listo' && resultado.total > 0 && (
          <div className="catalog-results__list">
            <div className="clinic-grid">
              {resultado.items.map((clinica) => (
                <TarjetaClinica clinica={clinica} key={clinica.id} />
              ))}
            </div>
            <div className="detail-panel__foot">
              <p className="catalog-results__count">
                {resultado.desde}–{resultado.hasta} de{' '}
                {plural(resultado.total, 'clínica', 'clínicas')}
              </p>
              <Paginacion
                etiqueta="clínicas"
                hrefDe={hrefDe}
                pagina={resultado.pagina}
                totalPaginas={resultado.totalPaginas}
              />
            </div>
          </div>
        )}
      </section>
    </section>
  );
}
