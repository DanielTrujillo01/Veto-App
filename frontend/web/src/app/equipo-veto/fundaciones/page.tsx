'use client';

/**
 * HU-079 · Revisión de fundaciones por el Equipo Veto.
 *
 * API (rol EQUIPO_VETO):
 *   GET   /admin/fundaciones/pendientes      → { fundaciones: FundacionPendiente[] }
 *   GET   /admin/fundaciones/:id             → { fundacion: FundacionRevision }
 *   PATCH /admin/fundaciones/:id/aprobar     → { fundacion: { id, estado: 'ACTIVO' } }
 *   PATCH /admin/fundaciones/:id/rechazar    → { fundacion: { id, estado: 'RECHAZADO' } }
 *
 * La decisión es definitiva (el backend no permite una segunda decisión) y queda registrada con
 * quién la tomó y cuándo. Por eso se pide confirmar antes de enviarla.
 */

import { useCallback, useEffect, useState } from 'react';
import { PanelShell } from '@/components/panel/PanelShell';
import { IconoHuella } from '@/components/ui/iconos';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';

type FundacionPendiente = {
  id: string;
  nombre: string;
  contacto: string | null;
  ciudad: string | null;
  creadoEn: string;
  representante: string;
  correo: string;
  celular: string;
};

type FundacionRevision = FundacionPendiente & {
  descripcion: string | null;
  logoUrl: string | null;
  ubicacion: string | null;
  anioFundacion: number | null;
};

type Decision = 'aprobar' | 'rechazar';

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

function mensajeDeError(causa: unknown, generico: string) {
  if (causa instanceof ApiError) {
    if (causa.status === 401) return 'Inicia sesión con una cuenta del Equipo Veto para continuar.';
    if (causa.status === 403) return 'Esta sección es solo para el Equipo Veto.';
    return causa.message;
  }
  return generico;
}

export default function RevisionFundaciones() {
  const [pendientes, setPendientes] = useState<FundacionPendiente[] | null>(null);
  const [errorLista, setErrorLista] = useState('');
  const [seleccionada, setSeleccionada] = useState<string>('');
  const [detalle, setDetalle] = useState<FundacionRevision | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState('');
  const [confirmar, setConfirmar] = useState<Decision | null>(null);
  const [decidiendo, setDecidiendo] = useState(false);
  const [resultado, setResultado] = useState<{ tono: 'success' | 'error'; texto: string } | null>(
    null,
  );

  const cargarLista = useCallback(async () => {
    setErrorLista('');
    try {
      const { fundaciones } = await api<{ fundaciones: FundacionPendiente[] }>(
        '/admin/fundaciones/pendientes',
      );
      setPendientes(fundaciones);
    } catch (causa) {
      setPendientes([]);
      setErrorLista(mensajeDeError(causa, 'No pudimos cargar las solicitudes.'));
    }
  }, []);

  useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  useEffect(() => {
    if (!seleccionada) {
      setDetalle(null);
      return;
    }
    let vigente = true;
    setCargandoDetalle(true);
    setErrorDetalle('');
    setConfirmar(null);
    api<{ fundacion: FundacionRevision }>(`/admin/fundaciones/${seleccionada}`)
      .then(({ fundacion }) => {
        if (vigente) setDetalle(fundacion);
      })
      .catch((causa: unknown) => {
        if (vigente) {
          setDetalle(null);
          setErrorDetalle(mensajeDeError(causa, 'No pudimos cargar la solicitud.'));
        }
      })
      .finally(() => {
        if (vigente) setCargandoDetalle(false);
      });
    return () => {
      vigente = false;
    };
  }, [seleccionada]);

  async function decidir(decision: Decision) {
    if (!detalle) return;
    setDecidiendo(true);
    setResultado(null);
    try {
      await api(`/admin/fundaciones/${detalle.id}/${decision}`, { method: 'PATCH' });
      setResultado({
        tono: 'success',
        texto:
          decision === 'aprobar'
            ? `${detalle.nombre} quedó aprobada: ya puede publicar mascotas en adopción.`
            : `${detalle.nombre} quedó rechazada. No podrá publicar mascotas.`,
      });
      setSeleccionada('');
      setConfirmar(null);
      await cargarLista();
    } catch (causa) {
      // 409: otra persona del equipo ya la decidió. Se actualiza la lista.
      setResultado({
        tono: 'error',
        texto: mensajeDeError(causa, 'No pudimos guardar la decisión. Inténtalo de nuevo.'),
      });
      if (causa instanceof ApiError && causa.status === 409) {
        setSeleccionada('');
        await cargarLista();
      }
    } finally {
      setDecidiendo(false);
    }
  }

  const total = pendientes?.length ?? 0;

  return (
    <PanelShell
      acciones={
        <StatusBadge tone={total ? 'warning' : 'success'}>
          {pendientes === null
            ? 'Cargando…'
            : total
              ? `${total} ${total === 1 ? 'pendiente' : 'pendientes'}`
              : 'Al día'}
        </StatusBadge>
      }
      ficha={{ nombre: 'Equipo Veto', detalle: 'Administración', verificado: true }}
      grupos={[
        {
          nombre: 'Revisión',
          items: [
            {
              id: 'fundaciones',
              etiqueta: 'Fundaciones',
              icono: <IconoHuella tamano={18} />,
              activo: true,
              alHacerClic: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            },
          ],
        },
      ]}
      leyenda="Equipo Veto"
      titulo="Revisión de fundaciones"
    >
      <p className="workspace-card__intro">
        Verifica la información antes de habilitar publicaciones de adopción. Solo las fundaciones
        aprobadas pueden publicar mascotas.
      </p>

      {resultado && (
        <AlertBox
          tone={resultado.tono}
          title={resultado.tono === 'success' ? 'Decisión guardada' : 'No se guardó la decisión'}
        >
          {resultado.texto}
        </AlertBox>
      )}
      {errorLista && (
        <AlertBox tone="error" title="No se pudieron cargar las solicitudes">
          {errorLista}{' '}
          <VetoButton onClick={() => void cargarLista()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      )}

      <div className="admin-review-layout">
        <section className="workspace-card admin-queue">
          <div className="workspace-card__title-row">
            <div>
              <h2>Pendientes</h2>
              <p className="workspace-card__intro">Solicitudes de aliados Fundación</p>
            </div>
            <span className="status-badge status-badge--neutral">
              {total} {total === 1 ? 'solicitud' : 'solicitudes'}
            </span>
          </div>

          {pendientes === null ? (
            <div className="workspace-loading">
              <span className="skeleton pet-skeleton-line" />
              <span className="skeleton pet-skeleton-line" />
            </div>
          ) : total === 0 ? (
            <div className="empty-state empty-state--compact">
              <span className="empty-state__illustration" aria-hidden="true">
                ✓
              </span>
              <h3>No hay solicitudes para revisar</h3>
              <p>Cuando una fundación se registre, su solicitud aparecerá aquí.</p>
            </div>
          ) : (
            <ul className="admin-queue__list">
              {pendientes.map((fundacion) => (
                <li key={fundacion.id}>
                  <button
                    aria-pressed={seleccionada === fundacion.id}
                    className={`admin-queue__item${seleccionada === fundacion.id ? ' is-active' : ''}`}
                    onClick={() => setSeleccionada(fundacion.id)}
                    type="button"
                  >
                    <strong>{fundacion.nombre}</strong>
                    <span>
                      {fundacion.ciudad || 'Ciudad sin indicar'} · {fundacion.representante}
                    </span>
                    <small>Enviada el {fecha(fundacion.creadoEn)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="workspace-card admin-detail" aria-live="polite">
          {!seleccionada ? (
            <div className="empty-state empty-state--compact">
              <h3>Selecciona una solicitud</h3>
              <p>Verás los datos que envió la fundación y podrás aprobarla o rechazarla.</p>
            </div>
          ) : cargandoDetalle ? (
            <div className="workspace-loading">
              <span className="skeleton pet-skeleton-line" />
              <span className="skeleton pet-skeleton-line" />
              <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
            </div>
          ) : errorDetalle || !detalle ? (
            <AlertBox tone="error" title="No se pudo abrir la solicitud">
              {errorDetalle || 'La solicitud ya no está disponible.'}
            </AlertBox>
          ) : (
            <>
              <div className="admin-detail__head">
                {detalle.logoUrl ? (
                  <img alt="" className="admin-detail__logo" src={detalle.logoUrl} />
                ) : (
                  <span aria-hidden="true" className="admin-detail__logo">
                    ♡
                  </span>
                )}
                <div>
                  <h2>{detalle.nombre}</h2>
                  <small>Solicitud enviada el {fecha(detalle.creadoEn)}</small>
                </div>
              </div>

              {detalle.descripcion && <p className="admin-detail__desc">{detalle.descripcion}</p>}

              <dl className="admin-detail__data">
                <div>
                  <dt>Representante</dt>
                  <dd>{detalle.representante}</dd>
                </div>
                <div>
                  <dt>Correo</dt>
                  <dd>{detalle.correo}</dd>
                </div>
                <div>
                  <dt>Celular</dt>
                  <dd>{detalle.celular}</dd>
                </div>
                <div>
                  <dt>Contacto de la fundación</dt>
                  <dd>{detalle.contacto || 'Sin indicar'}</dd>
                </div>
                <div>
                  <dt>Ciudad</dt>
                  <dd>{detalle.ciudad || 'Sin indicar'}</dd>
                </div>
                <div>
                  <dt>Ubicación</dt>
                  <dd>{detalle.ubicacion || 'Sin indicar'}</dd>
                </div>
                <div>
                  <dt>Año de fundación</dt>
                  <dd>{detalle.anioFundacion ?? 'Sin indicar'}</dd>
                </div>
              </dl>

              {confirmar ? (
                <div className="admin-detail__confirm" role="alertdialog" aria-live="assertive">
                  <strong>
                    {confirmar === 'aprobar'
                      ? `¿Aprobar a ${detalle.nombre}?`
                      : `¿Rechazar a ${detalle.nombre}?`}
                  </strong>
                  <p>
                    {confirmar === 'aprobar'
                      ? 'Podrá publicar mascotas en adopción.'
                      : 'No podrá publicar mascotas.'}{' '}
                    La decisión es definitiva y queda registrada con tu nombre y la fecha.
                  </p>
                  <div className="form-actions form-actions--left">
                    <VetoButton
                      disabled={decidiendo}
                      onClick={() => setConfirmar(null)}
                      variant="secondary"
                    >
                      Cancelar
                    </VetoButton>
                    <VetoButton loading={decidiendo} onClick={() => void decidir(confirmar)}>
                      {confirmar === 'aprobar' ? 'Sí, aprobar' : 'Sí, rechazar'}
                    </VetoButton>
                  </div>
                </div>
              ) : (
                <div className="form-actions form-actions--left">
                  <VetoButton onClick={() => setConfirmar('rechazar')} variant="secondary">
                    Rechazar
                  </VetoButton>
                  <VetoButton onClick={() => setConfirmar('aprobar')}>Aprobar fundación</VetoButton>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PanelShell>
  );
}
