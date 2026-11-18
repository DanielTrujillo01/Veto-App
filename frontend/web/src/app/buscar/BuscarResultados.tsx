'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { CategoriaBusqueda, RespuestaBusquedaGeneral } from '@veto/shared';
import { AlertBox } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';

const nombresCategoria: Record<CategoriaBusqueda, string> = {
  CLINICA: 'Clínicas veterinarias',
  VET_INDEPENDIENTE: 'Veterinarios independientes',
  TIENDA: 'Tiendas para mascotas',
  VETERINARIO: 'Veterinarios',
  PRODUCTO: 'Productos',
  SERVICIO: 'Servicios',
};
type FiltroCategoria = CategoriaBusqueda | 'TODAS';
const ESPERA_BUSQUEDA_MS = 300;

function enlaceResultado(categoria: CategoriaBusqueda, id: string) {
  switch (categoria) {
    case 'CLINICA':
      return `/clinicas/${id}`;
    case 'PRODUCTO':
      return `/tienda/productos/${id}`;
    case 'TIENDA':
      return '/tienda';
    case 'VET_INDEPENDIENTE':
    case 'VETERINARIO':
      return '/veterinarios';
    case 'SERVICIO':
      return '/clinicas';
  }
}

export default function BuscarResultados({ q, ubicacion }: { q: string; ubicacion: string }) {
  const router = useRouter();
  const [termino, setTermino] = useState(q);
  const [resultados, setResultados] = useState<RespuestaBusquedaGeneral | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [requiereSesion, setRequiereSesion] = useState(false);
  const [requiereTutor, setRequiereTutor] = useState(false);
  const [categoriaActiva, setCategoriaActiva] = useState<FiltroCategoria>('TODAS');

  useEffect(() => setTermino(q), [q]);

  useEffect(() => {
    let vigente = true;
    const consulta = termino.trim();
    setCategoriaActiva('TODAS');
    setResultados(null);
    setError('');
    setRequiereSesion(false);
    setRequiereTutor(false);
    if (!consulta) {
      setCargando(false);
      return () => {
        vigente = false;
      };
    }

    setCargando(true);
    const temporizador = window.setTimeout(() => {
      void api<RespuestaBusquedaGeneral>(`/busqueda?nombre=${encodeURIComponent(consulta)}`)
        .then((respuesta) => {
          if (vigente) setResultados(respuesta);
        })
        .catch((causa: unknown) => {
          if (!vigente) return;
          if (causa instanceof ApiError && causa.status === 401) {
            setRequiereSesion(true);
            return;
          }
          if (causa instanceof ApiError && causa.status === 403) {
            setRequiereTutor(true);
            return;
          }
          setError(
            causa instanceof ApiError
              ? causa.message
              : 'No pudimos completar la búsqueda. Inténtalo de nuevo.',
          );
        })
        .finally(() => {
          if (vigente) setCargando(false);
        });
    }, ESPERA_BUSQUEDA_MS);

    return () => {
      vigente = false;
      window.clearTimeout(temporizador);
    };
  }, [termino]);

  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parametros = new URLSearchParams();
    if (termino.trim()) parametros.set('q', termino.trim());
    if (ubicacion) parametros.set('ubicacion', ubicacion);
    router.push(`/buscar${parametros.size ? `?${parametros.toString()}` : ''}`);
  }

  const grupos = resultados?.resultadosPorCategoria ?? [];
  const total = grupos.reduce((suma, grupo) => suma + grupo.resultados.length, 0);
  const gruposVisibles =
    categoriaActiva === 'TODAS'
      ? grupos
      : grupos.filter((grupo) => grupo.categoria === categoriaActiva);

  return (
    <div className="search-page">
      <header className="search-page__heading">
        <span className="eyebrow eyebrow--dark">ENCUENTRA EL CUIDADO IDEAL</span>
        <h1>Tu próxima búsqueda empieza aquí.</h1>
        <p>
          Escribe una parte del nombre para encontrar aliados, profesionales, productos y servicios.
        </p>
        <form className="catalog-search search-page__form" onSubmit={buscar} role="search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Servicio, veterinario o clínica"
            onChange={(event) => setTermino(event.target.value)}
            placeholder="Ej. Norte, consulta o alimento"
            value={termino}
          />
          <input aria-label="Ubicación" defaultValue={ubicacion} readOnly />
          <button
            className="veto-button veto-button--primary"
            disabled={!termino.trim()}
            type="submit"
          >
            Buscar
          </button>
        </form>
      </header>

      <section aria-live="polite" className="search-result-panel">
        <span aria-hidden="true" className="search-result-panel__icon">
          ⌕
        </span>
        <div>
          <span className="eyebrow eyebrow--dark">RESULTADOS</span>
          <h2>
            {termino.trim() ? `Resultados para “${termino.trim()}”` : '¿Qué necesita tu mascota?'}
          </h2>
          {!termino.trim() && (
            <p>
              Busca por una palabra o fragmento del nombre. La búsqueda requiere una sesión de
              tutor.
            </p>
          )}
          {cargando && <p role="status">Buscando coincidencias…</p>}
          {error && (
            <AlertBox tone="error" title="No se pudo realizar la búsqueda">
              {error}
            </AlertBox>
          )}
          {requiereSesion && (
            <AlertBox tone="info" title="Inicia sesión para buscar">
              La búsqueda está disponible para tutores.{' '}
              <Link href="/ingresar">Ingresar a Veto</Link>
            </AlertBox>
          )}
          {requiereTutor && (
            <AlertBox tone="warning" title="Búsqueda disponible para tutores">
              Ingresa con una cuenta de tutor para consultar aliados, productos y servicios.
            </AlertBox>
          )}
          {!cargando && termino.trim() && resultados && total === 0 && (
            <p>
              No encontramos coincidencias. Prueba con otra palabra o con una parte más corta del
              nombre.
            </p>
          )}
          {!cargando && resultados && total > 0 && (
            <p>
              Encontramos {total} coincidencias en {grupos.length} categorías.
            </p>
          )}
        </div>
        {!termino.trim() && (
          <Link className="veto-button veto-button--primary" href="/clinicas">
            Ver clínicas
          </Link>
        )}
      </section>

      {total > 0 && (
        <nav aria-label="Filtrar resultados por categoría" className="search-result-tags">
          <button
            aria-pressed={categoriaActiva === 'TODAS'}
            className={categoriaActiva === 'TODAS' ? 'is-active' : ''}
            onClick={() => setCategoriaActiva('TODAS')}
            type="button"
          >
            Todos <span>{total}</span>
          </button>
          {grupos.map((grupo) => (
            <button
              aria-pressed={categoriaActiva === grupo.categoria}
              className={categoriaActiva === grupo.categoria ? 'is-active' : ''}
              key={grupo.categoria}
              onClick={() => setCategoriaActiva(grupo.categoria)}
              type="button"
            >
              {nombresCategoria[grupo.categoria]} <span>{grupo.resultados.length}</span>
            </button>
          ))}
        </nav>
      )}

      {gruposVisibles.map((grupo) => (
        <section className="search-results-category" key={grupo.categoria}>
          <h2>{nombresCategoria[grupo.categoria]}</h2>
          <ul>
            {grupo.resultados.map((resultado) => (
              <li key={resultado.id}>
                <Link href={enlaceResultado(grupo.categoria, resultado.id)}>
                  {resultado.nombre}
                  <span aria-hidden="true"> →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="search-suggestions">
        <span>También puedes explorar</span>
        <div>
          <Link href="/clinicas">Clínicas veterinarias</Link>
          <Link href="/veterinarios">Veterinarios independientes</Link>
          <Link href="/tienda">Tienda para mascotas</Link>
          <Link href="/adopcion">Adopción responsable</Link>
        </div>
      </section>
    </div>
  );
}
