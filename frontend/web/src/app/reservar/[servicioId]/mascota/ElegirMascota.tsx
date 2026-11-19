'use client';

/**
 * HU-030 / HU-031 · Paso 2: la mascota de la cita y el motivo en texto libre (máx. 500).
 *
 * API: GET /reservas/seleccion (lo elegido; 404 si no hay o venció), GET /mascotas y
 * PATCH /reservas/seleccion { mascotaId, motivo }. El contador muestra los caracteres usados y
 * avisa al llegar al límite; la API valida igual.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  caracteresRestantesDelMotivo,
  MOTIVO_CITA_MAX_CARACTERES,
  type EstadoSeleccionHorario,
  type Mascota,
} from '@veto/shared';
import { AlertBox, Avatar, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { rangoDeCita } from '@/lib/fechas';
import { AvisoAcceso, MarcoReserva, tipoDeAcceso } from '../../comunes';
import { PasosReserva } from '../../PasosReserva';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'error' }
  | { tipo: 'sin-horario' }
  | { tipo: 'acceso'; acceso: 'sin-sesion' | 'no-tutor' }
  | { tipo: 'listo'; seleccion: EstadoSeleccionHorario; mascotas: Mascota[] };

export function ElegirMascota({ servicioId }: { servicioId: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [mascotaId, setMascotaId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setEstado({ tipo: 'cargando' });
    try {
      const [seleccion, mascotas] = await Promise.all([
        api<EstadoSeleccionHorario>('/reservas/seleccion'),
        api<Mascota[]>('/mascotas'),
      ]);
      if (seleccion.citaId) {
        router.replace(`/citas/${seleccion.citaId}`);
        return;
      }
      setMascotaId(seleccion.mascotaId ?? (mascotas.length === 1 ? mascotas[0].id : ''));
      setMotivo(seleccion.motivo ?? '');
      setEstado({ tipo: 'listo', seleccion, mascotas });
    } catch (causa) {
      const acceso = tipoDeAcceso(causa);
      if (acceso) return setEstado({ tipo: 'acceso', acceso });
      if (causa instanceof ApiError && causa.status === 404)
        return setEstado({ tipo: 'sin-horario' });
      setEstado({ tipo: 'error' });
    }
  }, [router]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function continuar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!mascotaId) {
      setErrores({ mascotaId: 'Elige la mascota que llevarás a la cita.' });
      return;
    }
    setErrores({});
    setGuardando(true);
    try {
      await api('/reservas/seleccion', {
        method: 'PATCH',
        body: JSON.stringify({ mascotaId, motivo: motivo.trim() || null }),
      });
      router.push(`/reservar/${servicioId}/confirmar`);
    } catch (causa) {
      if (causa instanceof ApiError && causa.status === 404) {
        setEstado({ tipo: 'sin-horario' });
      } else if (causa instanceof ApiError) {
        setErrores(
          Object.keys(causa.fieldErrors).length ? causa.fieldErrors : { general: causa.message },
        );
      } else {
        setErrores({ general: 'No pudimos guardar los datos. Inténtalo de nuevo.' });
      }
    } finally {
      setGuardando(false);
    }
  }

  const pasos = <PasosReserva actual={2} servicioId={servicioId} />;
  const titulo = '¿Quién viene a la cita?';

  if (estado.tipo === 'cargando') {
    return (
      <MarcoReserva
        servicioId={servicioId}
        descripcion="Cargando tu reserva…"
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
        <AvisoAcceso tipo={estado.acceso} volverA={`/reservar/${servicioId}/mascota`} />
      </MarcoReserva>
    );
  }
  if (estado.tipo === 'sin-horario') {
    return (
      <MarcoReserva servicioId={servicioId} descripcion="" pasos={pasos} titulo={titulo}>
        <AlertBox tone="warning" title="Primero elige fecha y hora">
          No tienes un horario elegido o ya venció (se guarda una hora).{' '}
          <Link className="text-action" href={`/reservar/${servicioId}`}>
            Elegir horario
          </Link>
        </AlertBox>
      </MarcoReserva>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <MarcoReserva servicioId={servicioId} descripcion="" pasos={pasos} titulo={titulo}>
        <AlertBox tone="error" title="No pudimos cargar tu reserva">
          <VetoButton onClick={() => void cargar()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </MarcoReserva>
    );
  }

  const { seleccion, mascotas } = estado;
  const usados = MOTIVO_CITA_MAX_CARACTERES - caracteresRestantesDelMotivo(motivo);
  const enLimite = usados >= MOTIVO_CITA_MAX_CARACTERES;

  return (
    <MarcoReserva
      servicioId={servicioId}
      descripcion={`${seleccion.servicioNombre} · ${rangoDeCita(seleccion.inicio, seleccion.fin)} · ${seleccion.veterinarioNombre}`}
      pasos={pasos}
      titulo={titulo}
    >
      {!seleccion.vigente && (
        <AlertBox tone="warning" title="Tu horario ya no está disponible">
          Otra persona lo tomó o el aliado lo cerró.{' '}
          <Link className="text-action" href={`/reservar/${servicioId}`}>
            Elegir otro horario
          </Link>
        </AlertBox>
      )}

      <form className="booking-form" noValidate onSubmit={continuar}>
        <fieldset className="booking-fieldset">
          <legend>Mascota *</legend>
          {mascotas.length === 0 ? (
            <AlertBox tone="info" title="Aún no tienes mascotas registradas">
              Regístrala para poder reservar.{' '}
              <Link className="text-action" href="/mascotas">
                Registrar mascota
              </Link>
            </AlertBox>
          ) : (
            <div className="booking-pets">
              {mascotas.map((mascota) => (
                <label
                  className={`booking-pet${mascotaId === mascota.id ? ' is-active' : ''}`}
                  key={mascota.id}
                >
                  <input
                    checked={mascotaId === mascota.id}
                    name="mascotaId"
                    onChange={() => setMascotaId(mascota.id)}
                    type="radio"
                    value={mascota.id}
                  />
                  <Avatar image={mascota.fotos[0]} name={mascota.nombre} />
                  <span>
                    <strong>{mascota.nombre}</strong>
                    <small>
                      {mascota.especie}
                      {mascota.raza ? ` · ${mascota.raza}` : ''}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {errores.mascotaId && <small className="field-error">{errores.mascotaId}</small>}
        </fieldset>

        <label className="field">
          <span>Motivo de la cita (opcional)</span>
          <textarea
            aria-describedby="motivo-contador"
            aria-invalid={Boolean(errores.motivo)}
            className={`control textarea${errores.motivo ? ' control--error' : ''}`}
            maxLength={MOTIVO_CITA_MAX_CARACTERES}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Cuéntale al profesional qué le pasa a tu mascota o qué necesitas."
            rows={4}
            value={motivo}
          />
          <small
            aria-live="polite"
            className={`character-count${enLimite ? ' character-count--limit' : ''}`}
            id="motivo-contador"
          >
            {usados}/{MOTIVO_CITA_MAX_CARACTERES}
            {enLimite ? ' · Llegaste al límite de caracteres.' : ''}
          </small>
          {errores.motivo && <small className="field-error">{errores.motivo}</small>}
        </label>

        {errores.general && (
          <AlertBox tone="error" title="No pudimos continuar">
            {errores.general}
          </AlertBox>
        )}

        <div className="form-actions">
          <Link className="veto-button veto-button--secondary" href={`/reservar/${servicioId}`}>
            Cambiar horario
          </Link>
          <VetoButton
            disabled={mascotas.length === 0 || !seleccion.vigente}
            loading={guardando}
            type="submit"
          >
            Revisar y confirmar
          </VetoButton>
        </div>
      </form>
    </MarcoReserva>
  );
}
