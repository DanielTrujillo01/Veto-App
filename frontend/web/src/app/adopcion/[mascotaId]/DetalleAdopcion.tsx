'use client';

/**
 * HU-089 · Detalle de una mascota en adopción con sus fotos (y video si lo hay).
 *
 * API: GET /adopciones/:id (solo tutores). La respuesta ya viene anonimizada: no trae nombre,
 * dirección ni ningún dato de la fundación (HU-081). Si la publicación dejó de estar disponible
 * o el id no existe, se muestra un estado informativo en vez de datos viejos.
 */

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { MascotaAdopcionPublica } from '@veto/shared';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { NOMBRE_SEXO, NOMBRE_TAMANO, textoEdad } from '@/lib/adopcion';
import { api, ApiError } from '@/lib/api';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'no-existe' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'no-tutor' }
  | { tipo: 'listo'; mascota: MascotaAdopcionPublica };

function Galeria({ nombre, fotos }: { nombre: string; fotos: string[] }) {
  const [actual, setActual] = useState(0);
  const [fallidas, setFallidas] = useState<number[]>([]);
  const foto = fotos[actual];
  return (
    <div className="product-gallery">
      <div className="product-gallery__main">
        {foto && !fallidas.includes(actual) ? (
          <img
            alt={`${nombre}, foto ${actual + 1} de ${fotos.length}`}
            onError={() => setFallidas((previas) => [...previas, actual])}
            src={foto}
          />
        ) : (
          <span aria-label={`${nombre} sin foto`} className="product-gallery__fallback" role="img">
            ♡
          </span>
        )}
      </div>
      {fotos.length > 1 && (
        <div aria-label="Fotos de la mascota" className="product-gallery__thumbs" role="group">
          {fotos.map((url, i) => (
            <button
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === actual}
              className={i === actual ? 'is-active' : ''}
              key={url}
              onClick={() => setActual(i)}
              type="button"
            >
              {fallidas.includes(i) ? (
                <span aria-hidden="true">♡</span>
              ) : (
                <img alt="" onError={() => setFallidas((previas) => [...previas, i])} src={url} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DetalleAdopcion({ id }: { id: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      setEstado({ tipo: 'listo', mascota: await api<MascotaAdopcionPublica>(`/adopciones/${id}`) });
    } catch (causa) {
      if (causa instanceof ApiError && causa.status === 401)
        return setEstado({ tipo: 'sin-sesion' });
      if (causa instanceof ApiError && causa.status === 403) return setEstado({ tipo: 'no-tutor' });
      if (causa instanceof ApiError && (causa.status === 404 || causa.status === 400)) {
        return setEstado({ tipo: 'no-existe' });
      }
      setEstado({ tipo: 'error' });
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const volver = (
    <Link className="text-action" href="/adopcion#mascotas">
      ← Volver a adopción
    </Link>
  );

  if (estado.tipo === 'cargando') {
    return (
      <div className="clinic-profile" aria-busy="true" aria-label="Cargando mascota">
        <span className="skeleton product-card-skeleton" />
      </div>
    );
  }
  if (estado.tipo === 'sin-sesion' || estado.tipo === 'no-tutor') {
    return (
      <div className="clinic-profile">
        {volver}
        <div className="empty-state catalog-empty">
          <span className="empty-state__illustration" aria-hidden="true">
            ♡
          </span>
          {estado.tipo === 'sin-sesion' ? (
            <>
              <h1>Inicia sesión para conocerla</h1>
              <p>El detalle de cada mascota está disponible para tutores registrados.</p>
              <div className="form-actions">
                <Link
                  className="veto-button veto-button--primary"
                  href={`/ingresar?returnTo=${encodeURIComponent(`/adopcion/${id}`)}`}
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
              <h1>Disponible para tutores</h1>
              <p>Ingresa con una cuenta de tutor para ver el detalle de las mascotas.</p>
            </>
          )}
        </div>
      </div>
    );
  }
  if (estado.tipo === 'no-existe') {
    return (
      <div className="clinic-profile">
        {volver}
        <div className="empty-state catalog-empty">
          <span className="empty-state__illustration" aria-hidden="true">
            ⌂
          </span>
          <h1>Esta mascota ya no está disponible</h1>
          <p>Puede que ya esté en proceso de adopción o que la publicación se haya retirado.</p>
          <Link className="veto-button veto-button--primary" href="/adopcion#mascotas">
            Ver otras mascotas
          </Link>
        </div>
      </div>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <div className="clinic-profile">
        <AlertBox tone="error" title="No pudimos cargar la mascota">
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </div>
    );
  }

  const { mascota } = estado;
  return (
    <div className="clinic-profile">
      {volver}
      <div className="detail-sheet">
        <div className="detail-sheet__media">
          <Galeria fotos={mascota.fotos} nombre={mascota.nombre} />
        </div>
        <section aria-labelledby="adopcion-nombre" className="detail-sheet__info">
          <div className="detail-panel__head">
            <span className="eyebrow eyebrow--dark">
              <i /> BUSCA UN HOGAR
            </span>
            <StatusBadge tone="success">✓ Disponible</StatusBadge>
          </div>
          <h1 id="adopcion-nombre">{mascota.nombre}</h1>
          <div className="detail-sheet__chips">
            <span>{mascota.especie}</span>
            <span>{textoEdad(mascota.edadMeses)}</span>
            <span>{NOMBRE_SEXO[mascota.sexo]}</span>
            <span>{NOMBRE_TAMANO[mascota.tamano]}</span>
          </div>
          <p className="detail-sheet__meta">
            <span>
              <i aria-hidden="true">⌖</i> {mascota.ubicacion}
            </span>
            <span>
              {mascota.fotos.length} {mascota.fotos.length === 1 ? 'foto' : 'fotos'}
              {mascota.videoUrl ? ' · con video' : ''}
            </span>
          </p>
          <p className="detail-sheet__text">
            {mascota.descripcion || 'Su fundación aún no escribió una descripción.'}
          </p>
          <p className="detail-sheet__note">
            <span aria-hidden="true">★</span>
            Por su seguridad no mostramos la dirección ni la fundación que lo cuida.
          </p>
          <div className="detail-sheet__actions">
            <span aria-disabled="true" className="veto-button veto-button--primary is-disabled">
              Solicitar adopción · muy pronto
            </span>
            {mascota.videoUrl && (
              <a
                className="veto-button veto-button--secondary"
                href={mascota.videoUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                ▶ Ver video
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
