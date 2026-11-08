'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertBox, StatusBadge } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';

type Clinica = { id: string; nombre: string; descripcion: string | null };

export default function Clinicas() {
  const [clinicas, setClinicas] = useState<Clinica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Clinica[]>('/aliados/clinicas')
      .then(setClinicas)
      .catch((causa: unknown) =>
        setError(
          causa instanceof ApiError ? causa.message : 'No pudimos cargar las clínicas disponibles.',
        ),
      )
      .finally(() => setCargando(false));
  }, []);

  return (
    <div className="workspace-page">
      <header className="workspace-heading">
        <div>
          <p className="eyebrow eyebrow--dark">ALIADOS VETO</p>
          <h1>Encuentra una clínica</h1>
          <p>Conoce su equipo veterinario y revisa sus opciones de atención.</p>
        </div>
      </header>
      {error && (
        <AlertBox tone="error" title="No se pudo cargar el directorio">
          {error}
        </AlertBox>
      )}
      {cargando ? (
        <div className="clinic-grid" aria-label="Cargando clínicas">
          {[1, 2, 3].map((item) => (
            <span className="skeleton clinic-skeleton" key={item} />
          ))}
        </div>
      ) : clinicas.length ? (
        <div className="clinic-grid">
          {clinicas.map((clinica) => (
            <article className="clinic-card" key={clinica.id}>
              <span className="clinic-card__mark" aria-hidden="true">
                ✚
              </span>
              <StatusBadge tone="success">Aliado verificado</StatusBadge>
              <h2>{clinica.nombre}</h2>
              <p>
                {clinica.descripcion || 'Una clínica comprometida con el bienestar de tu mascota.'}
              </p>
              <Link className="text-action" href={`/clinicas/${clinica.id}`}>
                Conocer clínica
              </Link>
            </article>
          ))}
        </div>
      ) : !error ? (
        <div className="empty-state">
          <span className="empty-state__illustration" aria-hidden="true">
            ⌖
          </span>
          <h2>Estamos sumando clínicas a Veto</h2>
          <p>Cuando haya clínicas disponibles en tu zona, las encontrarás aquí.</p>
        </div>
      ) : null}
    </div>
  );
}
