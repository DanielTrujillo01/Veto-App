'use client';

/**
 * Piezas del resumen de los paneles (aliado, veterinario, equipo Veto) con la ficha de marca:
 * bienvenida con formas y avance, indicadores con ícono de color, tarjeta de aviso y accesos
 * rápidos. Colores en su proporción de uso: burgundy principal, peach secundario, sage solo
 * para lo completado (acento) y miel de detalle. Estilos en globals.css (`.ally-*`).
 */

import type { ReactNode } from 'react';

export type TonoPanel = 'burgundy' | 'peach' | 'sage' | 'honey';

export type PasoPanel = {
  texto: string;
  hecho: boolean;
  accion: string;
  alHacerClic: () => void;
};

export function BienvenidaPanel({
  saludo,
  acento,
  textoPendiente,
  textoCompleto,
  pasos,
  tituloAvance = 'Perfil completo',
}: {
  saludo: string;
  acento: string;
  textoPendiente: string;
  textoCompleto: string;
  /** Sin pasos, la bienvenida ocupa todo el ancho y no muestra avance. */
  pasos?: PasoPanel[];
  tituloAvance?: string;
}) {
  const hechos = pasos?.filter((paso) => paso.hecho).length ?? 0;
  const total = pasos?.length ?? 0;
  const avance = total ? Math.round((hechos / total) * 100) : 0;
  const completo = total > 0 && hechos === total;

  return (
    <section className={`ally-welcome${total ? '' : ' ally-welcome--solo'}`}>
      <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--burgundy" />
      <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--peach" />
      <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--sage" />
      <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--miel" />
      <div className="ally-welcome__copy">
        <span className="eyebrow eyebrow--dark">
          <i /> BIENVENIDO DE NUEVO
        </span>
        <h2>
          {saludo} <em>{acento}</em>
        </h2>
        <p>{completo || !total ? textoCompleto : textoPendiente}</p>
      </div>
      {total > 0 && pasos && (
        <div className="ally-progress">
          <div className="ally-progress__head">
            <strong>{tituloAvance}</strong>
            <span>{avance}%</span>
          </div>
          <div
            aria-label={`${tituloAvance} al ${avance}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={avance}
            className="ally-progress__bar"
            role="progressbar"
          >
            <i style={{ width: `${avance}%` }} />
          </div>
          <ul className="ally-progress__steps">
            {pasos.map((paso) => (
              <li className={paso.hecho ? 'is-done' : ''} key={paso.texto}>
                <span aria-hidden="true" className="ally-progress__check">
                  {paso.hecho ? '✓' : ''}
                </span>
                {paso.texto}
                <span className="sr-only">{paso.hecho ? ' (completo)' : ' (pendiente)'}</span>
                {!paso.hecho && (
                  <button onClick={paso.alHacerClic} type="button">
                    {paso.accion} →
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export type IndicadorPanel = {
  valor: number | string;
  texto: string;
  accion: string;
  alHacerClic: () => void;
  icono: ReactNode;
  tono: TonoPanel;
};

export function IndicadoresPanel({ items }: { items: IndicadorPanel[] }) {
  return (
    <div className="ally-kpis" style={{ ['--columnas' as string]: items.length }}>
      {items.map((indicador) => (
        <article className="ally-kpi" key={indicador.texto}>
          <span className={`ally-icon ally-icon--${indicador.tono}`}>{indicador.icono}</span>
          <strong>{indicador.valor}</strong>
          <span>{indicador.texto}</span>
          <button onClick={indicador.alHacerClic} type="button">
            {indicador.accion} →
          </button>
        </article>
      ))}
    </div>
  );
}

/** Tarjeta con título, un enlace opcional arriba a la derecha y su contenido. */
export function TarjetaPanel({
  id,
  titulo,
  enlace,
  children,
}: {
  id: string;
  titulo: string;
  enlace?: { texto: string; alHacerClic: () => void };
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="workspace-card ally-card">
      <div className="ally-card__head">
        <h2 id={id}>{titulo}</h2>
        {enlace && (
          <button onClick={enlace.alHacerClic} type="button">
            {enlace.texto} →
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Aviso suave dentro de una tarjeta (por ejemplo, "Pronto verás aquí tus citas"). */
export function AvisoPanel({
  icono,
  titulo,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <div className="ally-appointments-empty">
      <span aria-hidden="true" className="ally-icon ally-icon--burgundy">
        {icono}
      </span>
      <div>
        <strong>{titulo}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

export type AccesoPanel = {
  texto: string;
  detalle: string;
  icono: ReactNode;
  tono: TonoPanel;
  alHacerClic: () => void;
};

export function AccesosPanel({ items }: { items: AccesoPanel[] }) {
  return (
    <div className="ally-quick">
      {items.map((acceso) => (
        <button key={acceso.texto} onClick={acceso.alHacerClic} type="button">
          <span className={`ally-icon ally-icon--${acceso.tono}`}>{acceso.icono}</span>
          <span>
            {acceso.texto}
            <small>{acceso.detalle}</small>
          </span>
          <svg aria-hidden="true" className="ally-quick__arrow" viewBox="0 0 24 24">
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}
