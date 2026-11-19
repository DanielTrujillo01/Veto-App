'use client';

/**
 * HU-028 · Detalle de un servicio: tipo, modalidad, duración, precio, descripción, dónde se presta
 * y precios según la mascota. Desde aquí se continúa a la reserva (HU-029–031).
 *
 * API: GET /servicios/:id (404 si ya no está disponible). Datos complementarios, opcionales:
 * GET /servicios?tipoServicioId (precio "desde" y reglas), GET /mascotas/especies,
 * GET /aliados/clinicas (nombre de la clínica) y GET /aliados/:id/sedes (dirección).
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { Servicio, ServicioConReglas } from '@veto/shared';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { formatoPrecio } from '@/lib/formato';
import { describirRegla, NOMBRE_MODALIDAD } from '@/lib/servicios';

type Sede = { id: string; nombre: string; direccion: string; ciudad: string };
type Extras = {
  conReglas: ServicioConReglas | null;
  especies: Map<number, string>;
  clinica: string | null;
  sede: Sede | null;
};
type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'no-existe' }
  | { tipo: 'listo'; servicio: Servicio; extras: Extras };

/** Un dato complementario que falla no rompe la vista: se muestra sin él. */
const opcional = <T,>(promesa: Promise<T>, respaldo: T) => promesa.catch(() => respaldo);

async function cargarExtras(servicio: Servicio): Promise<Extras> {
  const [catalogo, especies, clinicas, sedes] = await Promise.all([
    opcional(api<ServicioConReglas[]>(`/servicios?tipoServicioId=${servicio.tipoServicioId}`), []),
    opcional(api<{ id: number; nombre: string }[]>('/mascotas/especies'), []),
    opcional(api<{ id: string; nombre: string }[]>('/aliados/clinicas'), []),
    servicio.sedeId
      ? opcional(api<Sede[]>(`/aliados/${servicio.aliadoId}/sedes`), [])
      : Promise.resolve([]),
  ]);
  return {
    conReglas: catalogo.find((s) => s.id === servicio.id) ?? null,
    especies: new Map(especies.map((e) => [e.id, e.nombre])),
    clinica: clinicas.find((c) => c.id === servicio.aliadoId)?.nombre ?? null,
    sede: sedes.find((s) => s.id === servicio.sedeId) ?? null,
  };
}

export function DetalleServicio({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const servicio = await api<Servicio>(`/servicios/${id}`);
      setEstado({ tipo: 'listo', servicio, extras: await cargarExtras(servicio) });
    } catch (causa) {
      const noExiste = causa instanceof ApiError && (causa.status === 404 || causa.status === 400);
      setEstado(noExiste ? { tipo: 'no-existe' } : { tipo: 'error' });
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (estado.tipo === 'cargando') {
    return (
      <div className="clinic-profile" aria-busy="true" aria-label="Cargando servicio">
        <span className="skeleton service-card-skeleton" />
        <span className="skeleton service-card-skeleton" />
      </div>
    );
  }

  if (estado.tipo === 'error') {
    return (
      <div className="clinic-profile">
        <AlertBox tone="error" title="No pudimos cargar el servicio">
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </div>
    );
  }

  if (estado.tipo === 'no-existe') {
    return (
      <div className="clinic-profile">
        <div className="empty-state catalog-empty">
          <span className="empty-state__illustration" aria-hidden="true">
            ✚
          </span>
          <h1>Este servicio ya no está disponible</h1>
          <p>Puede que el aliado lo haya pausado. Mira otros servicios disponibles.</p>
          <Link className="veto-button veto-button--primary" href="/servicios">
            Ver servicios
          </Link>
        </div>
      </div>
    );
  }

  const { servicio, extras } = estado;
  const reglas = extras.conReglas?.reglasPrecio ?? [];
  const precioDesde = extras.conReglas?.precioDesde ?? servicio.precioBase;
  const varia = reglas.length > 0;

  return (
    <div className="clinic-profile">
      <Link className="text-action" href="/servicios">
        ← Volver a servicios
      </Link>
      <div className="clinic-profile__hero">
        <div className="clinic-profile__copy">
          <StatusBadge tone="info">{servicio.tipoServicio}</StatusBadge>
          <h1>{servicio.nombre}</h1>
          <p>
            {extras.clinica ? (
              <>
                Ofrecido por{' '}
                <Link className="text-action" href={`/clinicas/${servicio.aliadoId}`}>
                  {extras.clinica}
                </Link>
              </>
            ) : (
              'Ofrecido por un aliado verificado de Veto.'
            )}
          </p>
        </div>
        <aside aria-label="Reservar" className="clinic-booking-card">
          <span className="eyebrow eyebrow--dark">{varia ? 'PRECIO DESDE' : 'PRECIO'}</span>
          <strong>{formatoPrecio(precioDesde)}</strong>
          <p>
            {NOMBRE_MODALIDAD[servicio.modalidad]} · {servicio.duracionMin} min
          </p>
          <Link className="veto-button veto-button--primary" href={`/reservar/${servicio.id}`}>
            Reservar cita
          </Link>
          <small>
            {varia
              ? 'El precio final depende de tu mascota; lo verás antes de confirmar.'
              : 'Elige fecha y hora en el siguiente paso.'}
          </small>
        </aside>
      </div>

      <div className="detail-columns">
        <section aria-labelledby="servicio-datos" className="detail-panel">
          <h2 id="servicio-datos">Lo que debes saber</h2>
          <dl className="detail-facts">
            <div>
              <dt>Modalidad</dt>
              <dd>{NOMBRE_MODALIDAD[servicio.modalidad]}</dd>
            </div>
            <div>
              <dt>Duración</dt>
              <dd>{servicio.duracionMin} minutos</dd>
            </div>
            <div>
              <dt>Precio base</dt>
              <dd>{formatoPrecio(servicio.precioBase)}</dd>
            </div>
          </dl>
          <p className="product-description">
            {servicio.descripcion || 'El aliado no agregó una descripción para este servicio.'}
          </p>
        </section>

        <div className="detail-side">
          <section aria-labelledby="servicio-lugar" className="detail-panel">
            <h2 id="servicio-lugar">Dónde te atienden</h2>
            {servicio.modalidad === 'A_DOMICILIO' ? (
              <AlertBox tone="info" title="Atención a domicilio">
                El profesional va hasta tu casa. Indicarás la dirección al reservar.
              </AlertBox>
            ) : extras.sede ? (
              <article className="branch-card">
                <span aria-hidden="true">⌖</span>
                <div>
                  <h3>{extras.sede.nombre}</h3>
                  <p>{extras.sede.direccion}</p>
                  <small>{extras.sede.ciudad}</small>
                </div>
              </article>
            ) : (
              <AlertBox tone="info" title="En la sede del aliado">
                Te confirmaremos la dirección al reservar.
              </AlertBox>
            )}
          </section>

          {varia && (
            <section aria-labelledby="servicio-precios" className="detail-panel">
              <h2 id="servicio-precios">Precio según tu mascota</h2>
              <ul className="price-rule-list">
                {reglas.map((regla) => (
                  <li key={regla.id}>
                    <span>{describirRegla(regla, extras.especies)}</span>
                    <strong>{formatoPrecio(regla.precio)}</strong>
                  </li>
                ))}
                <li>
                  <span>Otras mascotas</span>
                  <strong>{formatoPrecio(servicio.precioBase)}</strong>
                </li>
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
