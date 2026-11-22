'use client';

/**
 * Detalle de una cita para quien puede verla: el tutor, el administrador del aliado y sus
 * veterinarios (GET /citas/:id; a cualquier otra persona la API le responde 404).
 *
 * - HU-030: muestra el motivo que escribió el tutor.
 * - HU-031: es la pantalla a la que llega el tutor al confirmar (?nueva=1).
 * - HU-032: el aliado o su veterinario marcan la cita como finalizada o "no asistió" cuando su
 *   hora ya llegó (PATCH /citas/:id/finalizar | no-asistio). El historial (GET /citas/:id/historial)
 *   muestra cada cambio con fecha y responsable.
 * - HU-033: al finalizar se escriben recomendaciones (máx. 2000) que luego ve el tutor. Si el
 *   guardado falla se muestra el error y no se confirma nada.
 */

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  OBSERVACION_CITA_MAX_CARACTERES,
  RECOMENDACIONES_MAX_CARACTERES,
  contarCaracteres,
  type CambioDeEstado,
  type CitaActualizada,
  type CitaDetalle,
} from '@veto/shared';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { ESTADO_CITA } from '@/lib/citas';
import { fechaLarga, horaEnColombia, rangoDeCita } from '@/lib/fechas';
import { formatoPrecio } from '@/lib/formato';
import { CitaReservada } from './CitaReservada';
import type { UsuarioSesion } from '@/lib/session';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'no-existe' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'listo'; cita: CitaDetalle; historial: CambioDeEstado[]; usuario: UsuarioSesion };

type Cierre = 'FINALIZADA' | 'NO_ASISTIO';

function Contador({ id, texto, maximo }: { id: string; texto: string; maximo: number }) {
  const usados = contarCaracteres(texto.trim());
  return (
    <small
      aria-live="polite"
      className={`character-count${usados >= maximo ? ' character-count--limit' : ''}`}
      id={id}
    >
      {usados}/{maximo}
      {usados >= maximo ? ' · Llegaste al límite de caracteres.' : ''}
    </small>
  );
}

function CerrarCita({
  cita,
  onCerrada,
}: {
  cita: CitaDetalle;
  onCerrada: (cita: CitaActualizada) => void;
}) {
  const [cierre, setCierre] = useState<Cierre>('FINALIZADA');
  const [recomendaciones, setRecomendaciones] = useState('');
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const horaLlego = Date.parse(cita.inicio) <= Date.now();

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError('');
    setErrores({});
    try {
      const actualizada = await api<CitaActualizada>(
        `/citas/${cita.id}/${cierre === 'FINALIZADA' ? 'finalizar' : 'no-asistio'}`,
        {
          method: 'PATCH',
          body: JSON.stringify(
            cierre === 'FINALIZADA'
              ? { recomendaciones: recomendaciones.trim() || null }
              : { observacion: observacion.trim() || null },
          ),
        },
      );
      onCerrada(actualizada);
    } catch (causa) {
      if (causa instanceof ApiError && Object.keys(causa.fieldErrors).length) {
        setErrores(causa.fieldErrors);
      } else {
        setError(
          causa instanceof ApiError
            ? causa.message
            : 'No pudimos guardar el cierre. No se cambió nada; inténtalo de nuevo.',
        );
      }
    } finally {
      setGuardando(false);
    }
  }

  if (!horaLlego) {
    return (
      <AlertBox tone="info" title="Aún no es la hora de la cita">
        Podrás marcarla como finalizada o “no asistió” desde el {fechaLarga(cita.inicio)} a las{' '}
        {horaEnColombia(cita.inicio)}.
      </AlertBox>
    );
  }

  return (
    <form className="booking-form" noValidate onSubmit={guardar}>
      <fieldset className="booking-fieldset">
        <legend>¿Cómo terminó la cita?</legend>
        <div className="search-result-tags">
          {(['FINALIZADA', 'NO_ASISTIO'] as const).map((opcion) => (
            <button
              aria-pressed={cierre === opcion}
              className={cierre === opcion ? 'is-active' : ''}
              key={opcion}
              onClick={() => setCierre(opcion)}
              type="button"
            >
              {opcion === 'FINALIZADA' ? 'Se atendió · Finalizar' : 'El tutor no asistió'}
            </button>
          ))}
        </div>
      </fieldset>

      {cierre === 'FINALIZADA' ? (
        <label className="field">
          <span>Recomendaciones para el tutor (opcional)</span>
          <textarea
            aria-describedby="recomendaciones-contador"
            className={`control textarea${errores.recomendaciones ? ' control--error' : ''}`}
            maxLength={RECOMENDACIONES_MAX_CARACTERES}
            onChange={(evento) => setRecomendaciones(evento.target.value)}
            placeholder="Cuidados en casa, medicamentos, próximo control…"
            rows={5}
            value={recomendaciones}
          />
          <Contador
            id="recomendaciones-contador"
            maximo={RECOMENDACIONES_MAX_CARACTERES}
            texto={recomendaciones}
          />
          {errores.recomendaciones && (
            <small className="field-error">{errores.recomendaciones}</small>
          )}
        </label>
      ) : (
        <label className="field">
          <span>Observación interna (opcional, el tutor no la ve)</span>
          <textarea
            aria-describedby="observacion-contador"
            className={`control textarea${errores.observacion ? ' control--error' : ''}`}
            maxLength={OBSERVACION_CITA_MAX_CARACTERES}
            onChange={(evento) => setObservacion(evento.target.value)}
            placeholder="Ej. No contestó las llamadas."
            rows={3}
            value={observacion}
          />
          <Contador
            id="observacion-contador"
            maximo={OBSERVACION_CITA_MAX_CARACTERES}
            texto={observacion}
          />
          {errores.observacion && <small className="field-error">{errores.observacion}</small>}
        </label>
      )}

      {error && (
        <AlertBox tone="error" title="No se guardó el cierre">
          {error}
        </AlertBox>
      )}

      <div className="form-actions">
        <small className="field__hint">
          Este cambio es definitivo: la cita ya no se podrá modificar.
        </small>
        <VetoButton
          loading={guardando}
          type="submit"
          variant={cierre === 'FINALIZADA' ? 'primary' : 'danger'}
        >
          {cierre === 'FINALIZADA' ? 'Marcar como finalizada' : 'Marcar no asistió'}
        </VetoButton>
      </div>
    </form>
  );
}

export function DetalleCita({ citaId }: { citaId: string }) {
  const nueva = useSearchParams().get('nueva') === '1';
  const router = useRouter();
  const pathname = usePathname();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const [{ usuario }, cita, historial] = await Promise.all([
        api<{ usuario: UsuarioSesion }>('/identidad/me'),
        api<CitaDetalle>(`/citas/${citaId}`),
        api<CambioDeEstado[]>(`/citas/${citaId}/historial`).catch(() => []),
      ]);
      setEstado({ tipo: 'listo', cita, historial, usuario });
    } catch (causa) {
      if (causa instanceof ApiError && causa.status === 401)
        return setEstado({ tipo: 'sin-sesion' });
      if (causa instanceof ApiError && [400, 403, 404].includes(causa.status)) {
        return setEstado({ tipo: 'no-existe' });
      }
      setEstado({ tipo: 'error' });
    }
  }, [citaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (estado.tipo === 'cargando') {
    return (
      <div className="clinic-profile" aria-busy="true" aria-label="Cargando cita">
        <span className="skeleton service-card-skeleton" />
        <span className="skeleton service-card-skeleton" />
      </div>
    );
  }
  if (estado.tipo === 'sin-sesion') {
    return (
      <div className="clinic-profile">
        <AlertBox tone="info" title="Inicia sesión para ver tu cita">
          <Link
            className="text-action"
            href={`/ingresar?returnTo=${encodeURIComponent(`/citas/${citaId}`)}`}
          >
            Ingresar
          </Link>
        </AlertBox>
      </div>
    );
  }
  if (estado.tipo === 'no-existe') {
    return (
      <div className="clinic-profile">
        <div className="empty-state catalog-empty">
          <h1>No encontramos esta cita</h1>
          <p>No existe o no tienes permiso para verla.</p>
          <Link className="veto-button veto-button--primary" href="/">
            Ir al inicio
          </Link>
        </div>
      </div>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <div className="clinic-profile">
        <AlertBox tone="error" title="No pudimos cargar la cita">
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </div>
    );
  }

  const { cita, historial, usuario } = estado;
  const gestiona = usuario.rol === 'ALIADO' || usuario.rol === 'VETERINARIO';
  const estadoCita = ESTADO_CITA[cita.estado];

  return (
    <div className="clinic-profile">
      {nueva && usuario.rol === 'TUTOR' && (
        <CitaReservada
          aliado={cita.aliado.nombre}
          fecha={fechaLarga(cita.inicio)}
          hora={horaEnColombia(cita.inicio)}
          mascota={cita.mascota.nombre}
          onCerrar={() => router.replace(pathname, { scroll: false })}
          pendiente={cita.estado === 'PENDIENTE'}
          servicio={cita.servicio.nombre}
        />
      )}
      {aviso && (
        <AlertBox tone="success" title="Cambio guardado">
          {aviso}
        </AlertBox>
      )}

      <div className="clinic-profile__hero">
        <div className="clinic-profile__copy">
          <StatusBadge tone={estadoCita.tono}>{estadoCita.texto}</StatusBadge>
          <h1>{cita.servicio.nombre}</h1>
          <p>
            {cita.aliado.nombre}
            {cita.veterinario ? ` · con ${cita.veterinario.nombre}` : ''}
          </p>
        </div>
        <aside aria-label="Resumen" className="clinic-booking-card">
          <span className="eyebrow eyebrow--dark">FECHA Y HORA</span>
          <strong>{horaEnColombia(cita.inicio)}</strong>
          <p>{fechaLarga(cita.inicio)}</p>
          <small>Precio: {formatoPrecio(cita.precio)}</small>
        </aside>
      </div>

      <div className="detail-columns">
        <div className="detail-side">
          <section aria-labelledby="cita-datos" className="detail-panel">
            <h2 id="cita-datos">Datos de la cita</h2>
            <dl className="detail-facts">
              <div>
                <dt>Mascota</dt>
                <dd>
                  {cita.mascota.nombre} · {cita.mascota.especie}
                </dd>
              </div>
              <div>
                <dt>Tutor</dt>
                <dd>{cita.tutor.nombre}</dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>{rangoDeCita(cita.inicio, cita.fin)}</dd>
              </div>
            </dl>
            <div className="booking-reason">
              <strong>Motivo</strong>
              <p>{cita.motivo || 'El tutor no indicó un motivo.'}</p>
            </div>
          </section>

          {(cita.recomendaciones || cita.estado === 'FINALIZADA') && (
            <section aria-labelledby="cita-recomendaciones" className="detail-panel">
              <h2 id="cita-recomendaciones">Recomendaciones del profesional</h2>
              <p className="product-description">
                {cita.recomendaciones || 'El profesional no dejó recomendaciones.'}
              </p>
            </section>
          )}

          {gestiona && cita.estado === 'AGENDADA' && (
            <section aria-labelledby="cita-cierre" className="detail-panel">
              <h2 id="cita-cierre">Cerrar la cita</h2>
              <CerrarCita
                cita={cita}
                onCerrada={(actualizada) => {
                  setAviso(
                    actualizada.estado === 'FINALIZADA'
                      ? 'La cita quedó finalizada y el tutor ya puede ver tus recomendaciones.'
                      : 'La cita quedó marcada como “no asistió”.',
                  );
                  void cargar();
                }}
              />
            </section>
          )}
        </div>
        <div className="detail-side">
          {historial.length > 0 && (
            <section aria-labelledby="cita-historial" className="detail-panel">
              <h2 id="cita-historial">Historial</h2>
              <ol className="status-timeline">
                {historial.map((cambio) => (
                  <li key={cambio.cambiadoEn + cambio.estadoNuevo}>
                    <StatusBadge tone={ESTADO_CITA[cambio.estadoNuevo].tono}>
                      {ESTADO_CITA[cambio.estadoNuevo].texto}
                    </StatusBadge>
                    <span>
                      {fechaLarga(cambio.cambiadoEn)} · {horaEnColombia(cambio.cambiadoEn)} ·{' '}
                      {cambio.cambiadoPor === null
                        ? 'Sistema'
                        : cambio.cambiadoPor === usuario.id
                          ? 'Tú'
                          : cambio.cambiadoPor === cita.tutor.id
                            ? 'Tutor'
                            : 'El aliado'}
                    </span>
                    {cambio.observacion && <small>{cambio.observacion}</small>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
