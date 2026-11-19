'use client';

/**
 * HU-031 · Paso 3: revisar los datos principales y confirmar.
 *
 * API: GET /reservas/resumen (vuelve a validar horario y mascota; `listo` y `pendientes`) y
 * POST /reservas (crea la cita). El botón se bloquea mientras confirma y la API es segura ante
 * un doble clic o un reintento: devuelve la misma cita con `repetida: true`.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReservaConfirmada, ResumenReserva } from '@veto/shared';
import { AlertBox, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { rangoDeCita } from '@/lib/fechas';
import { formatoPrecio } from '@/lib/formato';
import { AvisoAcceso, MarcoReserva, tipoDeAcceso } from '../../comunes';
import { PasosReserva } from '../../PasosReserva';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'sin-reserva' }
  | { tipo: 'acceso'; acceso: 'sin-sesion' | 'no-tutor' }
  | { tipo: 'listo'; resumen: ResumenReserva };

export function ConfirmarReserva({ servicioId }: { servicioId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const enCurso = useRef(false);

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const resumen = await api<ResumenReserva>('/reservas/resumen');
      if (resumen.seleccion.citaId) {
        router.replace(`/citas/${resumen.seleccion.citaId}`);
        return;
      }
      setEstado({ tipo: 'listo', resumen });
    } catch (causa) {
      const acceso = tipoDeAcceso(causa);
      if (acceso) return setEstado({ tipo: 'acceso', acceso });
      if (causa instanceof ApiError && causa.status === 404)
        return setEstado({ tipo: 'sin-reserva' });
      setEstado({ tipo: 'error' });
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function confirmar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setConfirmando(true);
    setError('');
    try {
      const cita = await api<ReservaConfirmada>('/reservas', { method: 'POST' });
      router.replace(`/citas/${cita.id}?nueva=1`);
    } catch (causa) {
      setError(
        causa instanceof ApiError ? causa.message : 'No pudimos confirmar. Inténtalo de nuevo.',
      );
      // Se vuelve a pedir el resumen para mostrar qué cambió (horario tomado, etc.).
      void cargar();
      enCurso.current = false;
      setConfirmando(false);
    }
  }

  const pasos = <PasosReserva actual={3} servicioId={servicioId} />;
  const titulo = 'Revisa y confirma';

  if (estado.tipo === 'cargando') {
    return (
      <MarcoReserva
        servicioId={servicioId}
        descripcion="Comprobando disponibilidad…"
        pasos={pasos}
        titulo={titulo}
      >
        <span className="skeleton service-card-skeleton" />
      </MarcoReserva>
    );
  }
  if (estado.tipo === 'acceso') {
    return (
      <MarcoReserva servicioId={servicioId} descripcion="" pasos={pasos} titulo={titulo}>
        <AvisoAcceso tipo={estado.acceso} volverA={`/reservar/${servicioId}/confirmar`} />
      </MarcoReserva>
    );
  }
  if (estado.tipo === 'sin-reserva') {
    return (
      <MarcoReserva servicioId={servicioId} descripcion="" pasos={pasos} titulo={titulo}>
        <AlertBox tone="warning" title="No tienes una reserva en curso">
          Puede que haya vencido (se guarda una hora).{' '}
          <Link className="text-action" href={`/reservar/${servicioId}`}>
            Empezar de nuevo
          </Link>
        </AlertBox>
      </MarcoReserva>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <MarcoReserva servicioId={servicioId} descripcion="" pasos={pasos} titulo={titulo}>
        <AlertBox tone="error" title="No pudimos cargar el resumen">
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </MarcoReserva>
    );
  }

  const { resumen } = estado;
  const { seleccion } = resumen;
  const rutaDe = (campo: string) =>
    campo === 'mascotaId' ? `/reservar/${servicioId}/mascota` : `/reservar/${servicioId}`;

  return (
    <MarcoReserva
      servicioId={servicioId}
      descripcion="Revisa los datos antes de confirmar tu cita."
      pasos={pasos}
      titulo={titulo}
    >
      <div className="booking-summary">
        <section aria-labelledby="resumen-titulo" className="clinic-section">
          <h2 id="resumen-titulo">Tu cita</h2>
          <dl className="detail-facts">
            <div>
              <dt>Servicio</dt>
              <dd>{seleccion.servicioNombre}</dd>
            </div>
            <div>
              <dt>Aliado</dt>
              <dd>{resumen.aliadoNombre}</dd>
            </div>
            <div>
              <dt>Profesional</dt>
              <dd>{seleccion.veterinarioNombre}</dd>
            </div>
            <div>
              <dt>Mascota</dt>
              <dd>{seleccion.mascotaNombre ?? 'Sin elegir'}</dd>
            </div>
          </dl>
          <dl className="detail-facts">
            <div>
              <dt>Fecha y hora</dt>
              <dd>{rangoDeCita(seleccion.inicio, seleccion.fin)}</dd>
            </div>
          </dl>
          <div className="booking-reason">
            <strong>Motivo</strong>
            <p>{seleccion.motivo || 'No indicaste un motivo.'}</p>
          </div>
        </section>

        <aside aria-label="Confirmar" className="clinic-booking-card">
          <span className="eyebrow eyebrow--dark">TOTAL A PAGAR EN LA CITA</span>
          <strong>{resumen.precio != null ? formatoPrecio(resumen.precio) : 'Por calcular'}</strong>
          {resumen.estadoInicial && (
            <p>
              {resumen.estadoInicial === 'AGENDADA'
                ? 'Tu cita quedará agendada al confirmar.'
                : 'El aliado debe aprobar tu cita; te avisaremos.'}
            </p>
          )}
          {resumen.pendientes.length > 0 && (
            <AlertBox tone="warning" title="Antes de confirmar">
              {resumen.pendientes.map((pendiente) => (
                <span className="booking-pending" key={pendiente.campo + pendiente.mensaje}>
                  {pendiente.mensaje}.{' '}
                  {pendiente.campo !== 'reserva' && (
                    <Link className="text-action" href={rutaDe(pendiente.campo)}>
                      Corregir
                    </Link>
                  )}
                </span>
              ))}
            </AlertBox>
          )}
          {error && (
            <AlertBox tone="error" title="No se confirmó la cita">
              {error}
            </AlertBox>
          )}
          <VetoButton
            disabled={!resumen.listo}
            loading={confirmando}
            onClick={() => void confirmar()}
          >
            Confirmar reserva
          </VetoButton>
          <Link className="text-action" href={`/reservar/${servicioId}/mascota`}>
            ← Cambiar mascota o motivo
          </Link>
        </aside>
      </div>
    </MarcoReserva>
  );
}
