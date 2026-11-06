'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { EspecieAtendida, ModoConfirmacion, Servicio, Sede } from '@veto/shared';
import { api, ApiError } from '@/lib/api';
import { AlertBox, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { BrandLogo } from '@/components/BrandLogo';

type Seccion = 'resumen' | 'equipo' | 'sedes' | 'servicios' | 'horarios' | 'especies' | 'citas';
type Veterinario = {
  id: string;
  nombre: string;
  fotoUrl: string | null;
  descripcion: string | null;
};
type TipoServicio = { id: number; nombre: string };
type Franja = { diaSemana: number; horaInicio: string; horaFin: string; vigenteDesde: string };

const dias = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 7, nombre: 'Domingo' },
];
const navegacion: { id: Seccion; etiqueta: string; icono: string }[] = [
  { id: 'resumen', etiqueta: 'Resumen', icono: '⌂' },
  { id: 'equipo', etiqueta: 'Veterinarios', icono: '✳' },
  { id: 'sedes', etiqueta: 'Sedes', icono: '⌖' },
  { id: 'servicios', etiqueta: 'Servicios', icono: '♡' },
  { id: 'horarios', etiqueta: 'Disponibilidad', icono: '◷' },
  { id: 'especies', etiqueta: 'Especies', icono: '⌁' },
  { id: 'citas', etiqueta: 'Confirmación de citas', icono: '▦' },
];

export default function PanelAliado() {
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [aliadoId, setAliadoId] = useState('');
  const [aliadoNombre, setAliadoNombre] = useState('');
  const [aliadoEstado, setAliadoEstado] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tipos, setTipos] = useState<TipoServicio[]>([]);
  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([]);
  const [especies, setEspecies] = useState<{ id: number; nombre: string }[]>([]);
  const [especiesSeleccionadas, setEspeciesSeleccionadas] = useState<number[]>([]);
  const [modo, setModo] = useState<ModoConfirmacion>('MANUAL');
  const [veterinarioId, setVeterinarioId] = useState('');
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [modal, setModal] = useState<
    'sede' | 'servicio' | 'veterinario' | 'perfilVeterinario' | null
  >(null);
  const [confirmacionPendiente, setConfirmacionPendiente] = useState<
    { tipo: 'sede'; item: Sede } | { tipo: 'servicio'; item: Servicio } | null
  >(null);
  const [sedeEditando, setSedeEditando] = useState<Sede | null>(null);
  const [servicioEditando, setServicioEditando] = useState<Servicio | null>(null);
  const [veterinarioEditando, setVeterinarioEditando] = useState<Veterinario | null>(null);
  const [sedeForm, setSedeForm] = useState({ nombre: '', direccion: '', ciudad: 'Bogotá' });
  const [servicioForm, setServicioForm] = useState({
    tipoServicioId: '',
    nombre: '',
    descripcion: '',
    modalidad: 'EN_SEDE',
    sedeId: '',
    duracionMin: '60',
    precioBase: '',
  });
  const [veterinarioForm, setVeterinarioForm] = useState({
    nombre: '',
    celular: '',
    correo: '',
    contrasena: '',
    fotoUrl: '',
    descripcion: '',
  });
  const [perfilVeterinarioForm, setPerfilVeterinarioForm] = useState({
    fotoUrl: '',
    descripcion: '',
  });
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    void api<{
      aliado: { id: string; nombre: string; estado: string };
    }>('/aliados/me')
      .then(({ aliado }) => {
        if (!vigente) return;
        setAliadoId(aliado.id);
        setAliadoNombre(aliado.nombre);
        setAliadoEstado(aliado.estado);
      })
      .catch((causa: unknown) => {
        if (!vigente) return;
        setError(
          causa instanceof ApiError && causa.status === 401
            ? 'Inicia sesión con la cuenta de administrador del aliado para continuar.'
            : causa instanceof ApiError && causa.status === 403
              ? 'Esta sección es exclusiva para cuentas administradoras de aliados.'
              : causa instanceof ApiError && causa.status === 404
                ? 'Tu cuenta no tiene un perfil de aliado asociado. Si acabas de registrarte, contacta al equipo de Veto para revisar tu solicitud.'
                : causa instanceof ApiError
                  ? causa.message
                  : 'No pudimos cargar el perfil de tu aliado. Revisa la conexión con la API.',
        );
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });

    return () => {
      vigente = false;
    };
  }, []);

  const titulo = useMemo(
    () => navegacion.find((item) => item.id === seccion)?.etiqueta ?? 'Resumen',
    [seccion],
  );

  const cargar = useCallback(async () => {
    if (!aliadoId || aliadoEstado !== 'ACTIVO') return;
    setCargando(true);
    setError('');
    try {
      if (seccion === 'resumen') {
        const [listaServicios, listaSedes, equipo] = await Promise.all([
          api<Servicio[]>(`/aliados/${aliadoId}/servicios/gestion`),
          api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`),
          api<{ veterinarios: Veterinario[] }>(`/aliados/${aliadoId}/veterinarios`),
        ]);
        setServicios(listaServicios);
        setSedes(listaSedes);
        setVeterinarios(equipo.veterinarios);
      } else if (seccion === 'equipo') {
        const equipo = await api<{ veterinarios: Veterinario[] }>(
          `/aliados/${aliadoId}/veterinarios`,
        );
        setVeterinarios(equipo.veterinarios);
      } else if (seccion === 'sedes') {
        setSedes(await api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`));
      } else if (seccion === 'servicios') {
        const [lista, tiposServicio, listaSedes] = await Promise.all([
          api<Servicio[]>(`/aliados/${aliadoId}/servicios/gestion`),
          api<TipoServicio[]>('/servicios/tipos'),
          api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`),
        ]);
        setServicios(lista);
        setTipos(tiposServicio);
        setSedes(listaSedes.filter((sede) => sede.activa));
      } else if (seccion === 'horarios') {
        const equipo = await api<{ veterinarios: Veterinario[] }>(
          `/aliados/${aliadoId}/veterinarios`,
        );
        setVeterinarios(equipo.veterinarios);
        if (equipo.veterinarios[0]) {
          setVeterinarioId(equipo.veterinarios[0].id);
          const horarios = await api<
            { diaSemana: number; horaInicio: string; horaFin: string; vigenteDesde: string }[]
          >(`/aliados/${aliadoId}/veterinarios/${equipo.veterinarios[0].id}/horarios`);
          setFranjas(
            horarios.map((horario) => ({
              ...horario,
              horaInicio: horario.horaInicio.slice(0, 5),
              horaFin: horario.horaFin.slice(0, 5),
              vigenteDesde: horario.vigenteDesde?.slice(0, 10) ?? '',
            })),
          );
        } else {
          setFranjas([]);
        }
      } else if (seccion === 'especies') {
        const [catalogo, atendidas] = await Promise.all([
          api<{ id: number; nombre: string }[]>('/mascotas/especies'),
          api<EspecieAtendida[]>(`/aliados/${aliadoId}/especies`),
        ]);
        setEspecies(catalogo);
        setEspeciesSeleccionadas(atendidas.map((especie) => especie.id));
      } else if (seccion === 'citas') {
        const resultado = await api<{ modo: ModoConfirmacion }>(
          `/aliados/${aliadoId}/confirmacion`,
        );
        setModo(resultado.modo);
      }
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos cargar esta sección. Revisa la conexión con la API.',
      );
    } finally {
      setCargando(false);
    }
  }, [aliadoEstado, aliadoId, seccion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardarSede(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCargando(true);
    setError('');
    try {
      const path = `/aliados/${aliadoId}/sedes${sedeEditando ? `/${sedeEditando.id}` : ''}`;
      await api<Sede>(path, {
        method: sedeEditando ? 'PUT' : 'POST',
        body: JSON.stringify(sedeForm),
      });
      setModal(null);
      setExito(sedeEditando ? 'La sede se actualizó.' : 'La sede se creó.');
      await cargar();
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos guardar la sede.');
    } finally {
      setCargando(false);
    }
  }

  function cambiarSede(sede: Sede) {
    setConfirmacionPendiente({ tipo: 'sede', item: sede });
  }

  async function guardarServicio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      tipoServicioId: Number(servicioForm.tipoServicioId),
      nombre: servicioForm.nombre,
      descripcion: servicioForm.descripcion || undefined,
      modalidad: servicioForm.modalidad,
      sedeId: servicioForm.modalidad === 'EN_SEDE' ? servicioForm.sedeId : undefined,
      duracionMin: Number(servicioForm.duracionMin),
      precioBase: Number(servicioForm.precioBase),
    };
    setError('');
    setCargando(true);
    try {
      const path = `/aliados/${aliadoId}/servicios${servicioEditando ? `/${servicioEditando.id}` : ''}`;
      await api<Servicio>(path, {
        method: servicioEditando ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setModal(null);
      setExito(servicioEditando ? 'El servicio se actualizó.' : 'El servicio quedó creado.');
      await cargar();
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos guardar el servicio.');
    } finally {
      setCargando(false);
    }
  }

  async function alternarServicio(servicio: Servicio) {
    if (servicio.activo) {
      setConfirmacionPendiente({ tipo: 'servicio', item: servicio });
      return;
    }
    setError('');
    try {
      await api(
        `/aliados/${aliadoId}/servicios/${servicio.id}/${servicio.activo ? 'desactivar' : 'activar'}`,
        {
          method: 'PATCH',
        },
      );
      setExito(
        servicio.activo
          ? 'El servicio ya no se ofrecerá para nuevas reservas. Las citas existentes no cambian.'
          : 'El servicio volvió a estar disponible.',
      );
      await cargar();
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos actualizar el servicio.');
    }
  }

  async function confirmarDesactivacion() {
    if (!confirmacionPendiente) return;
    setError('');
    setCargando(true);
    try {
      if (confirmacionPendiente.tipo === 'sede') {
        await api(`/aliados/${aliadoId}/sedes/${confirmacionPendiente.item.id}/desactivar`, {
          method: 'PATCH',
        });
        setExito('La sede dejó de ofrecerse como disponible.');
      } else {
        await api(`/aliados/${aliadoId}/servicios/${confirmacionPendiente.item.id}/desactivar`, {
          method: 'PATCH',
        });
        setExito(
          'El servicio ya no se ofrecerá para nuevas reservas. Las citas históricas no cambian.',
        );
      }
      setConfirmacionPendiente(null);
      await cargar();
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos desactivar el elemento.');
    } finally {
      setCargando(false);
    }
  }

  async function crearVeterinario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      await api(`/aliados/${aliadoId}/veterinarios`, {
        method: 'POST',
        body: JSON.stringify({
          ...veterinarioForm,
          fotoUrl: veterinarioForm.fotoUrl.trim() || undefined,
          descripcion: veterinarioForm.descripcion.trim() || undefined,
        }),
      });
      setModal(null);
      setExito('El perfil veterinario quedó creado.');
      setVeterinarioForm({
        nombre: '',
        celular: '',
        correo: '',
        contrasena: '',
        fotoUrl: '',
        descripcion: '',
      });
      await cargar();
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos agregar al veterinario.');
    } finally {
      setCargando(false);
    }
  }

  async function guardarPerfilVeterinario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!veterinarioEditando) return;
    setError('');
    setCargando(true);
    try {
      await api(`/aliados/${aliadoId}/veterinarios/${veterinarioEditando.id}/perfil`, {
        method: 'PUT',
        body: JSON.stringify({
          fotoUrl: perfilVeterinarioForm.fotoUrl.trim() || null,
          descripcion: perfilVeterinarioForm.descripcion.trim() || null,
        }),
      });
      setModal(null);
      setExito('El perfil veterinario se actualizó.');
      await cargar();
    } catch (causa) {
      setError(
        causa instanceof ApiError ? causa.message : 'No pudimos actualizar el perfil veterinario.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function guardarEspecies() {
    setError('');
    try {
      await api(`/aliados/${aliadoId}/especies`, {
        method: 'PUT',
        body: JSON.stringify({ especieIds: especiesSeleccionadas }),
      });
      setExito('Las especies atendidas se actualizaron.');
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos guardar las especies.');
    }
  }

  async function guardarConfirmacion() {
    setError('');
    try {
      await api(`/aliados/${aliadoId}/confirmacion`, {
        method: 'PUT',
        body: JSON.stringify({ modo }),
      });
      setExito('La preferencia aplica a las nuevas reservas.');
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos guardar la preferencia.');
    }
  }

  async function guardarHorarios() {
    if (!veterinarioId || !franjas.length) {
      setError('Agrega por lo menos una franja de atención.');
      return;
    }
    setError('');
    try {
      await api(`/aliados/${aliadoId}/veterinarios/${veterinarioId}/horarios`, {
        method: 'PUT',
        body: JSON.stringify({
          horarios: franjas.map(({ diaSemana, horaInicio, horaFin, vigenteDesde }) => ({
            diaSemana,
            horaInicio,
            horaFin,
            ...(vigenteDesde ? { vigenteDesde } : {}),
          })),
        }),
      });
      setExito('Los horarios quedaron guardados. No se podrán reservar citas por fuera de ellos.');
    } catch (causa) {
      setError(causa instanceof ApiError ? causa.message : 'No pudimos guardar los horarios.');
    }
  }

  function abrirSede(sede?: Sede) {
    setSedeEditando(sede ?? null);
    setSedeForm(
      sede
        ? { nombre: sede.nombre, direccion: sede.direccion, ciudad: sede.ciudad }
        : { nombre: '', direccion: '', ciudad: 'Bogotá' },
    );
    setModal('sede');
  }

  function abrirServicio(servicio?: Servicio) {
    setServicioEditando(servicio ?? null);
    setServicioForm(
      servicio
        ? {
            tipoServicioId: String(servicio.tipoServicioId),
            nombre: servicio.nombre,
            descripcion: servicio.descripcion ?? '',
            modalidad: servicio.modalidad,
            sedeId: servicio.sedeId ?? '',
            duracionMin: String(servicio.duracionMin),
            precioBase: String(servicio.precioBase),
          }
        : {
            tipoServicioId: '',
            nombre: '',
            descripcion: '',
            modalidad: 'EN_SEDE',
            sedeId: '',
            duracionMin: '60',
            precioBase: '',
          },
    );
    setModal('servicio');
  }

  const contenido = () => {
    if (cargando) {
      return (
        <div className="workspace-card workspace-loading">
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line" />
          <span className="skeleton pet-skeleton-line pet-skeleton-line--short" />
        </div>
      );
    }
    if (seccion === 'resumen') {
      return (
        <>
          <div className="summary-grid">
            {[
              ['Servicios', servicios.length, 'Gestiona precios y disponibilidad'],
              [
                'Sedes activas',
                sedes.filter((sede) => sede.activa).length,
                'Ubicaciones de atención',
              ],
              ['Equipo', veterinarios.length, 'Perfiles veterinarios'],
            ].map(([label, valor, detalle]) => (
              <button
                className="summary-card"
                key={label}
                onClick={() =>
                  setSeccion(
                    label === 'Servicios'
                      ? 'servicios'
                      : label === 'Sedes activas'
                        ? 'sedes'
                        : 'equipo',
                  )
                }
                type="button"
              >
                <span>{label}</span>
                <strong>{valor}</strong>
                <small>{detalle}</small>
              </button>
            ))}
          </div>
          <section className="workspace-card">
            <h2>Continúa configurando tu perfil</h2>
            <p className="workspace-card__intro">
              Completa la información de tu aliado para que los tutores encuentren tus servicios.
            </p>
            <div className="quick-actions">
              {navegacion.slice(1).map((item) => (
                <button key={item.id} onClick={() => setSeccion(item.id)} type="button">
                  <span>{item.icono}</span>
                  {item.etiqueta}
                </button>
              ))}
            </div>
          </section>
        </>
      );
    }
    if (seccion === 'equipo') {
      return (
        <section className="workspace-card">
          <div className="workspace-card__title-row">
            <div>
              <h2>Equipo veterinario</h2>
              <p className="workspace-card__intro">
                Gestiona las personas que atienden en tu clínica.
              </p>
            </div>
            <VetoButton onClick={() => setModal('veterinario')}>＋ Agregar veterinario</VetoButton>
          </div>
          {veterinarios.length ? (
            <div className="person-list">
              {veterinarios.map((veterinario) => (
                <article className="person-row" key={veterinario.id}>
                  {veterinario.fotoUrl ? (
                    <span
                      aria-label={`Foto de ${veterinario.nombre}`}
                      className="avatar person-avatar-photo"
                      role="img"
                      style={{ backgroundImage: `url("${veterinario.fotoUrl}")` }}
                    />
                  ) : (
                    <span className="avatar">{veterinario.nombre.slice(0, 1).toUpperCase()}</span>
                  )}
                  <div>
                    <strong>{veterinario.nombre}</strong>
                    <p>{veterinario.descripcion || 'Descripción no disponible.'}</p>
                  </div>
                  <StatusBadge tone="success">Activo</StatusBadge>
                  <button
                    className="text-action person-row__edit"
                    onClick={() => {
                      setVeterinarioEditando(veterinario);
                      setPerfilVeterinarioForm({
                        fotoUrl: veterinario.fotoUrl ?? '',
                        descripcion: veterinario.descripcion ?? '',
                      });
                      setModal('perfilVeterinario');
                    }}
                    type="button"
                  >
                    Editar perfil
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <span className="empty-state__illustration" aria-hidden="true">
                ✳
              </span>
              <h3>Aún no has agregado veterinarios</h3>
              <p>Agrega al equipo para que los tutores conozcan quién cuidará de sus mascotas.</p>
            </div>
          )}
        </section>
      );
    }
    if (seccion === 'sedes') {
      return (
        <section className="workspace-card">
          <div className="workspace-card__title-row">
            <div>
              <h2>Tus sedes</h2>
              <p className="workspace-card__intro">
                Administra las ubicaciones disponibles para tus servicios.
              </p>
            </div>
            <VetoButton onClick={() => abrirSede()}>＋ Crear sede</VetoButton>
          </div>
          {sedes.length ? (
            <div className="entity-list">
              {sedes.map((sede) => (
                <article className="entity-row" key={sede.id}>
                  <div>
                    <h3>{sede.nombre}</h3>
                    <p>
                      {sede.direccion} · {sede.ciudad}
                    </p>
                  </div>
                  <StatusBadge tone={sede.activa ? 'success' : 'neutral'}>
                    {sede.activa ? 'Activa' : 'Inactiva'}
                  </StatusBadge>
                  <div className="entity-actions">
                    <button className="text-action" onClick={() => abrirSede(sede)} type="button">
                      Editar
                    </button>
                    {sede.activa && (
                      <button
                        className="text-action text-action--danger"
                        onClick={() => void cambiarSede(sede)}
                        type="button"
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>Aún no tienes sedes</h3>
              <p>Agrega una ubicación para habilitar servicios presenciales.</p>
            </div>
          )}
        </section>
      );
    }
    if (seccion === 'servicios') {
      const visibles = servicios.filter(
        (servicio) =>
          (filtroEstado === 'todos' || String(servicio.activo) === filtroEstado) &&
          (filtroTipo === 'todos' || servicio.tipoServicio === filtroTipo),
      );
      return (
        <section className="workspace-card">
          <div className="workspace-card__title-row">
            <div>
              <h2>Servicios</h2>
              <p className="workspace-card__intro">
                Crea y actualiza la oferta que verán los tutores.
              </p>
            </div>
            <VetoButton onClick={() => abrirServicio()}>＋ Crear servicio</VetoButton>
          </div>
          <div className="list-toolbar">
            <label className="field field--inline">
              <span>Estado</span>
              <select
                className="control"
                onChange={(event) => setFiltroEstado(event.target.value)}
                value={filtroEstado}
              >
                <option value="todos">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </label>
            <label className="field field--inline">
              <span>Tipo</span>
              <select
                className="control"
                onChange={(event) => setFiltroTipo(event.target.value)}
                value={filtroTipo}
              >
                <option value="todos">Todos</option>
                {[...new Set(servicios.map((servicio) => servicio.tipoServicio))].map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>
            </label>
            <span className="field__hint">Los servicios inactivos no aceptan nuevas reservas.</span>
          </div>
          {visibles.length ? (
            <div className="entity-list">
              {visibles.map((servicio) => (
                <article className="entity-row" key={servicio.id}>
                  <div>
                    <h3>{servicio.nombre}</h3>
                    <p>
                      {servicio.tipoServicio} ·{' '}
                      {servicio.modalidad === 'EN_SEDE' ? 'En sede' : 'A domicilio'} ·{' '}
                      {servicio.duracionMin} min
                    </p>
                    <strong className="service-price">
                      {new Intl.NumberFormat('es-CO', {
                        style: 'currency',
                        currency: 'COP',
                        maximumFractionDigits: 0,
                      }).format(servicio.precioBase)}
                    </strong>
                  </div>
                  <StatusBadge tone={servicio.activo ? 'success' : 'neutral'}>
                    {servicio.activo ? 'Activo' : 'Inactivo'}
                  </StatusBadge>
                  <div className="entity-actions">
                    <button
                      className="text-action"
                      onClick={() => abrirServicio(servicio)}
                      type="button"
                    >
                      Editar
                    </button>
                    <button
                      className="text-action"
                      onClick={() => void alternarServicio(servicio)}
                      type="button"
                    >
                      {servicio.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>Aún no has creado servicios</h3>
              <p>Publica tu primera opción para que los tutores puedan encontrarte.</p>
            </div>
          )}
          <div className="unsupported-note">
            <strong>Reglas de precio por mascota</strong>
            <span>
              La API aún no permite guardar rangos por especie, peso o edad; el precio base sí se
              guarda.
            </span>
          </div>
        </section>
      );
    }
    if (seccion === 'horarios') {
      return (
        <section className="workspace-card">
          <div className="workspace-card__title-row">
            <div>
              <h2>Horarios de trabajo</h2>
              <p className="workspace-card__intro">
                Define cuándo pueden reservar una consulta con tu equipo.
              </p>
            </div>
            <label className="field field--inline">
              <span>Veterinario</span>
              <select
                className="control"
                onChange={async (event) => {
                  const id = event.target.value;
                  setVeterinarioId(id);
                  if (!id) return;
                  try {
                    const resultado = await api<Franja[]>(
                      `/aliados/${aliadoId}/veterinarios/${id}/horarios`,
                    );
                    setFranjas(
                      resultado.map((item) => ({
                        ...item,
                        horaInicio: item.horaInicio.slice(0, 5),
                        horaFin: item.horaFin.slice(0, 5),
                        vigenteDesde: item.vigenteDesde?.slice(0, 10) ?? '',
                      })),
                    );
                  } catch (causa) {
                    setError(
                      causa instanceof ApiError ? causa.message : 'No pudimos cargar los horarios.',
                    );
                  }
                }}
                value={veterinarioId}
              >
                <option value="">Selecciona</option>
                {veterinarios.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {veterinarios.length ? (
            <>
              <div className="schedule-list">
                {dias.map((dia) => {
                  const delDia = franjas.filter((franja) => franja.diaSemana === dia.numero);
                  return (
                    <div className="schedule-day" key={dia.numero}>
                      <strong>{dia.nombre}</strong>
                      <div className="schedule-day__slots">
                        {delDia.map((franja, index) => (
                          <div className="schedule-slot" key={`${dia.numero}-${index}`}>
                            <input
                              aria-label={`${dia.nombre}, hora de inicio`}
                              className="control"
                              onChange={(event) =>
                                setFranjas(
                                  franjas.map((item) =>
                                    item === franja
                                      ? { ...item, horaInicio: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              type="time"
                              value={franja.horaInicio}
                            />
                            <span>a</span>
                            <input
                              aria-label={`${dia.nombre}, hora de fin`}
                              className="control"
                              onChange={(event) =>
                                setFranjas(
                                  franjas.map((item) =>
                                    item === franja
                                      ? { ...item, horaFin: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                              type="time"
                              value={franja.horaFin}
                            />
                            <button
                              aria-label={`Quitar horario del ${dia.nombre}`}
                              className="icon-button"
                              onClick={() => setFranjas(franjas.filter((item) => item !== franja))}
                              type="button"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          className="text-action"
                          onClick={() =>
                            setFranjas([
                              ...franjas,
                              {
                                diaSemana: dia.numero,
                                horaInicio: '09:00',
                                horaFin: '17:00',
                                vigenteDesde: new Date().toISOString().slice(0, 10),
                              },
                            ])
                          }
                          type="button"
                        >
                          ＋ Agregar franja
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="form-actions">
                <span className="field__hint">
                  No se podrán reservar citas fuera de estos horarios.
                </span>
                <VetoButton onClick={() => void guardarHorarios()}>Guardar horarios</VetoButton>
              </div>
            </>
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>Agrega primero un veterinario</h3>
              <p>El horario se configura por profesional.</p>
              <button className="text-action" onClick={() => setSeccion('equipo')} type="button">
                Ir al equipo
              </button>
            </div>
          )}
          <div className="unsupported-note">
            <strong>Calendario mensual y bloqueos</strong>
            <span>
              El backend actual guarda franjas semanales; no ofrece todavía calendario de citas ni
              bloqueos de fechas.
            </span>
          </div>
        </section>
      );
    }
    if (seccion === 'especies') {
      return (
        <section className="workspace-card">
          <h2>Especies que atendemos</h2>
          <p className="workspace-card__intro">
            Solo aparecerás en las búsquedas de las especies que marques.
          </p>
          <div className="species-select">
            {especies.map((especie) => {
              const seleccionada = especiesSeleccionadas.includes(especie.id);
              return (
                <button
                  aria-pressed={seleccionada}
                  className={`species-option${seleccionada ? ' is-selected' : ''}`}
                  key={especie.id}
                  onClick={() =>
                    setEspeciesSeleccionadas(
                      seleccionada
                        ? especiesSeleccionadas.filter((id) => id !== especie.id)
                        : [...especiesSeleccionadas, especie.id],
                    )
                  }
                  type="button"
                >
                  <span aria-hidden="true">
                    {especie.nombre.toLowerCase().includes('perro')
                      ? '🐕'
                      : especie.nombre.toLowerCase().includes('gato')
                        ? '🐈'
                        : '✳'}
                  </span>
                  {especie.nombre}
                  {seleccionada && <span aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
          <div className="form-actions">
            <span className="field__hint">Selecciona al menos una especie.</span>
            <VetoButton
              disabled={!especiesSeleccionadas.length}
              onClick={() => void guardarEspecies()}
            >
              Guardar selección
            </VetoButton>
          </div>
        </section>
      );
    }
    return (
      <section className="workspace-card">
        <h2>Confirmación de citas</h2>
        <p className="workspace-card__intro">Elige cómo quieres gestionar las nuevas reservas.</p>
        <div className="choice-row">
          {[
            {
              valor: 'AUTOMATICA' as const,
              titulo: 'Confirmación automática',
              detalle: 'Las reservas quedan confirmadas al instante.',
            },
            {
              valor: 'MANUAL' as const,
              titulo: 'Confirmación manual',
              detalle: 'Tú aceptas o rechazas cada solicitud.',
            },
          ].map((opcion) => (
            <label
              className={`choice-card choice-card--large${modo === opcion.valor ? ' is-selected' : ''}`}
              key={opcion.valor}
            >
              <input
                checked={modo === opcion.valor}
                name="modo"
                onChange={() => setModo(opcion.valor)}
                type="radio"
              />
              <strong>{opcion.titulo}</strong>
              <span>{opcion.detalle}</span>
              <StatusBadge tone={opcion.valor === 'AUTOMATICA' ? 'success' : 'warning'}>
                {opcion.valor === 'AUTOMATICA' ? 'Cita confirmada' : 'Pendiente de aceptación'}
              </StatusBadge>
            </label>
          ))}
        </div>
        <p className="field__hint">Este cambio aplica únicamente a las reservas nuevas.</p>
        <div className="form-actions form-actions--left">
          <VetoButton onClick={() => void guardarConfirmacion()}>Guardar preferencia</VetoButton>
        </div>
      </section>
    );
  };

  return (
    <div className="partner-shell">
      <aside className="partner-sidebar">
        <a aria-label="Veto" className="partner-logo" href="/">
          <BrandLogo className="brand-logo" />
        </a>
        <p className="partner-sidebar__label">GESTIÓN DEL ALIADO</p>
        <nav aria-label="Módulos del aliado">
          {navegacion.map((item) => (
            <button
              aria-current={seccion === item.id ? 'page' : undefined}
              className={seccion === item.id ? 'is-active' : ''}
              key={item.id}
              onClick={() => {
                setSeccion(item.id);
                setError('');
                setExito('');
              }}
              type="button"
            >
              <span aria-hidden="true">{item.icono}</span>
              {item.etiqueta}
            </button>
          ))}
        </nav>
        <a className="partner-sidebar__back" href="/">
          Volver a Veto
        </a>
      </aside>
      <div className="partner-main">
        <header className="partner-topbar">
          <div>
            <span className="partner-topbar__caption">Panel del aliado</span>
            <h1>{titulo}</h1>
          </div>
          <div className="partner-user">
            <span className="avatar">V</span>
            <span>{aliadoNombre || 'Mi aliado'}</span>
          </div>
        </header>
        <section className="partner-content">
          {error && (
            <AlertBox tone="error" title="No se pudo completar la solicitud">
              {error}
            </AlertBox>
          )}
          {exito && (
            <AlertBox tone="success" title="Cambios guardados">
              {exito}
            </AlertBox>
          )}
          {aliadoId && aliadoEstado !== 'ACTIVO' && (
            <AlertBox tone="warning" title="Perfil pendiente de activación">
              {aliadoEstado === 'PENDIENTE'
                ? 'El equipo de Veto debe activar tu aliado antes de que puedas gestionar sus datos.'
                : 'Este perfil no está activo. Contacta al equipo de Veto para obtener ayuda.'}
            </AlertBox>
          )}
          {cargando && !aliadoId ? (
            <div className="empty-state empty-state--card" aria-live="polite">
              <h2>Cargando tu perfil de aliado…</h2>
            </div>
          ) : !aliadoId ? (
            error ? null : (
              <div className="empty-state empty-state--card">
                <span className="empty-state__illustration" aria-hidden="true">
                  ⌖
                </span>
                <h2>No encontramos tu perfil de aliado</h2>
                <p>
                  El perfil se carga desde la cuenta con la que iniciaste sesión. Si ya registraste
                  tu aliado, contacta al equipo de Veto para revisar la asociación de tu cuenta.
                </p>
              </div>
            )
          ) : aliadoEstado !== 'ACTIVO' ? null : (
            contenido()
          )}
        </section>
      </div>

      {modal && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="dialog"
          >
            {modal === 'sede' ? (
              <>
                <h2>{sedeEditando ? 'Editar sede' : 'Crear sede'}</h2>
                <form className="form-stack" onSubmit={guardarSede}>
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      className="control"
                      onChange={(event) => setSedeForm({ ...sedeForm, nombre: event.target.value })}
                      required
                      value={sedeForm.nombre}
                    />
                  </label>
                  <label className="field">
                    <span>Dirección</span>
                    <input
                      className="control"
                      onChange={(event) =>
                        setSedeForm({ ...sedeForm, direccion: event.target.value })
                      }
                      required
                      value={sedeForm.direccion}
                    />
                  </label>
                  <label className="field">
                    <span>Ciudad</span>
                    <input
                      className="control"
                      onChange={(event) => setSedeForm({ ...sedeForm, ciudad: event.target.value })}
                      required
                      value={sedeForm.ciudad}
                    />
                  </label>
                  <div className="form-actions">
                    <VetoButton onClick={() => setModal(null)} variant="secondary">
                      Cancelar
                    </VetoButton>
                    <VetoButton loading={cargando} type="submit">
                      Guardar sede
                    </VetoButton>
                  </div>
                </form>
              </>
            ) : modal === 'servicio' ? (
              <>
                <h2>{servicioEditando ? 'Editar servicio' : 'Crear servicio'}</h2>
                <form className="form-stack" onSubmit={guardarServicio}>
                  <label className="field">
                    <span>Tipo de servicio</span>
                    <select
                      className="control"
                      onChange={(event) =>
                        setServicioForm({ ...servicioForm, tipoServicioId: event.target.value })
                      }
                      required
                      value={servicioForm.tipoServicioId}
                    >
                      <option value="">Selecciona el tipo</option>
                      {tipos.map((tipo) => (
                        <option key={tipo.id} value={tipo.id}>
                          {tipo.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Nombre</span>
                    <input
                      className="control"
                      onChange={(event) =>
                        setServicioForm({ ...servicioForm, nombre: event.target.value })
                      }
                      required
                      value={servicioForm.nombre}
                    />
                  </label>
                  <label className="field">
                    <span>Descripción (opcional)</span>
                    <textarea
                      className="control textarea"
                      maxLength={2000}
                      onChange={(event) =>
                        setServicioForm({ ...servicioForm, descripcion: event.target.value })
                      }
                      value={servicioForm.descripcion}
                    />
                    <small className="character-count">
                      {servicioForm.descripcion.length}/2.000
                    </small>
                  </label>
                  <fieldset className="field">
                    <legend>Modalidad</legend>
                    <div className="choice-row choice-row--compact">
                      <label
                        className={`choice-card${servicioForm.modalidad === 'EN_SEDE' ? ' is-selected' : ''}`}
                      >
                        <input
                          checked={servicioForm.modalidad === 'EN_SEDE'}
                          name="modalidad"
                          onChange={() =>
                            setServicioForm({ ...servicioForm, modalidad: 'EN_SEDE' })
                          }
                          type="radio"
                        />
                        En sede
                      </label>
                      <label
                        className={`choice-card${servicioForm.modalidad === 'A_DOMICILIO' ? ' is-selected' : ''}`}
                      >
                        <input
                          checked={servicioForm.modalidad === 'A_DOMICILIO'}
                          name="modalidad"
                          onChange={() =>
                            setServicioForm({
                              ...servicioForm,
                              modalidad: 'A_DOMICILIO',
                              sedeId: '',
                            })
                          }
                          type="radio"
                        />
                        A domicilio
                      </label>
                    </div>
                  </fieldset>
                  {servicioForm.modalidad === 'EN_SEDE' && (
                    <label className="field">
                      <span>Sede</span>
                      <select
                        className="control"
                        onChange={(event) =>
                          setServicioForm({ ...servicioForm, sedeId: event.target.value })
                        }
                        required
                        value={servicioForm.sedeId}
                      >
                        <option value="">Selecciona una sede</option>
                        {sedes.map((sede) => (
                          <option key={sede.id} value={sede.id}>
                            {sede.nombre}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="form-two-col">
                    <label className="field">
                      <span>Duración (minutos)</span>
                      <input
                        className="control"
                        max="480"
                        min="5"
                        onChange={(event) =>
                          setServicioForm({ ...servicioForm, duracionMin: event.target.value })
                        }
                        required
                        step="5"
                        type="number"
                        value={servicioForm.duracionMin}
                      />
                    </label>
                    <label className="field">
                      <span>Precio base (COP)</span>
                      <input
                        className="control"
                        min="0"
                        onChange={(event) =>
                          setServicioForm({ ...servicioForm, precioBase: event.target.value })
                        }
                        required
                        step="0.01"
                        type="number"
                        value={servicioForm.precioBase}
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <VetoButton onClick={() => setModal(null)} variant="secondary">
                      Cancelar
                    </VetoButton>
                    <VetoButton loading={cargando} type="submit">
                      Guardar servicio
                    </VetoButton>
                  </div>
                </form>
              </>
            ) : modal === 'perfilVeterinario' ? (
              <>
                <h2>Editar perfil veterinario</h2>
                <div className="vet-profile-preview">
                  {perfilVeterinarioForm.fotoUrl ? (
                    <span
                      aria-label={`Foto de ${veterinarioEditando?.nombre ?? 'veterinario'}`}
                      className="avatar person-avatar-photo"
                      role="img"
                      style={{
                        backgroundImage: `url("${perfilVeterinarioForm.fotoUrl}")`,
                      }}
                    />
                  ) : (
                    <span className="avatar">
                      {veterinarioEditando?.nombre.slice(0, 1).toUpperCase() ?? 'V'}
                    </span>
                  )}
                  <div>
                    <strong>{veterinarioEditando?.nombre}</strong>
                    <p>{perfilVeterinarioForm.descripcion || 'Descripción no disponible.'}</p>
                  </div>
                </div>
                <form className="form-stack" onSubmit={guardarPerfilVeterinario}>
                  <label className="field">
                    <span>Foto (URL)</span>
                    <input
                      className="control"
                      onChange={(event) =>
                        setPerfilVeterinarioForm({
                          ...perfilVeterinarioForm,
                          fotoUrl: event.target.value,
                        })
                      }
                      type="url"
                      value={perfilVeterinarioForm.fotoUrl}
                    />
                    <small className="field__hint">
                      La API recibe una URL; la carga directa de archivos aún no está disponible.
                    </small>
                  </label>
                  <label className="field">
                    <span>Descripción</span>
                    <textarea
                      className="control textarea"
                      maxLength={2000}
                      onChange={(event) =>
                        setPerfilVeterinarioForm({
                          ...perfilVeterinarioForm,
                          descripcion: event.target.value,
                        })
                      }
                      value={perfilVeterinarioForm.descripcion}
                    />
                    <small className="character-count">
                      {perfilVeterinarioForm.descripcion.length}/2.000
                    </small>
                  </label>
                  <div className="form-actions">
                    <VetoButton onClick={() => setModal(null)} variant="secondary">
                      Cancelar
                    </VetoButton>
                    <VetoButton loading={cargando} type="submit">
                      Guardar perfil
                    </VetoButton>
                  </div>
                </form>
              </>
            ) : (
              <>
                <h2>Agregar veterinario</h2>
                <form className="form-stack" onSubmit={crearVeterinario}>
                  <label className="field">
                    <span>Nombre completo</span>
                    <input
                      className="control"
                      onChange={(event) =>
                        setVeterinarioForm({ ...veterinarioForm, nombre: event.target.value })
                      }
                      required
                      value={veterinarioForm.nombre}
                    />
                  </label>
                  <label className="field">
                    <span>Celular</span>
                    <input
                      className="control"
                      inputMode="numeric"
                      maxLength={10}
                      onChange={(event) =>
                        setVeterinarioForm({
                          ...veterinarioForm,
                          celular: event.target.value.replace(/\D/g, ''),
                        })
                      }
                      required
                      value={veterinarioForm.celular}
                    />
                  </label>
                  <label className="field">
                    <span>Correo</span>
                    <input
                      className="control"
                      onChange={(event) =>
                        setVeterinarioForm({ ...veterinarioForm, correo: event.target.value })
                      }
                      required
                      type="email"
                      value={veterinarioForm.correo}
                    />
                  </label>
                  <label className="field">
                    <span>Contraseña inicial</span>
                    <input
                      className="control"
                      minLength={8}
                      onChange={(event) =>
                        setVeterinarioForm({ ...veterinarioForm, contrasena: event.target.value })
                      }
                      required
                      type="password"
                      value={veterinarioForm.contrasena}
                    />
                  </label>
                  <label className="field">
                    <span>Foto (URL, opcional)</span>
                    <input
                      className="control"
                      onChange={(event) =>
                        setVeterinarioForm({ ...veterinarioForm, fotoUrl: event.target.value })
                      }
                      type="url"
                      value={veterinarioForm.fotoUrl}
                    />
                  </label>
                  <label className="field">
                    <span>Descripción (opcional)</span>
                    <textarea
                      className="control textarea"
                      maxLength={2000}
                      onChange={(event) =>
                        setVeterinarioForm({
                          ...veterinarioForm,
                          descripcion: event.target.value,
                        })
                      }
                      value={veterinarioForm.descripcion}
                    />
                    <small className="character-count">
                      {veterinarioForm.descripcion.length}/2.000
                    </small>
                  </label>
                  <div className="form-actions">
                    <VetoButton onClick={() => setModal(null)} variant="secondary">
                      Cancelar
                    </VetoButton>
                    <VetoButton loading={cargando} type="submit">
                      Agregar al equipo
                    </VetoButton>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
      {confirmacionPendiente && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="deactivate-title"
            aria-modal="true"
            className="workspace-modal workspace-modal--small"
            role="dialog"
          >
            <p className="eyebrow eyebrow--dark">CONFIRMA EL CAMBIO</p>
            <h2 id="deactivate-title">
              ¿Desactivar{' '}
              {confirmacionPendiente.tipo === 'sede'
                ? confirmacionPendiente.item.nombre
                : confirmacionPendiente.item.nombre}
              ?
            </h2>
            <p>
              {confirmacionPendiente.tipo === 'sede'
                ? 'La sede dejará de aparecer como disponible para nuevas reservas.'
                : 'El servicio dejará de ofrecerse para nuevas reservas; las citas históricas no se alteran.'}
            </p>
            <div className="form-actions">
              <VetoButton onClick={() => setConfirmacionPendiente(null)} variant="secondary">
                Cancelar
              </VetoButton>
              <VetoButton
                loading={cargando}
                onClick={() => void confirmarDesactivacion()}
                variant="danger"
              >
                Desactivar
              </VetoButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
