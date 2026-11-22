'use client';

/**
 * Ventana emergente que confirma la reserva (HU-031), con la ficha de marca: tarjeta limpia,
 * sello de confirmación y el resumen de la cita. Es un <dialog> nativo:
 * se cierra con Esc, con la X o con "Ver mi cita", y devuelve el foco a la página.
 */

import Link from 'next/link';
import { useEffect, useRef } from 'react';

export function CitaReservada({
  servicio,
  aliado,
  mascota,
  fecha,
  hora,
  pendiente,
  onCerrar,
}: {
  servicio: string;
  aliado: string;
  mascota: string;
  fecha: string;
  hora: string;
  /** La clínica confirma a mano: la cita queda pendiente de aprobación. */
  pendiente: boolean;
  onCerrar: () => void;
}) {
  const ventana = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ventana.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  return (
    <dialog
      aria-describedby="cita-reservada-texto"
      aria-labelledby="cita-reservada-titulo"
      className="booking-done"
      onClick={(evento) => {
        // Clic en el fondo oscuro (fuera de la tarjeta) también cierra.
        if (evento.target === evento.currentTarget) ventana.current?.close();
      }}
      onClose={onCerrar}
      ref={ventana}
    >
      <div className="booking-done__card">
        <button
          aria-label="Cerrar"
          className="booking-done__close"
          onClick={() => ventana.current?.close()}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <span aria-hidden="true" className={`booking-done__seal${pendiente ? ' is-wait' : ''}`}>
          {pendiente ? (
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24">
              <path d="m6 12.5 4 4 8-9" />
            </svg>
          )}
        </span>

        <p className="eyebrow eyebrow--dark">
          {pendiente ? 'SOLICITUD ENVIADA' : 'CITA CONFIRMADA'}
        </p>
        <h2 id="cita-reservada-titulo">
          {pendiente ? (
            <>
              ¡Listo! <em>Tu cita está en camino.</em>
            </>
          ) : (
            <>
              ¡Tu cita quedó <em>reservada!</em>
            </>
          )}
        </h2>
        <p className="booking-done__text" id="cita-reservada-texto">
          {pendiente
            ? `${aliado} debe aprobarla. Te avisaremos cuando lo haga.`
            : `${aliado} te espera. Puedes volver a esta página cuando quieras para ver los detalles.`}
        </p>

        <dl className="booking-done__summary">
          <div>
            <dt>Servicio</dt>
            <dd>{servicio}</dd>
          </div>
          <div>
            <dt>Mascota</dt>
            <dd>{mascota}</dd>
          </div>
          <div className="booking-done__when">
            <dt>Fecha y hora</dt>
            <dd>
              <strong>{hora}</strong> · {fecha}
            </dd>
          </div>
        </dl>

        <div className="booking-done__actions">
          <button
            className="veto-button veto-button--primary"
            onClick={() => ventana.current?.close()}
            type="button"
          >
            Ver mi cita
          </button>
          <Link className="veto-button veto-button--secondary" href="/servicios">
            Seguir explorando
          </Link>
        </div>
      </div>
    </dialog>
  );
}
