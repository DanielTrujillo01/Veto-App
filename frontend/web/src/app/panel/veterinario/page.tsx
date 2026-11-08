'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ConsultaResumen, PaginaConsultas, PerfilVeterinario } from '@veto/shared';
import { AlertBox, Avatar, StatusBadge } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';

export default function PanelVeterinario() {
  const [perfil, setPerfil] = useState<PerfilVeterinario | null>(null);
  const [consultas, setConsultas] = useState<ConsultaResumen[]>([]);
  const [estado, setEstado] = useState<'todas' | 'ABIERTA' | 'CERRADA'>('todas');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [perfilVet, pagina] = await Promise.all([
        api<PerfilVeterinario>('/veterinarios/me'),
        api<PaginaConsultas>(
          `/veterinarios/me/consultas?limite=100${estado === 'todas' ? '' : `&estado=${estado}`}`,
        ),
      ]);
      setPerfil(perfilVet);
      setConsultas(pagina.items);
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos cargar tus consultas. Verifica tu sesión e inténtalo de nuevo.',
      );
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  return (
    <div className="workspace-page">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow eyebrow--dark">ESPACIO DEL PROFESIONAL</p>
          <h1>Mis consultas</h1>
          <p>Consulta la atención asignada a tu perfil.</p>
        </div>
        {perfil && (
          <div className="person-summary">
            <Avatar image={perfil.fotoUrl ?? undefined} name={perfil.usuario.nombre} />
            <div>
              <strong>{perfil.usuario.nombre}</strong>
              <span>{perfil.aliado.nombre}</span>
            </div>
          </div>
        )}
      </div>
      {error && (
        <AlertBox tone="error" title="No se pudo cargar el panel">
          {error}
        </AlertBox>
      )}
      <section className="workspace-card">
        <div className="workspace-card__title-row">
          <div>
            <h2>Atenciones recientes</h2>
            <p className="workspace-card__intro">
              Solo aparecen las consultas asociadas a tu perfil.
            </p>
          </div>
          <label className="field field--inline">
            <span>Estado</span>
            <select
              className="control"
              onChange={(event) => setEstado(event.target.value as typeof estado)}
              value={estado}
            >
              <option value="todas">Todas</option>
              <option value="ABIERTA">Abiertas</option>
              <option value="CERRADA">Cerradas</option>
            </select>
          </label>
        </div>
        {cargando ? (
          <div className="workspace-loading">
            <span className="skeleton pet-skeleton-line" />
            <span className="skeleton pet-skeleton-line" />
          </div>
        ) : consultas.length ? (
          <div className="entity-list">
            {consultas.map((consulta) => (
              <article className="entity-row" key={consulta.id}>
                <div>
                  <h3>
                    {consulta.mascota.nombre}{' '}
                    <span className="entity-subtle">· {consulta.mascota.especie}</span>
                  </h3>
                  <p>
                    {consulta.servicio} · {consulta.motivoConsulta || 'Sin motivo registrado'}
                  </p>
                  <small>
                    {new Intl.DateTimeFormat('es-CO', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(consulta.fecha))}
                  </small>
                </div>
                <StatusBadge tone={consulta.estado === 'ABIERTA' ? 'warning' : 'neutral'}>
                  {consulta.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}
                </StatusBadge>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--compact">
            <span className="empty-state__illustration" aria-hidden="true">
              ♡
            </span>
            <h3>
              Aún no tienes consultas{' '}
              {estado === 'todas' ? '' : estado === 'ABIERTA' ? 'abiertas' : 'cerradas'}
            </h3>
            <p>Cuando tengas una atención asignada, aparecerá aquí.</p>
          </div>
        )}
      </section>
      <p className="workspace-back">
        <Link href="/">Volver al inicio</Link>
      </p>
    </div>
  );
}
