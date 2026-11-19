'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { iniciales } from '@/components/PortadaCapas';
import { IconoVerificado } from '@/components/ui/iconos';
import { ApiError, api } from '@/lib/api';

type Aliado = { id: string; nombre: string };

/** Quién ofrece el servicio (la clínica aliada), para mostrarlo en los tres pasos. */
function useAliadoDelServicio(servicioId: string) {
  // undefined: cargando · null: no es una clínica del directorio público.
  const [aliado, setAliado] = useState<Aliado | null | undefined>(undefined);
  useEffect(() => {
    let vigente = true;
    void Promise.all([
      api<{ aliadoId: string }>(`/servicios/${servicioId}`),
      api<Aliado[]>('/aliados/clinicas'),
    ])
      .then(([servicio, clinicas]) => {
        if (vigente) setAliado(clinicas.find((c) => c.id === servicio.aliadoId) ?? null);
      })
      .catch(() => {
        if (vigente) setAliado(null);
      });
    return () => {
      vigente = false;
    };
  }, [servicioId]);
  return aliado;
}

/** La reserva es solo para tutores con sesión: 401 → ingresar; 403 → otra clase de cuenta. */
export function tipoDeAcceso(causa: unknown): 'sin-sesion' | 'no-tutor' | null {
  if (!(causa instanceof ApiError)) return null;
  if (causa.status === 401) return 'sin-sesion';
  if (causa.status === 403) return 'no-tutor';
  return null;
}

export function AvisoAcceso({
  tipo,
  volverA,
}: {
  tipo: 'sin-sesion' | 'no-tutor';
  volverA: string;
}) {
  return (
    <div className="empty-state catalog-empty">
      <span className="empty-state__illustration" aria-hidden="true">
        ♡
      </span>
      {tipo === 'sin-sesion' ? (
        <>
          <h2>Inicia sesión para reservar</h2>
          <p>Las citas se reservan con una cuenta de tutor. Al ingresar vuelves a este paso.</p>
          <div className="form-actions">
            <Link
              className="veto-button veto-button--primary"
              href={`/ingresar?returnTo=${encodeURIComponent(volverA)}`}
            >
              Ingresar
            </Link>
            <Link className="veto-button veto-button--secondary" href="/registro">
              Crear cuenta
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2>Las reservas son para tutores</h2>
          <p>
            Ingresaste con una cuenta de aliado o veterinario. Usa una cuenta de tutor para
            reservar.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Contenedor común de los tres pasos: encabezado de marca (crema, formas de la ficha), los
 * pasos con huellas y el contenido. Una descripción con " · " se muestra como etiquetas.
 */
export function MarcoReserva({
  servicioId,
  titulo,
  descripcion,
  pasos,
  children,
}: {
  servicioId: string;
  titulo: string;
  descripcion: string;
  pasos: ReactNode;
  children: ReactNode;
}) {
  const partes = descripcion.split(' · ').filter(Boolean);
  const aliado = useAliadoDelServicio(servicioId);
  return (
    <div className="workspace-page booking-page">
      <header className="booking-hero">
        <span aria-hidden="true" className="booking-hero__shape booking-hero__shape--burgundy" />
        <span aria-hidden="true" className="booking-hero__shape booking-hero__shape--peach" />
        <span aria-hidden="true" className="booking-hero__shape booking-hero__shape--sage" />
        <span aria-hidden="true" className="booking-hero__shape booking-hero__shape--miel" />
        <div className="booking-hero__copy">
          <p className="eyebrow eyebrow--dark">RESERVA TU CITA</p>
          <h1>{titulo}</h1>
          {aliado === null && (
            <p className="booking-hero__ally">
              <span aria-hidden="true" className="offer-card__mini">
                ✚
              </span>
              Lo ofrece un aliado de Veto
            </p>
          )}
          {aliado && (
            <p className="booking-hero__ally">
              <span aria-hidden="true" className="offer-card__mini">
                {iniciales(aliado.nombre) || '✚'}
              </span>
              Lo ofrece{' '}
              <Link className="booking-hero__ally-link" href={`/clinicas/${aliado.id}`}>
                {aliado.nombre}
              </Link>
              <span className="clinic-tile__check" title="Aliado verificado por Veto">
                <IconoVerificado tamano={15} />
                <span className="sr-only">Aliado verificado</span>
              </span>
            </p>
          )}
          {partes.length > 1 ? (
            <ul aria-label="Detalles de la reserva" className="booking-hero__tags">
              {partes.map((parte, indice) => (
                <li className={indice === 0 ? 'is-main' : ''} key={parte}>
                  {parte}
                </li>
              ))}
            </ul>
          ) : (
            descripcion && <p>{descripcion}</p>
          )}
        </div>
        {pasos && <div className="booking-hero__steps">{pasos}</div>}
      </header>
      {children}
    </div>
  );
}
