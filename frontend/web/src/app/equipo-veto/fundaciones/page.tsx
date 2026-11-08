'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AlertBox, StatusBadge } from '@/components/ui/veto-components';

const estados = ['Pendientes', 'Aprobadas', 'Rechazadas'] as const;

export default function RevisionFundaciones() {
  const [estado, setEstado] = useState<(typeof estados)[number]>('Pendientes');
  const [seleccionada, setSeleccionada] = useState('');
  const [motivo, setMotivo] = useState('');

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow eyebrow--dark">EQUIPO VETO</p>
          <h1>Revisión de fundaciones</h1>
          <p>Verifica la información antes de habilitar publicaciones de adopción.</p>
        </div>
        <StatusBadge tone="warning">{estado}</StatusBadge>
      </div>
      <AlertBox tone="warning" title="Aprobación pendiente de API">
        El backend todavía no expone endpoints para consultar, aprobar o rechazar solicitudes de
        fundación. Esta pantalla no muestra solicitudes de muestra ni guarda decisiones.
      </AlertBox>
      <div className="workspace-tabs" role="tablist" aria-label="Estado de las fundaciones">
        {estados.map((opcion) => (
          <button
            aria-selected={estado === opcion}
            className={estado === opcion ? 'is-active' : ''}
            key={opcion}
            onClick={() => {
              setEstado(opcion);
              setSeleccionada('');
            }}
            role="tab"
            type="button"
          >
            {opcion}
          </button>
        ))}
      </div>
      <div className="admin-review-layout">
        <section className="workspace-card admin-queue">
          <div className="workspace-card__title-row">
            <div>
              <h2>{estado}</h2>
              <p className="workspace-card__intro">Solicitudes de aliados Fundación</p>
            </div>
            <span className="status-badge status-badge--neutral">0 solicitudes</span>
          </div>
          <div className="empty-state empty-state--compact">
            <span className="empty-state__illustration" aria-hidden="true">
              ⌂
            </span>
            <h3>No hay solicitudes para revisar</h3>
            <p>Las solicitudes aparecerán aquí cuando estén conectadas a la API.</p>
          </div>
        </section>
        <section className="workspace-card admin-detail">
          {seleccionada ? (
            <>
              <h2>Detalle de la solicitud</h2>
              <label className="field">
                <span>Motivo del rechazo</span>
                <textarea
                  className="control textarea"
                  maxLength={1000}
                  onChange={(event) => setMotivo(event.target.value)}
                  value={motivo}
                />
              </label>
              <div className="unsupported-note">
                <strong>Decisión no disponible</strong>
                <span>
                  La API aún no permite registrar aprobaciones ni rechazos. Tu texto no se guardará.
                </span>
              </div>
            </>
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>Selecciona una solicitud</h3>
              <p>Podrás revisar contacto, descripción y ubicación cuando exista soporte de API.</p>
            </div>
          )}
        </section>
      </div>
      <p className="field__hint">
        Solo las fundaciones aprobadas pueden publicar mascotas. Las decisiones deben conservar
        quién las tomó y cuándo.
      </p>
      <p className="workspace-back">
        <Link href="/">Volver al inicio</Link>
      </p>
    </div>
  );
}
