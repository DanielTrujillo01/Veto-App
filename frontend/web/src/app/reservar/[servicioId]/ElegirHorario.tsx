'use client';

/**
 * HU-029 · Paso 1: elegir fecha y hora en el calendario del aliado.
 *
 * Solo se muestran los espacios que devuelve GET /aliados/:aliadoId/disponibilidad (horario del
 * aliado, sin bloqueos ni citas). Las fechas pasadas no aparecen. Cada semana es una página
 * (?semana=0, 1, 2…). Al elegir, PUT /reservas/seleccion guarda la hora y se pasa al paso 2;
 * si el tutor vuelve, su hora elegida aparece marcada.
 */

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Disponibilidad,
  EspacioDisponible,
  EstadoSeleccionHorario,
  Servicio,
} from '@veto/shared';
import { IconoFlecha } from '@/components/ui/iconos';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { api, ApiError } from '@/lib/api';
import { diaCorto, diaEnColombia, horaEnColombia, rangoDeCita, sumarDias } from '@/lib/fechas';
import { formatoPrecio } from '@/lib/formato';
import { NOMBRE_MODALIDAD } from '@/lib/servicios';
import { AvisoAcceso, MarcoReserva, tipoDeAcceso } from '../comunes';
import { PasosReserva } from '../PasosReserva';

/** Semanas que se pueden recorrer hacia adelante (unos 3 meses). */
const MAX_SEMANAS = 12;

type Base =
  | { tipo: 'cargando' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'no-existe' }
  | { tipo: 'acceso'; acceso: 'sin-sesion' | 'no-tutor' }
  | {
      tipo: 'listo';
      servicio: Servicio;
      seleccion: EstadoSeleccionHorario | null;
      /** Sin sesión se ven los horarios (son públicos); al elegir se pide ingresar. */
      sinSesion: boolean;
    };

function leerSemana(valor: string | null) {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 0 && n < MAX_SEMANAS ? n : 0;
}

export function ElegirHorario({ servicioId }: { servicioId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const semana = leerSemana(parametros.get('semana'));
  const hoy = diaEnColombia(new Date());
  const desde = sumarDias(hoy, semana * 7);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDias(desde, i)), [desde]);

  const [base, setBase] = useState<Base>({ tipo: 'cargando' });
  const [espacios, setEspacios] = useState<EspacioDisponible[] | null>(null);
  const [errorEspacios, setErrorEspacios] = useState('');
  const [diaElegido, setDiaElegido] = useState('');
  const [veterinarioId, setVeterinarioId] = useState('');
  const [guardando, setGuardando] = useState('');
  const [errorEleccion, setErrorEleccion] = useState('');

  const cargarBase = useCallback(async () => {
    setBase({ tipo: 'cargando' });
    try {
      const servicio = await api<Servicio>(`/servicios/${servicioId}`);
      let seleccion: EstadoSeleccionHorario | null = null;
      let sinSesion = false;
      try {
        seleccion = await api<EstadoSeleccionHorario>('/reservas/seleccion');
      } catch (causa) {
        const acceso = tipoDeAcceso(causa);
        if (acceso === 'no-tutor') return setBase({ tipo: 'acceso', acceso });
        if (acceso === 'sin-sesion') sinSesion = true;
        else if (!(causa instanceof ApiError && causa.status === 404)) throw causa;
      }
      setBase({ tipo: 'listo', servicio, seleccion, sinSesion });
    } catch (causa) {
      if (causa instanceof ApiError && (causa.status === 404 || causa.status === 400)) {
        setBase({ tipo: 'no-existe' });
        return;
      }
      setBase({ tipo: 'error', mensaje: 'No pudimos cargar el servicio. Inténtalo de nuevo.' });
    }
  }, [servicioId]);

  useEffect(() => {
    void cargarBase();
  }, [cargarBase]);

  const aliadoId = base.tipo === 'listo' ? base.servicio.aliadoId : '';

  const cargarEspacios = useCallback(async () => {
    if (!aliadoId) return;
    setEspacios(null);
    setErrorEspacios('');
    const query = new URLSearchParams({ servicioId, desde, hasta: sumarDias(desde, 6) });
    try {
      const disponibilidad = await api<Disponibilidad>(
        `/aliados/${aliadoId}/disponibilidad?${query.toString()}`,
      );
      setEspacios(disponibilidad.espacios);
    } catch {
      setErrorEspacios('No pudimos consultar los horarios. Inténtalo de nuevo.');
    }
  }, [aliadoId, servicioId, desde]);

  useEffect(() => {
    void cargarEspacios();
  }, [cargarEspacios]);

  const veterinarios = useMemo(() => {
    const mapa = new Map<string, string>();
    espacios?.forEach((e) => mapa.set(e.veterinarioId, e.veterinarioNombre));
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [espacios]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, EspacioDisponible[]>();
    espacios
      ?.filter((e) => !veterinarioId || e.veterinarioId === veterinarioId)
      .forEach((e) => {
        const dia = diaEnColombia(e.inicio);
        mapa.set(dia, [...(mapa.get(dia) ?? []), e]);
      });
    return mapa;
  }, [espacios, veterinarioId]);

  // Al cambiar de semana o de filtro, se abre el primer día que tenga horarios.
  const diaVisible =
    diaElegido && porDia.has(diaElegido) ? diaElegido : (dias.find((d) => porDia.has(d)) ?? '');

  async function elegir(espacio: EspacioDisponible) {
    if (base.tipo === 'listo' && base.sinSesion) {
      router.push(`/ingresar?returnTo=${encodeURIComponent(`/reservar/${servicioId}`)}`);
      return;
    }
    const clave = `${espacio.veterinarioId}|${espacio.inicio}`;
    setGuardando(clave);
    setErrorEleccion('');
    try {
      await api<EstadoSeleccionHorario>('/reservas/seleccion', {
        method: 'PUT',
        body: JSON.stringify({
          servicioId,
          veterinarioId: espacio.veterinarioId,
          inicio: espacio.inicio,
        }),
      });
      router.push(`/reservar/${servicioId}/mascota`);
    } catch (causa) {
      const acceso = tipoDeAcceso(causa);
      if (acceso) {
        setBase({ tipo: 'acceso', acceso });
        return;
      }
      setErrorEleccion(
        causa instanceof ApiError ? causa.message : 'No pudimos guardar el horario.',
      );
      // Otra persona pudo tomarlo: se actualiza la lista.
      if (causa instanceof ApiError && causa.status === 409) void cargarEspacios();
    } finally {
      setGuardando('');
    }
  }

  const pasos = <PasosReserva actual={1} servicioId={servicioId} />;
  const volverA = `/reservar/${servicioId}`;

  if (base.tipo === 'cargando') {
    return (
      <MarcoReserva
        servicioId={servicioId}
        descripcion="Cargando el servicio…"
        pasos={pasos}
        titulo="Elige fecha y hora"
      >
        <span className="skeleton service-card-skeleton" />
      </MarcoReserva>
    );
  }
  if (base.tipo === 'acceso') {
    return (
      <MarcoReserva
        servicioId={servicioId}
        descripcion="Reserva en tres pasos."
        pasos={pasos}
        titulo="Elige fecha y hora"
      >
        <AvisoAcceso tipo={base.acceso} volverA={volverA} />
      </MarcoReserva>
    );
  }
  if (base.tipo === 'no-existe') {
    return (
      <MarcoReserva
        servicioId={servicioId}
        descripcion=""
        pasos={null}
        titulo="Este servicio ya no está disponible"
      >
        <div className="empty-state catalog-empty">
          <p>Puede que el aliado lo haya pausado. Mira otros servicios disponibles.</p>
          <Link className="veto-button veto-button--primary" href="/servicios">
            Ver servicios
          </Link>
        </div>
      </MarcoReserva>
    );
  }
  if (base.tipo === 'error') {
    return (
      <MarcoReserva
        servicioId={servicioId}
        descripcion=""
        pasos={pasos}
        titulo="Elige fecha y hora"
      >
        <AlertBox tone="error" title="Algo salió mal">
          {base.mensaje}{' '}
          <VetoButton onClick={() => void cargarBase()} variant="secondary">
            Reintentar
          </VetoButton>
        </AlertBox>
      </MarcoReserva>
    );
  }

  const { servicio, seleccion, sinSesion } = base;
  const seleccionDeEste = seleccion && seleccion.servicioId === servicioId && !seleccion.citaId;
  const espaciosDelDia = porDia.get(diaVisible) ?? [];
  const hrefSemana = (n: number) => (n ? `${pathname}?semana=${n}` : pathname);

  return (
    <MarcoReserva
      servicioId={servicioId}
      descripcion={`${servicio.nombre} · ${NOMBRE_MODALIDAD[servicio.modalidad]} · ${servicio.duracionMin} min · desde ${formatoPrecio(servicio.precioBase)}`}
      pasos={pasos}
      titulo="Elige fecha y hora"
    >
      {sinSesion && (
        <AlertBox tone="info" title="Mira los horarios libres">
          Para apartar uno necesitas una cuenta de tutor.{' '}
          <Link
            className="text-action"
            href={`/ingresar?returnTo=${encodeURIComponent(`/reservar/${servicioId}`)}`}
          >
            Ingresar
          </Link>
        </AlertBox>
      )}
      {seleccionDeEste && (
        <AlertBox
          tone={seleccion.vigente ? 'info' : 'warning'}
          title={seleccion.vigente ? 'Ya elegiste un horario' : 'Tu horario ya no está disponible'}
        >
          {rangoDeCita(seleccion.inicio, seleccion.fin)} con {seleccion.veterinarioNombre}.{' '}
          {seleccion.vigente ? (
            <Link className="text-action" href={`/reservar/${servicioId}/mascota`}>
              Continuar con este horario <IconoFlecha tamano={15} />
            </Link>
          ) : (
            'Elige otro de la lista.'
          )}
        </AlertBox>
      )}

      <section aria-labelledby="calendario-titulo" className="booking-calendar">
        <div className="booking-calendar__head">
          <h2 id="calendario-titulo">
            {diaCorto(dias[0])} – {diaCorto(dias[6])}
          </h2>
          <nav aria-label="Semanas" className="booking-calendar__weeks">
            {semana > 0 ? (
              <Link className="pagination__step" href={hrefSemana(semana - 1)} scroll={false}>
                <IconoFlecha direccion="izquierda" tamano={16} /> Semana anterior
              </Link>
            ) : (
              <span aria-disabled="true" className="pagination__step is-disabled">
                <IconoFlecha direccion="izquierda" tamano={16} /> Semana anterior
              </span>
            )}
            {semana < MAX_SEMANAS - 1 ? (
              <Link className="pagination__step" href={hrefSemana(semana + 1)} scroll={false}>
                Semana siguiente <IconoFlecha tamano={16} />
              </Link>
            ) : (
              <span aria-disabled="true" className="pagination__step is-disabled">
                Semana siguiente <IconoFlecha tamano={16} />
              </span>
            )}
          </nav>
        </div>

        {veterinarios.length > 1 && (
          <label className="field booking-calendar__vet">
            <span>Profesional</span>
            <select
              className="control"
              onChange={(evento) => setVeterinarioId(evento.target.value)}
              value={veterinarioId}
            >
              <option value="">Cualquier profesional</option>
              {veterinarios.map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        <div aria-label="Días de la semana" className="booking-days" role="group">
          {dias.map((dia) => {
            const cantidad = porDia.get(dia)?.length ?? 0;
            const activo = dia === diaVisible;
            return (
              <button
                aria-pressed={activo}
                className={`booking-day${activo ? ' is-active' : ''}`}
                disabled={!espacios || cantidad === 0}
                key={dia}
                onClick={() => setDiaElegido(dia)}
                type="button"
              >
                <strong>{diaCorto(dia)}</strong>
                <small>
                  {!espacios ? '…' : cantidad ? `${cantidad} horarios` : 'Sin horarios'}
                </small>
              </button>
            );
          })}
        </div>

        {errorEleccion && (
          <AlertBox tone="warning" title="No pudimos apartar ese horario">
            {errorEleccion}
          </AlertBox>
        )}

        {errorEspacios ? (
          <AlertBox tone="error" title="No se cargaron los horarios">
            {errorEspacios}{' '}
            <VetoButton onClick={() => void cargarEspacios()} variant="secondary">
              Reintentar
            </VetoButton>
          </AlertBox>
        ) : !espacios ? (
          <div className="booking-slots" aria-label="Cargando horarios">
            {Array.from({ length: 6 }, (_, i) => (
              <span className="skeleton booking-slot-skeleton" key={i} />
            ))}
          </div>
        ) : espaciosDelDia.length === 0 ? (
          <div className="empty-state catalog-empty">
            <h3>No hay horarios libres esta semana</h3>
            <p>
              {semana < MAX_SEMANAS - 1
                ? 'Prueba con la semana siguiente.'
                : 'El aliado no tiene horarios publicados por ahora.'}
            </p>
            {semana < MAX_SEMANAS - 1 && (
              <Link className="veto-button veto-button--secondary" href={hrefSemana(semana + 1)}>
                Ver semana siguiente
              </Link>
            )}
          </div>
        ) : (
          <div
            aria-label={`Horarios del ${diaCorto(diaVisible)}`}
            className="booking-slots"
            role="group"
          >
            {espaciosDelDia.map((espacio) => {
              const clave = `${espacio.veterinarioId}|${espacio.inicio}`;
              const elegido =
                seleccionDeEste &&
                seleccion.inicio === espacio.inicio &&
                seleccion.veterinarioId === espacio.veterinarioId;
              return (
                <button
                  aria-pressed={Boolean(elegido)}
                  className={`booking-slot${elegido ? ' is-active' : ''}`}
                  disabled={Boolean(guardando)}
                  key={clave}
                  onClick={() => void elegir(espacio)}
                  type="button"
                >
                  <strong>
                    {guardando === clave ? 'Apartando…' : horaEnColombia(espacio.inicio)}
                  </strong>
                  <small>{espacio.veterinarioNombre}</small>
                  {elegido && <StatusBadge tone="success">Elegido</StatusBadge>}
                </button>
              );
            })}
          </div>
        )}
      </section>
      <Link className="workspace-back" href={`/servicios/${servicioId}`}>
        Volver al servicio
      </Link>
    </MarcoReserva>
  );
}
