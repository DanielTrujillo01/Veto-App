'use client';

/**
 * HU-087 · Catálogo de mascotas en adopción en tarjetas (foto, nombre, especie, edad, sexo y
 *          ubicación) sin ningún dato de la fundación.
 * HU-088 · Filtros combinables por tipo de mascota, edad, tamaño y ubicación.
 *
 * API: GET /adopciones/catalogo?especieId&edadMinMeses&edadMaxMeses&tamano&ubicacion (público;
 * la API solo devuelve publicaciones DISPONIBLES de fundaciones autorizadas y ya anonimizadas).
 * La ubicación filtra por coincidencia exacta, así que se elige de la lista de ubicaciones que
 * existen. Se pagina en el navegador (9 por página) con la página en la URL.
 */

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TAMANOS_MASCOTA, type MascotaAdopcionPublica, type TamanoMascota } from '@veto/shared';
import { Paginacion } from '@/components/Paginacion';
import { IconoHuella, IconoUbicacion } from '@/components/ui/iconos';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { NOMBRE_SEXO, NOMBRE_TAMANO, RANGOS_EDAD, textoEdad } from '@/lib/adopcion';
import { api, ApiError } from '@/lib/api';
import { paginar } from '@/lib/paginacion';
import { useFiltrosUrl } from '@/lib/useFiltrosUrl';

const POR_PAGINA = 12;

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'listo'; mascotas: MascotaAdopcionPublica[] };

function TarjetaAdopcion({ mascota }: { mascota: MascotaAdopcionPublica }) {
  const [fotoFallida, setFotoFallida] = useState(false);
  const foto = mascota.fotos[0];
  return (
    <Link className="pet-tile" href={`/adopcion/${mascota.id}`}>
      <span className="pet-tile__photo">
        {foto && !fotoFallida ? (
          <img alt="" loading="lazy" onError={() => setFotoFallida(true)} src={foto} />
        ) : (
          <span aria-hidden="true" className="pet-tile__fallback">
            <IconoHuella tamano={40} />
          </span>
        )}
      </span>
      <strong className="pet-tile__name">{mascota.nombre}</strong>
      <small className="pet-tile__meta">
        {mascota.especie} · {textoEdad(mascota.edadMeses)} · {NOMBRE_SEXO[mascota.sexo]} ·{' '}
        {NOMBRE_TAMANO[mascota.tamano]}
      </small>
      <small className="pet-tile__place">
        <IconoUbicacion tamano={14} /> {mascota.ubicacion}
      </small>
    </Link>
  );
}

export function CatalogoAdopcion() {
  const { pagina, leer, cambiar, limpiar, hrefDe, resultadosRef } = useFiltrosUrl();
  const especieId = leer('especieId');
  const edad = RANGOS_EDAD.find((r) => r.id === leer('edad'));
  const tamanoUrl = leer('tamano');
  const tamano = TAMANOS_MASCOTA.includes(tamanoUrl as TamanoMascota)
    ? (tamanoUrl as TamanoMascota)
    : '';
  const ubicacion = leer('ubicacion');

  const [especies, setEspecies] = useState<{ id: number; nombre: string }[]>([]);
  const [ubicaciones, setUbicaciones] = useState<string[]>([]);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    void api<{ id: number; nombre: string }[]>('/mascotas/especies').then(setEspecies, () =>
      setEspecies([]),
    );
    void api<MascotaAdopcionPublica[]>('/adopciones/catalogo').then(
      (todas) =>
        setUbicaciones(
          [...new Set(todas.map((m) => m.ubicacion))].sort((a, b) => a.localeCompare(b, 'es')),
        ),
      () => setUbicaciones([]),
    );
  }, []);

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    const query = new URLSearchParams();
    if (especieId) query.set('especieId', especieId);
    if (edad) {
      query.set('edadMinMeses', String(edad.min));
      if (edad.max !== undefined) query.set('edadMaxMeses', String(edad.max));
    }
    if (tamano) query.set('tamano', tamano);
    if (ubicacion) query.set('ubicacion', ubicacion);
    try {
      const mascotas = await api<MascotaAdopcionPublica[]>(
        `/adopciones/catalogo${query.size ? `?${query.toString()}` : ''}`,
      );
      setEstado({ tipo: 'listo', mascotas });
    } catch (causa) {
      setEstado({
        tipo: 'error',
        mensaje:
          causa instanceof ApiError && causa.status === 400
            ? causa.message
            : 'No pudimos cargar las mascotas en adopción. Inténtalo de nuevo.',
      });
    }
  }, [especieId, edad, tamano, ubicacion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const hayFiltros = Boolean(especieId || edad || tamano || ubicacion);
  const resultado = useMemo(
    () => (estado.tipo === 'listo' ? paginar(estado.mascotas, pagina, POR_PAGINA) : null),
    [estado, pagina],
  );

  return (
    <section aria-labelledby="adopcion-titulo" className="catalog-results" id="mascotas">
      <div className="home-section-heading">
        <div>
          <span className="eyebrow eyebrow--dark">BUSCAN UN HOGAR</span>
          <h2 id="adopcion-titulo">Conoce a quienes te esperan</h2>
        </div>
      </div>

      <div className="services-filters">
        <div className="catalog-toolbar">
          <label className="field">
            <span>Tipo de mascota</span>
            <select
              className="control"
              onChange={(evento) => cambiar({ especieId: evento.target.value })}
              value={especieId}
            >
              <option value="">Todas</option>
              {especies.map((especie) => (
                <option key={especie.id} value={especie.id}>
                  {especie.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Edad</span>
            <select
              className="control"
              onChange={(evento) => cambiar({ edad: evento.target.value })}
              value={edad?.id ?? ''}
            >
              <option value="">Cualquier edad</option>
              {RANGOS_EDAD.map((rango) => (
                <option key={rango.id} value={rango.id}>
                  {rango.texto}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Ubicación</span>
            <select
              className="control"
              onChange={(evento) => cambiar({ ubicacion: evento.target.value })}
              value={ubicacion}
            >
              <option value="">Todas las ubicaciones</option>
              {ubicacion && !ubicaciones.includes(ubicacion) && (
                <option value={ubicacion}>{ubicacion}</option>
              )}
              {ubicaciones.map((lugar) => (
                <option key={lugar} value={lugar}>
                  {lugar}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav aria-label="Tamaño" className="search-result-tags services-filters__modes">
          <span aria-hidden="true" className="services-filters__label">
            Tamaño
          </span>
          <button
            aria-pressed={!tamano}
            className={!tamano ? 'is-active' : ''}
            onClick={() => cambiar({ tamano: '' })}
            type="button"
          >
            Todos los tamaños
          </button>
          {TAMANOS_MASCOTA.map((valor) => (
            <button
              aria-pressed={tamano === valor}
              className={tamano === valor ? 'is-active' : ''}
              key={valor}
              onClick={() => cambiar({ tamano: valor })}
              type="button"
            >
              {NOMBRE_TAMANO[valor]}
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
        aria-label="Mascotas en adopción"
        className="catalog-results__list"
        ref={resultadosRef}
      >
        {estado.tipo === 'cargando' && (
          <div className="pet-grid" aria-label="Cargando mascotas">
            {Array.from({ length: 8 }, (_, i) => (
              <span className="skeleton pet-tile-skeleton" key={i} />
            ))}
          </div>
        )}

        {estado.tipo === 'error' && (
          <AlertBox tone="error" title="No se pudo cargar el catálogo">
            {estado.mensaje}{' '}
            <VetoButton onClick={() => void cargar()} variant="secondary">
              Reintentar
            </VetoButton>
          </AlertBox>
        )}

        {resultado && resultado.total === 0 && (
          <div className="empty-state catalog-empty">
            <span className="empty-state__illustration" aria-hidden="true">
              ♡
            </span>
            <h3>
              {hayFiltros
                ? 'Ninguna mascota coincide con esos filtros'
                : 'Por ahora no hay mascotas en adopción'}
            </h3>
            <p>
              {hayFiltros
                ? 'Quita algún filtro para ver más compañeros.'
                : 'Las fundaciones publican nuevas mascotas con frecuencia. Vuelve pronto.'}
            </p>
            {hayFiltros && (
              <VetoButton onClick={limpiar} variant="secondary">
                Restablecer búsqueda
              </VetoButton>
            )}
          </div>
        )}

        {resultado && resultado.total > 0 && (
          <>
            <p className="catalog-results__count" role="status">
              Mostrando {resultado.desde}–{resultado.hasta} de {resultado.total}{' '}
              {resultado.total === 1 ? 'mascota' : 'mascotas'}
            </p>
            <div className="pet-grid">
              {resultado.items.map((mascota) => (
                <TarjetaAdopcion key={mascota.id} mascota={mascota} />
              ))}
            </div>
            <Paginacion
              etiqueta="mascotas en adopción"
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
