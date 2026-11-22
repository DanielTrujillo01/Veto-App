'use client';

/**
 * Marco común de los paneles (aliado, veterinario y equipo Veto) con la ficha de marca:
 * barra lateral burgundy con el logo centrado, la ficha de quien entra, el menú por grupos y
 * los enlaces de cuenta; barra superior con el título y las acciones. Estilos `.partner-*`.
 */

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { iniciales } from '@/components/PortadaCapas';
import { notificarCambioSesion } from '@/lib/session';

export type ItemMenuPanel = {
  id: string;
  etiqueta: string;
  icono: ReactNode;
  activo: boolean;
  alHacerClic: () => void;
};

export type GrupoMenuPanel = { nombre: string; items: ItemMenuPanel[] };

export function PanelShell({
  leyenda,
  titulo,
  ficha,
  grupos,
  acciones,
  perfilPublico,
  children,
}: {
  /** Texto pequeño sobre el título ("Panel del aliado"). */
  leyenda: string;
  titulo: string;
  /** Tarjeta de quien entra: nombre, detalle y si está verificado (sage). */
  ficha?: { nombre: string; detalle: string; verificado?: boolean; foto?: string | null };
  grupos: GrupoMenuPanel[];
  acciones?: ReactNode;
  /** Enlace "Ver mi perfil público", si existe una página pública. */
  perfilPublico?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [cerrando, setCerrando] = useState(false);
  const [errorSalida, setErrorSalida] = useState('');

  async function cerrarSesion() {
    setCerrando(true);
    setErrorSalida('');
    try {
      const respuesta = await fetch('/api/auth/logout', { method: 'POST' });
      if (!respuesta.ok) throw new Error();
      notificarCambioSesion(null);
      router.push('/');
      router.refresh();
    } catch {
      setErrorSalida('No pudimos cerrar tu sesión.');
      setCerrando(false);
    }
  }

  return (
    <div className="partner-shell">
      <aside className="partner-sidebar">
        {/* Forma burgundy de la ficha asomando al fondo (decorativa). */}
        <span aria-hidden="true" className="partner-sidebar__deco">
          <span className="partner-sidebar__shape" />
        </span>
        <a aria-label="Veto, ir al inicio" className="partner-logo" href="/">
          <BrandLogo className="brand-logo" />
        </a>
        {ficha?.nombre && (
          <div className="partner-ally">
            {ficha.foto ? (
              <img alt="" className="partner-ally__mono partner-ally__photo" src={ficha.foto} />
            ) : (
              <span aria-hidden="true" className="partner-ally__mono">
                {iniciales(ficha.nombre) || 'V'}
              </span>
            )}
            <span>
              <strong>{ficha.nombre}</strong>
              <small className={ficha.verificado ? 'is-ok' : ''}>{ficha.detalle}</small>
            </span>
          </div>
        )}
        {grupos.map((grupo) => (
          <div className="partner-sidebar__group" key={grupo.nombre}>
            <p className="partner-sidebar__label">{grupo.nombre.toUpperCase()}</p>
            <nav aria-label={grupo.nombre}>
              {grupo.items.map((item) => (
                <button
                  aria-current={item.activo ? 'page' : undefined}
                  className={item.activo ? 'is-active' : ''}
                  key={item.id}
                  onClick={item.alHacerClic}
                  type="button"
                >
                  <span aria-hidden="true">{item.icono}</span>
                  {item.etiqueta}
                </button>
              ))}
            </nav>
          </div>
        ))}
        <div className="partner-sidebar__foot">
          {perfilPublico && (
            <a href={perfilPublico}>
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M14 4h6v6M20 4l-9 9" />
                <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
              </svg>
              Ver mi perfil público
            </a>
          )}
          <a href="/">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="m3.75 10 8.25-6.75L20.25 10v9.25a1 1 0 0 1-1 1h-5.5v-6h-3.5v6h-5.5a1 1 0 0 1-1-1V10Z" />
            </svg>
            Volver a Veto
          </a>
          <button disabled={cerrando} onClick={() => void cerrarSesion()} type="button">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
            </svg>
            {cerrando ? 'Cerrando…' : 'Cerrar sesión'}
          </button>
          {errorSalida && (
            <small className="partner-sidebar__error" role="alert">
              {errorSalida}
            </small>
          )}
        </div>
      </aside>
      <div className="partner-main">
        <header className="partner-topbar">
          <div>
            <span className="partner-topbar__caption">{leyenda}</span>
            <h1>{titulo}</h1>
          </div>
          {acciones && <div className="partner-topbar__actions">{acciones}</div>}
        </header>
        <section className="partner-content">{children}</section>
      </div>
    </div>
  );
}
