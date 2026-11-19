'use client';

/**
 * Agenda de citas del aliado o del veterinario (HU-032), con la ficha de marca. Lee
 * GET /citas: el administrador del aliado recibe todas las citas del aliado; el veterinario, las
 * asignadas a él. Cada cita lleva a su detalle, donde se marca finalizada o "no asistió" y se
 * escriben las recomendaciones (HU-033).
 */

import Link from 'next/link';
import type { CitaDetalle } from '@veto/shared';
import { StatusBadge } from '@/components/ui/veto-components';
import { ESTADO_CITA } from '@/lib/citas';
import { horaEnColombia } from '@/lib/fechas';

export type FiltroAgenda = 'proximas' | 'por-cerrar' | 'pasadas' | 'todas';

/** Ya empezó y sigue agendada: falta marcarla finalizada o "no asistió". */
export const porCerrar = (cita: CitaDetalle, ahora = Date.now()) =>
  cita.estado === 'AGENDADA' && Date.parse(cita.inicio) <= ahora;

export const proxima = (cita: CitaDetalle, ahora = Date.now()) =>
  (cita.estado === 'AGENDADA' || cita.estado === 'PENDIENTE') && Date.parse(cita.inicio) > ahora;

/** Aplica el filtro y ordena: próximas de la más cercana a la más lejana; el resto, recientes primero. */
export function filtrarAgenda(citas: CitaDetalle[], filtro: FiltroAgenda) {
  const ahora = Date.now();
  const lista = citas.filter((cita) =>
    filtro === 'proximas'
      ? proxima(cita, ahora)
      : filtro === 'por-cerrar'
        ? porCerrar(cita, ahora)
        : filtro === 'pasadas'
          ? !proxima(cita, ahora) && !porCerrar(cita, ahora)
          : true,
  );
  return filtro === 'proximas'
    ? [...lista].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
    : [...lista].sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio));
}

const dia = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
  }).format(new Date(iso));

const mes = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', month: 'short' })
    .format(new Date(iso))
    .replace('.', '')
    .toUpperCase();

export function ListaAgenda({
  citas,
  mostrarVeterinario = false,
  vacio,
}: {
  citas: CitaDetalle[];
  /** Para el administrador de la clínica: dice qué veterinario atiende cada cita. */
  mostrarVeterinario?: boolean;
  vacio: { titulo: string; texto: string };
}) {
  if (citas.length === 0) {
    return (
      <div className="empty-state empty-state--compact">
        <span className="empty-state__illustration" aria-hidden="true">
          ♡
        </span>
        <h3>{vacio.titulo}</h3>
        <p>{vacio.texto}</p>
      </div>
    );
  }

  return (
    <ul className="agenda-list">
      {citas.map((cita) => {
        const estado = ESTADO_CITA[cita.estado];
        const cerrar = porCerrar(cita);
        return (
          <li className={`agenda-item${cerrar ? ' is-due' : ''}`} key={cita.id}>
            <span aria-hidden="true" className="agenda-item__date">
              <small>{mes(cita.inicio)}</small>
              <b>{dia(cita.inicio)}</b>
            </span>
            <span className="agenda-item__body">
              <strong>
                {cita.mascota.nombre} <span>· {cita.mascota.especie}</span>
              </strong>
              <span>
                {horaEnColombia(cita.inicio)} · {cita.servicio.nombre}
                {mostrarVeterinario && cita.veterinario ? ` · ${cita.veterinario.nombre}` : ''}
              </span>
              <small>
                Tutor: {cita.tutor.nombre}
                {cita.motivo ? ` · “${cita.motivo}”` : ''}
              </small>
            </span>
            <span className="agenda-item__actions">
              <StatusBadge tone={cerrar ? 'warning' : estado.tono}>
                {cerrar ? 'Por cerrar' : estado.texto}
              </StatusBadge>
              <Link
                className={`veto-button ${cerrar ? 'veto-button--primary' : 'veto-button--secondary'}`}
                href={`/citas/${cita.id}`}
              >
                {cerrar ? 'Atender y cerrar' : 'Ver cita'}
              </Link>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
