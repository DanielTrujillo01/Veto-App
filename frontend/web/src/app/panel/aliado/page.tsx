'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  CitaDetalle,
  EspecieAtendida,
  MascotaAdopcion,
  ModoConfirmacion,
  ProductoGestion,
  ReglaPrecio,
  Servicio,
  Sede,
  TipoAliado,
} from '@veto/shared';
import { api, ApiError } from '@/lib/api';
import { AlertBox, CelularField, StatusBadge, VetoButton } from '@/components/ui/veto-components';
import { PanelShell } from '@/components/panel/PanelShell';
import {
  filtrarAgenda,
  ListaAgenda,
  porCerrar,
  type FiltroAgenda,
} from '@/components/panel/AgendaCitas';
import {
  AccesosPanel,
  AvisoPanel,
  BienvenidaPanel,
  IndicadoresPanel,
  TarjetaPanel,
} from '@/components/panel/PanelResumen';
import { GestionAdopciones } from './GestionAdopciones';
import { ProductosTienda } from './ProductosTienda';

type Seccion =
  | 'resumen'
  | 'equipo'
  | 'sedes'
  | 'servicios'
  | 'horarios'
  | 'especies'
  | 'citas'
  | 'agenda'
  | 'productos'
  | 'adopciones';
type Veterinario = {
  id: string;
  nombre: string;
  fotoUrl: string | null;
  descripcion: string | null;
};
type TipoServicio = { id: number; nombre: string };
type Franja = { diaSemana: number; horaInicio: string; horaFin: string; vigenteDesde: string };
type IconoPanelNombre = 'home' | 'team' | 'pin' | 'heart' | 'clock' | 'paw' | 'calendar' | 'store';
type ReglaPrecioForm = {
  especieId: string;
  pesoMinKg: string;
  pesoMaxKg: string;
  edadMinMeses: string;
  edadMaxMeses: string;
  precio: string;
  prioridad: string;
};

const reglaPrecioVacia: ReglaPrecioForm = {
  especieId: '',
  pesoMinKg: '',
  pesoMaxKg: '',
  edadMinMeses: '',
  edadMaxMeses: '',
  precio: '',
  prioridad: '0',
};

const dias = [
  { numero: 1, nombre: 'Lunes' },
  { numero: 2, nombre: 'Martes' },
  { numero: 3, nombre: 'Miércoles' },
  { numero: 4, nombre: 'Jueves' },
  { numero: 5, nombre: 'Viernes' },
  { numero: 6, nombre: 'Sábado' },
  { numero: 7, nombre: 'Domingo' },
];
type ItemNavegacion = {
  id: Seccion;
  etiqueta: string;
  icono: IconoPanelNombre;
  /** Grupo de la barra lateral; sin grupo va en "Gestión". */
  grupo?: string;
};

const navegacionClinica: ItemNavegacion[] = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'home', grupo: 'Mi clínica' },
  { id: 'sedes', etiqueta: 'Sedes', icono: 'pin', grupo: 'Mi clínica' },
  { id: 'equipo', etiqueta: 'Veterinarios', icono: 'team', grupo: 'Mi clínica' },
  { id: 'especies', etiqueta: 'Especies', icono: 'paw', grupo: 'Mi clínica' },
  { id: 'agenda', etiqueta: 'Citas', icono: 'calendar', grupo: 'Atención y citas' },
  { id: 'servicios', etiqueta: 'Servicios', icono: 'heart', grupo: 'Atención y citas' },
  { id: 'horarios', etiqueta: 'Disponibilidad', icono: 'clock', grupo: 'Atención y citas' },
  {
    id: 'citas',
    etiqueta: 'Confirmación de citas',
    icono: 'calendar',
    grupo: 'Atención y citas',
  },
];
const navegacionVeterinario: ItemNavegacion[] = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'home' },
  { id: 'agenda', etiqueta: 'Citas', icono: 'calendar' },
  { id: 'servicios', etiqueta: 'Servicios', icono: 'heart' },
  { id: 'horarios', etiqueta: 'Disponibilidad', icono: 'clock' },
  { id: 'especies', etiqueta: 'Especies', icono: 'paw' },
  { id: 'citas', etiqueta: 'Confirmación de citas', icono: 'calendar' },
];
const navegacionTienda: ItemNavegacion[] = [
  { id: 'resumen', etiqueta: 'Resumen', icono: 'home' },
  { id: 'sedes', etiqueta: 'Sedes', icono: 'pin' },
  { id: 'horarios', etiqueta: 'Horario', icono: 'clock' },
  { id: 'productos', etiqueta: 'Productos', icono: 'store' },
];

function IconoPanel({ nombre }: { nombre: IconoPanelNombre }) {
  const trazos = {
    home: (
      <>
        <path d="m3.75 10 8.25-6.75L20.25 10v9.25a1 1 0 0 1-1 1h-5.5v-6h-3.5v6h-5.5a1 1 0 0 1-1-1V10Z" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19v-1.25a5.5 5.5 0 0 1 11 0V19h-11Z" />
        <path d="M15 5.4a3 3 0 0 1 0 5.2m2.25 2.15a4.5 4.5 0 0 1 3.25 4.33V19h-3.25" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10.1c0 5.25-7 10.15-7 10.15S5 15.35 5 10.1a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.25" />
      </>
    ),
    heart: (
      <path d="M20.25 8.7c0 4.55-8.25 10-8.25 10S3.75 13.25 3.75 8.7a4.45 4.45 0 0 1 8.25-2.3 4.45 4.45 0 0 1 8.25 2.3Z" />
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.25 2" />
      </>
    ),
    paw: (
      <>
        <ellipse cx="12" cy="15.75" rx="4.25" ry="3.1" />
        <ellipse cx="5.6" cy="10.6" rx="1.55" ry="2.1" transform="rotate(-25 5.6 10.6)" />
        <ellipse cx="10" cy="7.5" rx="1.55" ry="2.1" transform="rotate(-8 10 7.5)" />
        <ellipse cx="14.8" cy="7.5" rx="1.55" ry="2.1" transform="rotate(8 14.8 7.5)" />
        <ellipse cx="18.4" cy="10.6" rx="1.55" ry="2.1" transform="rotate(25 18.4 10.6)" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5.5" width="16" height="15" rx="2" />
        <path d="M8 3.5v4m8-4v4M4 10h16m-11 4h2m3 0h2m-7 3h2" />
      </>
    ),
    store: (
      <>
        <path d="M4 10v10h16V10M3.5 9.5 5.5 4h13l2 5.5a2.5 2.5 0 0 1-4.5 1.5 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4.5-1.5Z" />
        <path d="M9 20v-5h6v5" />
      </>
    ),
  }[nombre];

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      {trazos}
    </svg>
  );
}

function IlustracionEspecie({ nombre }: { nombre: string }) {
  const especie = nombre.toLocaleLowerCase();
  const tipo = especie.includes('perro')
    ? 'perro'
    : especie.includes('gato')
      ? 'gato'
      : especie.includes('ave')
        ? 'ave'
        : especie.includes('conejo')
          ? 'conejo'
          : 'otra';

  return (
    <span aria-hidden="true" className={`species-option__art species-option__art--${tipo}`}>
      {tipo === 'otra' ? (
        <svg className="species-option__illustration" fill="none" viewBox="0 0 120 120">
          <ellipse cx="60" cy="76" rx="25" ry="19" />
          <ellipse cx="32" cy="45" rx="9" ry="13" transform="rotate(-28 32 45)" />
          <ellipse cx="52" cy="34" rx="9" ry="13" transform="rotate(-10 52 34)" />
          <ellipse cx="72" cy="34" rx="9" ry="13" transform="rotate(10 72 34)" />
          <ellipse cx="90" cy="45" rx="9" ry="13" transform="rotate(28 90 45)" />
        </svg>
      ) : (
        <img alt="" className="species-option__photo" src={`/especies/${tipo}.png`} />
      )}
    </span>
  );
}

export default function PanelAliado() {
  const [seccion, setSeccion] = useState<Seccion>('resumen');
  const [aliadoId, setAliadoId] = useState('');
  const [aliadoNombre, setAliadoNombre] = useState('');
  const [aliadoEstado, setAliadoEstado] = useState('');
  const [aliadoTipo, setAliadoTipo] = useState<TipoAliado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [tipos, setTipos] = useState<TipoServicio[]>([]);
  const [reglasPrecio, setReglasPrecio] = useState<ReglaPrecioForm[]>([]);
  const [servicioReglasEditando, setServicioReglasEditando] = useState<Servicio | null>(null);
  const [errorReglasPrecio, setErrorReglasPrecio] = useState('');
  const [veterinarios, setVeterinarios] = useState<Veterinario[]>([]);
  const [especies, setEspecies] = useState<{ id: number; nombre: string }[]>([]);
  const [especiesSeleccionadas, setEspeciesSeleccionadas] = useState<number[]>([]);
  const [modo, setModo] = useState<ModoConfirmacion>('MANUAL');
  const [veterinarioId, setVeterinarioId] = useState('');
  const [franjas, setFranjas] = useState<Franja[]>([]);
  const [modal, setModal] = useState<
    'sede' | 'servicio' | 'reglasPrecio' | 'veterinario' | 'perfilVeterinario' | null
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
  /** Resumen de la clínica: si algún veterinario ya tiene horarios (null = sin consultar). */
  const [conHorarios, setConHorarios] = useState<boolean | null>(null);
  /** Agenda de citas del aliado (GET /citas): resumen y sección "Citas". */
  const [agenda, setAgenda] = useState<CitaDetalle[]>([]);
  const [filtroAgenda, setFiltroAgenda] = useState<FiltroAgenda>('proximas');
  /** Resumen de la tienda y de la fundación. */
  const [productosResumen, setProductosResumen] = useState<ProductoGestion[]>([]);
  const [mascotasResumen, setMascotasResumen] = useState<MascotaAdopcion[]>([]);
  /** "Nuevo servicio" desde el encabezado: abre el formulario cuando carga la sección. */
  const [abrirNuevoServicio, setAbrirNuevoServicio] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    void api<{
      aliado: { id: string; nombre: string; estado: string; tipo: TipoAliado };
    }>('/aliados/me')
      .then(({ aliado }) => {
        if (!vigente) return;
        setAliadoId(aliado.id);
        setAliadoNombre(aliado.nombre);
        setAliadoEstado(aliado.estado);
        setAliadoTipo(aliado.tipo);
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

  const navegacion: ItemNavegacion[] = !aliadoTipo
    ? []
    : aliadoTipo === 'VET_INDEPENDIENTE'
      ? navegacionVeterinario
      : aliadoTipo === 'TIENDA'
        ? navegacionTienda
        : aliadoTipo === 'FUNDACION'
          ? [
              { id: 'resumen' as const, etiqueta: 'Resumen', icono: 'home' as const },
              { id: 'adopciones' as const, etiqueta: 'Adopciones', icono: 'paw' as const },
            ]
          : navegacionClinica;

  const titulo = navegacion.find((item) => item.id === seccion)?.etiqueta ?? 'Resumen';

  /** La barra lateral agrupa las secciones (la clínica en "Mi clínica" y "Atención y citas"). */
  const gruposNavegacion = navegacion.reduce<[string, ItemNavegacion[]][]>((grupos, item) => {
    const nombre = item.grupo ?? 'Gestión';
    const existente = grupos.find(([grupo]) => grupo === nombre);
    if (existente) existente[1].push(item);
    else grupos.push([nombre, [item]]);
    return grupos;
  }, []);

  /** Página que ven los tutores (solo las clínicas tienen una pública por ahora). */
  const perfilPublico =
    aliadoTipo === 'CLINICA' && aliadoId && aliadoEstado === 'ACTIVO'
      ? `/clinicas/${aliadoId}`
      : '';

  const cargar = useCallback(async () => {
    if (!aliadoId || aliadoEstado !== 'ACTIVO') return;
    if (
      (aliadoTipo === 'TIENDA' && (seccion === 'horarios' || seccion === 'productos')) ||
      (aliadoTipo === 'FUNDACION' && seccion !== 'resumen')
    ) {
      setCargando(false);
      setError('');
      return;
    }
    setCargando(true);
    setError('');
    try {
      if (seccion === 'resumen') {
        if (aliadoTipo === 'CLINICA') {
          const [listaServicios, listaSedes, equipo, especiesAtendidas] = await Promise.all([
            api<Servicio[]>(`/aliados/${aliadoId}/servicios/gestion`),
            api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`),
            api<{ veterinarios: Veterinario[] }>(`/aliados/${aliadoId}/veterinarios`),
            api<EspecieAtendida[]>(`/aliados/${aliadoId}/especies`),
          ]);
          setServicios(listaServicios);
          setSedes(listaSedes);
          setVeterinarios(equipo.veterinarios);
          setEspeciesSeleccionadas(especiesAtendidas.map((especie) => especie.id));
          // Paso "Horarios": basta con que un veterinario tenga franjas de atención.
          const horariosPorVeterinario = await Promise.all(
            equipo.veterinarios.map((veterinario) =>
              api<unknown[]>(`/aliados/${aliadoId}/veterinarios/${veterinario.id}/horarios`).catch(
                () => [],
              ),
            ),
          );
          setConHorarios(horariosPorVeterinario.some((lista) => lista.length > 0));
          setAgenda(await api<CitaDetalle[]>('/citas?limite=200').catch(() => []));
        } else if (aliadoTipo === 'VET_INDEPENDIENTE') {
          const [listaServicios, perfil, especiesAtendidas] = await Promise.all([
            api<Servicio[]>(`/aliados/${aliadoId}/servicios/gestion`),
            api<{ id: string; usuario: { nombre: string } }>('/veterinarios/me'),
            api<EspecieAtendida[]>(`/aliados/${aliadoId}/especies`),
          ]);
          setServicios(listaServicios);
          setEspeciesSeleccionadas(especiesAtendidas.map((especie) => especie.id));
          setVeterinarios([
            { id: perfil.id, nombre: perfil.usuario.nombre, fotoUrl: null, descripcion: null },
          ]);
          const misHorarios = await api<unknown[]>(
            `/aliados/${aliadoId}/veterinarios/${perfil.id}/horarios`,
          ).catch(() => []);
          setConHorarios(misHorarios.length > 0);
          setAgenda(await api<CitaDetalle[]>('/citas?limite=200').catch(() => []));
        } else if (aliadoTipo === 'TIENDA') {
          const [listaSedes, productos] = await Promise.all([
            api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`),
            api<ProductoGestion[]>(`/aliados/${aliadoId}/productos?estado=todos`).catch(() => []),
          ]);
          setSedes(listaSedes);
          setProductosResumen(productos);
        } else if (aliadoTipo === 'FUNDACION') {
          setMascotasResumen(await api<MascotaAdopcion[]>('/adopciones/mis-publicaciones'));
        }
      } else if (seccion === 'equipo') {
        const equipo = await api<{ veterinarios: Veterinario[] }>(
          `/aliados/${aliadoId}/veterinarios`,
        );
        setVeterinarios(equipo.veterinarios);
      } else if (seccion === 'sedes') {
        if (aliadoTipo !== 'CLINICA' && aliadoTipo !== 'TIENDA') return;
        setSedes(await api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`));
      } else if (seccion === 'servicios') {
        const [lista, tiposServicio] = await Promise.all([
          api<Servicio[]>(`/aliados/${aliadoId}/servicios/gestion`),
          api<TipoServicio[]>('/servicios/tipos'),
        ]);
        setServicios(lista);
        setTipos(tiposServicio);
        if (aliadoTipo === 'CLINICA') {
          const listaSedes = await api<Sede[]>(`/aliados/${aliadoId}/sedes/gestion`);
          setSedes(listaSedes.filter((sede) => sede.activa));
        } else {
          setSedes([]);
        }
      } else if (seccion === 'horarios') {
        let equipo: Veterinario[];
        if (aliadoTipo === 'VET_INDEPENDIENTE') {
          const perfil = await api<{ id: string; usuario: { nombre: string } }>('/veterinarios/me');
          equipo = [
            { id: perfil.id, nombre: perfil.usuario.nombre, fotoUrl: null, descripcion: null },
          ];
        } else {
          const respuesta = await api<{ veterinarios: Veterinario[] }>(
            `/aliados/${aliadoId}/veterinarios`,
          );
          equipo = respuesta.veterinarios;
        }
        setVeterinarios(equipo);
        if (equipo[0]) {
          setVeterinarioId(equipo[0].id);
          const horarios = await api<
            { diaSemana: number; horaInicio: string; horaFin: string; vigenteDesde: string }[]
          >(`/aliados/${aliadoId}/veterinarios/${equipo[0].id}/horarios`);
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
      } else if (seccion === 'agenda') {
        setAgenda(await api<CitaDetalle[]>('/citas?limite=200'));
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
  }, [aliadoEstado, aliadoId, aliadoTipo, seccion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!abrirNuevoServicio || seccion !== 'servicios' || cargando) return;
    setAbrirNuevoServicio(false);
    abrirServicio();
  }, [abrirNuevoServicio, seccion, cargando]);

  function irA(destino: Seccion) {
    setSeccion(destino);
    setError('');
    setExito('');
  }

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
    const modalidadPorDefecto = aliadoTipo === 'VET_INDEPENDIENTE' ? 'A_DOMICILIO' : 'EN_SEDE';
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
            modalidad: modalidadPorDefecto,
            sedeId: '',
            duracionMin: '60',
            precioBase: '',
          },
    );
    setModal('servicio');
  }

  async function abrirReglasPrecio(servicio: Servicio) {
    setError('');
    setErrorReglasPrecio('');
    setExito('');
    setCargando(true);
    try {
      const [reglas, catalogoEspecies] = await Promise.all([
        api<ReglaPrecio[]>(`/aliados/${aliadoId}/servicios/${servicio.id}/reglas-precio`),
        especies.length
          ? Promise.resolve(especies)
          : api<{ id: number; nombre: string }[]>('/mascotas/especies'),
      ]);
      if (catalogoEspecies !== especies) setEspecies(catalogoEspecies);
      setServicioReglasEditando(servicio);
      setReglasPrecio(
        reglas.map((regla) => ({
          especieId: regla.especieId == null ? '' : String(regla.especieId),
          pesoMinKg: regla.pesoMinKg == null ? '' : String(regla.pesoMinKg),
          pesoMaxKg: regla.pesoMaxKg == null ? '' : String(regla.pesoMaxKg),
          edadMinMeses: regla.edadMinMeses == null ? '' : String(regla.edadMinMeses),
          edadMaxMeses: regla.edadMaxMeses == null ? '' : String(regla.edadMaxMeses),
          precio: String(regla.precio),
          prioridad: String(regla.prioridad),
        })),
      );
      setModal('reglasPrecio');
    } catch (causa) {
      setError(
        causa instanceof ApiError
          ? causa.message
          : 'No pudimos cargar las reglas de precio de este servicio.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function guardarReglasPrecio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorReglasPrecio('');
    if (!servicioReglasEditando) {
      setErrorReglasPrecio('No encontramos el servicio que quieres actualizar.');
      return;
    }
    const rangoInvalido = reglasPrecio.some((regla) => {
      const pesoMin = regla.pesoMinKg === '' ? null : Number(regla.pesoMinKg);
      const pesoMax = regla.pesoMaxKg === '' ? null : Number(regla.pesoMaxKg);
      const edadMin = regla.edadMinMeses === '' ? null : Number(regla.edadMinMeses);
      const edadMax = regla.edadMaxMeses === '' ? null : Number(regla.edadMaxMeses);
      return (
        (pesoMin !== null && pesoMax !== null && pesoMin > pesoMax) ||
        (edadMin !== null && edadMax !== null && edadMin > edadMax)
      );
    });
    if (rangoInvalido) {
      setErrorReglasPrecio('En cada regla, el mínimo debe ser menor o igual que el máximo.');
      return;
    }
    if (reglasPrecio.some((regla) => regla.precio === '')) {
      setErrorReglasPrecio('Indica el precio de cada regla antes de guardar.');
      return;
    }

    const reglas = reglasPrecio.map((regla) => ({
      especieId: regla.especieId === '' ? null : Number(regla.especieId),
      pesoMinKg: regla.pesoMinKg === '' ? null : Number(regla.pesoMinKg),
      pesoMaxKg: regla.pesoMaxKg === '' ? null : Number(regla.pesoMaxKg),
      edadMinMeses: regla.edadMinMeses === '' ? null : Number(regla.edadMinMeses),
      edadMaxMeses: regla.edadMaxMeses === '' ? null : Number(regla.edadMaxMeses),
      precio: Number(regla.precio),
      prioridad: Number(regla.prioridad || 0),
    }));

    setCargando(true);
    try {
      await api<ReglaPrecio[]>(
        `/aliados/${aliadoId}/servicios/${servicioReglasEditando.id}/reglas-precio`,
        { method: 'PUT', body: JSON.stringify({ reglas }) },
      );
      setModal(null);
      setExito(
        reglas.length
          ? 'Las reglas de precio quedaron guardadas.'
          : 'Se quitaron las reglas. El servicio usará su precio base.',
      );
    } catch (causa) {
      setErrorReglasPrecio(
        causa instanceof ApiError ? causa.message : 'No pudimos guardar las reglas de precio.',
      );
    } finally {
      setCargando(false);
    }
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
      const icono = (nombre: IconoPanelNombre) => <IconoPanel nombre={nombre} />;
      const saludo = `Hola, ${aliadoNombre || 'aliado'}.`;

      if (aliadoTipo === 'VET_INDEPENDIENTE') {
        const activos = servicios.filter((servicio) => servicio.activo).length;
        return (
          <>
            <BienvenidaPanel
              acento="Así va tu espacio."
              pasos={[
                {
                  texto: 'Servicios publicados',
                  hecho: activos > 0,
                  accion: 'Publicar',
                  alHacerClic: () => irA('servicios'),
                },
                {
                  texto: 'Especies atendidas',
                  hecho: especiesSeleccionadas.length > 0,
                  accion: 'Elegir',
                  alHacerClic: () => irA('especies'),
                },
                {
                  texto: 'Horarios de atención',
                  hecho: conHorarios === true,
                  accion: 'Configurar',
                  alHacerClic: () => irA('horarios'),
                },
              ]}
              saludo={saludo}
              textoCompleto="Tu perfil está completo: los tutores ya pueden reservar contigo."
              textoPendiente="Completa tu perfil profesional para que los tutores reserven contigo."
            />
            <IndicadoresPanel
              items={[
                {
                  valor: activos,
                  texto: activos === 1 ? 'Servicio activo' : 'Servicios activos',
                  accion: 'Gestionar',
                  alHacerClic: () => irA('servicios'),
                  icono: icono('heart'),
                  tono: 'burgundy',
                },
                {
                  valor: especiesSeleccionadas.length,
                  texto:
                    especiesSeleccionadas.length === 1 ? 'Especie atendida' : 'Especies atendidas',
                  accion: 'Editar',
                  alHacerClic: () => irA('especies'),
                  icono: icono('paw'),
                  tono: 'peach',
                },
                {
                  valor: conHorarios ? 'Lista' : 'Pendiente',
                  texto: 'Disponibilidad',
                  accion: 'Configurar',
                  alHacerClic: () => irA('horarios'),
                  icono: icono('clock'),
                  tono: 'sage',
                },
              ]}
            />
            <div className="ally-row">
              <TarjetaPanel
                enlace={{ texto: 'Ver todas', alHacerClic: () => irA('agenda') }}
                id="proximas-citas"
                titulo="Próximas citas"
              >
                <ListaAgenda
                  citas={filtrarAgenda(agenda, 'proximas').slice(0, 4)}
                  vacio={{
                    titulo: 'No hay citas próximas',
                    texto: 'Cuando un tutor reserve contigo, la cita aparecerá aquí.',
                  }}
                />
              </TarjetaPanel>
              <TarjetaPanel id="accesos-rapidos" titulo="Accesos rápidos">
                <AccesosPanel
                  items={[
                    {
                      texto: 'Agregar servicio',
                      detalle: 'Precio, duración y modalidad',
                      icono: icono('heart'),
                      tono: 'peach',
                      alHacerClic: () => {
                        setAbrirNuevoServicio(true);
                        irA('servicios');
                      },
                    },
                    {
                      texto: 'Editar horarios',
                      detalle: 'Días y franjas de atención',
                      icono: icono('clock'),
                      tono: 'sage',
                      alHacerClic: () => irA('horarios'),
                    },
                    {
                      texto: 'Especies que atiendes',
                      detalle: 'Perros, gatos y más',
                      icono: icono('paw'),
                      tono: 'honey',
                      alHacerClic: () => irA('especies'),
                    },
                  ]}
                />
              </TarjetaPanel>
            </div>
          </>
        );
      }

      if (aliadoTipo === 'TIENDA') {
        const activos = productosResumen.filter((producto) => producto.activo);
        const sinStock = activos.filter((producto) => producto.stock === 0).length;
        const sedesActivasTienda = sedes.filter((sede) => sede.activa).length;
        return (
          <>
            <BienvenidaPanel
              acento="Así va tu tienda."
              pasos={[
                {
                  texto: 'Sedes registradas',
                  hecho: sedesActivasTienda > 0,
                  accion: 'Agregar',
                  alHacerClic: () => irA('sedes'),
                },
                {
                  texto: 'Productos publicados',
                  hecho: activos.length > 0,
                  accion: 'Publicar',
                  alHacerClic: () => irA('productos'),
                },
                {
                  texto: 'Productos con foto',
                  hecho: activos.length > 0 && activos.every((p) => p.fotos.length > 0),
                  accion: 'Revisar',
                  alHacerClic: () => irA('productos'),
                },
              ]}
              saludo={saludo}
              textoCompleto="Tu tienda está lista: los tutores ya pueden encontrar tus productos."
              textoPendiente="Completa tu tienda para que los tutores encuentren tus productos."
            />
            <IndicadoresPanel
              items={[
                {
                  valor: activos.length,
                  texto: activos.length === 1 ? 'Producto activo' : 'Productos activos',
                  accion: 'Gestionar',
                  alHacerClic: () => irA('productos'),
                  icono: icono('store'),
                  tono: 'burgundy',
                },
                {
                  valor: sinStock,
                  texto: sinStock === 1 ? 'Producto agotado' : 'Productos agotados',
                  accion: 'Revisar stock',
                  alHacerClic: () => irA('productos'),
                  icono: icono('heart'),
                  tono: 'peach',
                },
                {
                  valor: sedesActivasTienda,
                  texto: sedesActivasTienda === 1 ? 'Sede activa' : 'Sedes activas',
                  accion: 'Ver sedes',
                  alHacerClic: () => irA('sedes'),
                  icono: icono('pin'),
                  tono: 'sage',
                },
              ]}
            />
            <div className="ally-row">
              <TarjetaPanel id="pedidos" titulo="Pedidos">
                <AvisoPanel icono={icono('store')} titulo="Pronto verás aquí tus pedidos">
                  Los tutores ya pueden agregar tus productos al carrito. El pago y los pedidos
                  llegarán en la siguiente etapa.
                </AvisoPanel>
              </TarjetaPanel>
              <TarjetaPanel id="accesos-rapidos" titulo="Accesos rápidos">
                <AccesosPanel
                  items={[
                    {
                      texto: 'Nuevo producto',
                      detalle: 'Nombre, precio, stock y fotos',
                      icono: icono('store'),
                      tono: 'peach',
                      alHacerClic: () => irA('productos'),
                    },
                    {
                      texto: 'Nueva sede',
                      detalle: 'Dirección y ciudad',
                      icono: icono('pin'),
                      tono: 'burgundy',
                      alHacerClic: () => abrirSede(),
                    },
                    {
                      texto: 'Horario de la tienda',
                      detalle: 'Cuándo atiendes',
                      icono: icono('clock'),
                      tono: 'sage',
                      alHacerClic: () => irA('horarios'),
                    },
                  ]}
                />
              </TarjetaPanel>
            </div>
          </>
        );
      }

      if (aliadoTipo === 'FUNDACION') {
        const contar = (estado: MascotaAdopcion['estado']) =>
          mascotasResumen.filter((mascota) => mascota.estado === estado).length;
        const disponibles = contar('DISPONIBLE');
        const enProceso = contar('EN_PROCESO');
        const adoptadas = contar('ADOPTADA');
        return (
          <>
            <BienvenidaPanel
              acento="Así va tu fundación."
              pasos={[
                {
                  texto: 'Primera mascota publicada',
                  hecho: mascotasResumen.length > 0,
                  accion: 'Publicar',
                  alHacerClic: () => irA('adopciones'),
                },
                {
                  texto: 'Mascotas con foto',
                  hecho:
                    mascotasResumen.length > 0 && mascotasResumen.every((m) => m.fotos.length > 0),
                  accion: 'Revisar',
                  alHacerClic: () => irA('adopciones'),
                },
              ]}
              saludo={saludo}
              textoCompleto="Tus mascotas ya aparecen en el catálogo de adopción, sin revelar tu fundación."
              textoPendiente="Publica las mascotas que buscan hogar. En el catálogo no se muestra tu fundación."
              tituloAvance="Publicaciones"
            />
            <IndicadoresPanel
              items={[
                {
                  valor: disponibles,
                  texto: 'Disponibles',
                  accion: 'Ver',
                  alHacerClic: () => irA('adopciones'),
                  icono: icono('paw'),
                  tono: 'burgundy',
                },
                {
                  valor: enProceso,
                  texto: 'En proceso',
                  accion: 'Ver',
                  alHacerClic: () => irA('adopciones'),
                  icono: icono('clock'),
                  tono: 'peach',
                },
                {
                  valor: adoptadas,
                  texto: adoptadas === 1 ? 'Adoptada' : 'Adoptadas',
                  accion: 'Ver',
                  alHacerClic: () => irA('adopciones'),
                  icono: icono('heart'),
                  tono: 'sage',
                },
                {
                  valor: mascotasResumen.length,
                  texto: 'Publicadas en total',
                  accion: 'Gestionar',
                  alHacerClic: () => irA('adopciones'),
                  icono: icono('home'),
                  tono: 'honey',
                },
              ]}
            />
            <div className="ally-row">
              <TarjetaPanel id="solicitudes" titulo="Solicitudes de adopción">
                <AvisoPanel icono={icono('heart')} titulo="Pronto verás aquí las solicitudes">
                  Cuando un tutor quiera adoptar, su solicitud aparecerá aquí para que la revises.
                </AvisoPanel>
              </TarjetaPanel>
              <TarjetaPanel id="accesos-rapidos" titulo="Accesos rápidos">
                <AccesosPanel
                  items={[
                    {
                      texto: 'Publicar mascota',
                      detalle: 'Datos, fotos y video',
                      icono: icono('paw'),
                      tono: 'peach',
                      alHacerClic: () => irA('adopciones'),
                    },
                    {
                      texto: 'Ver el catálogo público',
                      detalle: 'Como lo ven los tutores',
                      icono: icono('home'),
                      tono: 'sage',
                      alHacerClic: () => window.open('/adopcion', '_blank'),
                    },
                  ]}
                />
              </TarjetaPanel>
            </div>
          </>
        );
      }

      // Resumen de la clínica: bienvenida con el avance del perfil, indicadores, próximas
      // citas y accesos rápidos. Colores de la ficha en su proporción: burgundy (principal),
      // peach (secundario), sage (acento, solo lo completado) y miel (detalle).
      const serviciosActivos = servicios.filter((servicio) => servicio.activo).length;
      const sedesActivas = sedes.filter((sede) => sede.activa).length;
      const pasos: { texto: string; hecho: boolean; destino: Seccion; accion: string }[] = [
        {
          texto: 'Sedes registradas',
          hecho: sedesActivas > 0,
          destino: 'sedes',
          accion: 'Agregar',
        },
        {
          texto: 'Equipo veterinario',
          hecho: veterinarios.length > 0,
          destino: 'equipo',
          accion: 'Agregar',
        },
        {
          texto: 'Servicios publicados',
          hecho: serviciosActivos > 0,
          destino: 'servicios',
          accion: 'Publicar',
        },
        {
          texto: 'Especies atendidas',
          hecho: especiesSeleccionadas.length > 0,
          destino: 'especies',
          accion: 'Elegir',
        },
        {
          texto: 'Horarios de atención',
          hecho: conHorarios === true,
          destino: 'horarios',
          accion: 'Configurar',
        },
      ];
      const hechos = pasos.filter((paso) => paso.hecho).length;
      const avance = Math.round((hechos / pasos.length) * 100);
      const indicadores: {
        valor: number;
        texto: string;
        accion: string;
        destino: Seccion;
        icono: IconoPanelNombre;
        tono: string;
      }[] = [
        {
          valor: serviciosActivos,
          texto: serviciosActivos === 1 ? 'Servicio activo' : 'Servicios activos',
          accion: 'Gestionar',
          destino: 'servicios',
          icono: 'heart',
          tono: 'burgundy',
        },
        {
          valor: sedesActivas,
          texto: sedesActivas === 1 ? 'Sede activa' : 'Sedes activas',
          accion: 'Ver sedes',
          destino: 'sedes',
          icono: 'pin',
          tono: 'peach',
        },
        {
          valor: veterinarios.length,
          texto: veterinarios.length === 1 ? 'Veterinario' : 'Veterinarios',
          accion: 'Ver equipo',
          destino: 'equipo',
          icono: 'team',
          tono: 'sage',
        },
        {
          valor: especiesSeleccionadas.length,
          texto: especiesSeleccionadas.length === 1 ? 'Especie atendida' : 'Especies atendidas',
          accion: 'Editar',
          destino: 'especies',
          icono: 'paw',
          tono: 'honey',
        },
      ];
      const accesos: {
        texto: string;
        detalle: string;
        icono: IconoPanelNombre;
        tono: string;
        alHacerClic: () => void;
      }[] = [
        {
          texto: 'Agregar servicio',
          detalle: 'Precio, duración y modalidad',
          icono: 'heart',
          tono: 'peach',
          alHacerClic: () => {
            setAbrirNuevoServicio(true);
            irA('servicios');
          },
        },
        {
          texto: 'Agregar veterinario',
          detalle: 'Suma a tu equipo',
          icono: 'team',
          tono: 'honey',
          alHacerClic: () => setModal('veterinario'),
        },
        {
          texto: 'Editar horarios',
          detalle: 'Días y franjas de atención',
          icono: 'clock',
          tono: 'sage',
          alHacerClic: () => irA('horarios'),
        },
        {
          texto: 'Nueva sede',
          detalle: 'Dirección y ciudad',
          icono: 'pin',
          tono: 'burgundy',
          alHacerClic: () => abrirSede(),
        },
      ];

      return (
        <>
          <section className="ally-welcome">
            <span
              aria-hidden="true"
              className="ally-welcome__shape ally-welcome__shape--burgundy"
            />
            <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--peach" />
            <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--sage" />
            <span aria-hidden="true" className="ally-welcome__shape ally-welcome__shape--miel" />
            <div className="ally-welcome__copy">
              <span className="eyebrow eyebrow--dark">
                <i /> BIENVENIDO DE NUEVO
              </span>
              <h2>
                Hola, {aliadoNombre || 'aliado'}. <em>Así va tu clínica.</em>
              </h2>
              <p>
                {hechos === pasos.length
                  ? 'Tu perfil está completo: los tutores ya pueden encontrarte y reservar contigo.'
                  : 'Te falta poco para que los tutores reserven contigo sin fricciones. Completa los pasos pendientes.'}
              </p>
            </div>
            <div className="ally-progress">
              <div className="ally-progress__head">
                <strong>Perfil completo</strong>
                <span>{avance}%</span>
              </div>
              <div
                aria-label={`Perfil completo al ${avance}%`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={avance}
                className="ally-progress__bar"
                role="progressbar"
              >
                <i style={{ width: `${avance}%` }} />
              </div>
              <ul className="ally-progress__steps">
                {pasos.map((paso) => (
                  <li className={paso.hecho ? 'is-done' : ''} key={paso.texto}>
                    <span aria-hidden="true" className="ally-progress__check">
                      {paso.hecho ? '✓' : ''}
                    </span>
                    {paso.texto}
                    <span className="sr-only">{paso.hecho ? ' (completo)' : ' (pendiente)'}</span>
                    {!paso.hecho && (
                      <button onClick={() => irA(paso.destino)} type="button">
                        {paso.accion} →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="ally-kpis">
            {indicadores.map((indicador) => (
              <article className="ally-kpi" key={indicador.texto}>
                <span className={`ally-icon ally-icon--${indicador.tono}`}>
                  <IconoPanel nombre={indicador.icono} />
                </span>
                <strong>{indicador.valor}</strong>
                <span>{indicador.texto}</span>
                <button onClick={() => irA(indicador.destino)} type="button">
                  {indicador.accion} →
                </button>
              </article>
            ))}
          </div>

          <div className="ally-row">
            <section aria-labelledby="proximas-citas" className="workspace-card ally-card">
              <div className="ally-card__head">
                <h2 id="proximas-citas">Próximas citas</h2>
                <button onClick={() => irA('agenda')} type="button">
                  Ver todas →
                </button>
              </div>
              <ListaAgenda
                citas={filtrarAgenda(agenda, 'proximas').slice(0, 4)}
                mostrarVeterinario
                vacio={{
                  titulo: 'No hay citas próximas',
                  texto: 'Cuando un tutor reserve, la cita aparecerá aquí.',
                }}
              />
            </section>

            <section aria-labelledby="accesos-rapidos" className="workspace-card ally-card">
              <div className="ally-card__head">
                <h2 id="accesos-rapidos">Accesos rápidos</h2>
              </div>
              <div className="ally-quick">
                {accesos.map((acceso) => (
                  <button key={acceso.texto} onClick={acceso.alHacerClic} type="button">
                    <span className={`ally-icon ally-icon--${acceso.tono}`}>
                      <IconoPanel nombre={acceso.icono} />
                    </span>
                    <span>
                      {acceso.texto}
                      <small>{acceso.detalle}</small>
                    </span>
                    <svg aria-hidden="true" className="ally-quick__arrow" viewBox="0 0 24 24">
                      <path d="M5 12h13M13 6l6 6-6 6" />
                    </svg>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </>
      );
    }
    if (seccion === 'agenda') {
      const porCerrarTotal = agenda.filter((cita) => porCerrar(cita)).length;
      return (
        <section aria-labelledby="agenda-titulo" className="workspace-card ally-card">
          <div className="ally-card__head">
            <h2 id="agenda-titulo">Citas</h2>
            <button onClick={() => irA('citas')} type="button">
              Confirmación de citas →
            </button>
          </div>
          {porCerrarTotal > 0 && (
            <AlertBox tone="warning" title={`${porCerrarTotal} por cerrar`}>
              Ya pasaron y siguen agendadas: márcalas como finalizadas o “no asistió”.
            </AlertBox>
          )}
          <nav aria-label="Filtrar citas" className="search-result-tags">
            {(
              [
                ['proximas', 'Próximas'],
                ['por-cerrar', 'Por cerrar'],
                ['pasadas', 'Pasadas'],
                ['todas', 'Todas'],
              ] as const
            ).map(([valor, texto]) => (
              <button
                aria-pressed={filtroAgenda === valor}
                className={filtroAgenda === valor ? 'is-active' : ''}
                key={valor}
                onClick={() => setFiltroAgenda(valor)}
                type="button"
              >
                {texto}
              </button>
            ))}
          </nav>
          <ListaAgenda
            citas={filtrarAgenda(agenda, filtroAgenda)}
            mostrarVeterinario={aliadoTipo === 'CLINICA'}
            vacio={{
              titulo: 'No hay citas en esta vista',
              texto: 'Cuando los tutores reserven, sus citas aparecerán aquí.',
            }}
          />
        </section>
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
                {aliadoTipo === 'TIENDA'
                  ? 'Administra las ubicaciones de tus puntos de atención.'
                  : 'Administra las ubicaciones disponibles para tus servicios.'}
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
    if (seccion === 'horarios' && aliadoTipo === 'TIENDA') {
      return (
        <section className="workspace-card">
          <h2>Horario de atención</h2>
          <p className="workspace-card__intro">
            Próximamente podrás publicar el horario de atención de cada sede de tu tienda.
          </p>
          <div className="unsupported-note">
            <strong>Configuración próximamente</strong>
            <span>La API todavía no permite guardar horarios para tiendas.</span>
          </div>
        </section>
      );
    }
    if (seccion === 'adopciones' && aliadoTipo === 'FUNDACION') {
      // HU-080 a HU-085: la sección vive en su propio componente y carga sus propios datos.
      return <GestionAdopciones />;
    }
    if (seccion === 'productos' && aliadoTipo === 'TIENDA') {
      // HU-044: la sección vive en su propio componente y carga sus propios datos.
      return <ProductosTienda aliadoId={aliadoId} />;
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
              <h2>{aliadoTipo === 'VET_INDEPENDIENTE' ? 'Servicios veterinarios' : 'Servicios'}</h2>
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
                    <div className="service-price-block">
                      <strong className="service-price">
                        {new Intl.NumberFormat('es-CO', {
                          style: 'currency',
                          currency: 'COP',
                          maximumFractionDigits: 0,
                        }).format(servicio.precioBase)}
                      </strong>
                      <small>Precio base</small>
                    </div>
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
                      onClick={() => void abrirReglasPrecio(servicio)}
                      type="button"
                    >
                      Reglas de precio
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
          <p className="workspace-card__intro pricing-rules-hint">
            Configura precios por especie, peso o edad desde “Reglas de precio”. Si ninguna regla
            coincide con los datos de la mascota, se conserva el precio base.
          </p>
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
                {aliadoTipo === 'VET_INDEPENDIENTE'
                  ? 'Define cuándo pueden reservar una consulta contigo.'
                  : 'Define cuándo pueden reservar una consulta con tu equipo.'}
              </p>
            </div>
            {aliadoTipo !== 'VET_INDEPENDIENTE' && (
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
                        causa instanceof ApiError
                          ? causa.message
                          : 'No pudimos cargar los horarios.',
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
            )}
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
                  <IlustracionEspecie nombre={especie.nombre} />
                  <span className="species-option__label">{especie.nombre}</span>
                  {seleccionada && (
                    <span aria-hidden="true" className="species-option__check">
                      <svg fill="none" viewBox="0 0 20 20">
                        <path d="m4 10 4 4 8-8" />
                      </svg>
                    </span>
                  )}
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
    <PanelShell
      acciones={
        <>
          {perfilPublico && (
            <a className="veto-button veto-button--secondary" href={perfilPublico}>
              Ver como tutor
            </a>
          )}
          {(aliadoTipo === 'CLINICA' || aliadoTipo === 'VET_INDEPENDIENTE') &&
            aliadoEstado === 'ACTIVO' && (
              <VetoButton
                onClick={() => {
                  setAbrirNuevoServicio(true);
                  irA('servicios');
                }}
              >
                ＋ Nuevo servicio
              </VetoButton>
            )}
        </>
      }
      ficha={
        aliadoNombre
          ? {
              nombre: aliadoNombre,
              detalle: aliadoEstado === 'ACTIVO' ? '✓ Aliado verificado' : 'En revisión',
              verificado: aliadoEstado === 'ACTIVO',
            }
          : undefined
      }
      grupos={gruposNavegacion.map(([nombre, items]) => ({
        nombre,
        items: items.map((item) => ({
          id: item.id,
          etiqueta: item.etiqueta,
          icono: <IconoPanel nombre={item.icono} />,
          activo: seccion === item.id,
          alHacerClic: () => irA(item.id),
        })),
      }))}
      leyenda="Panel del aliado"
      perfilPublico={perfilPublico || undefined}
      titulo={titulo}
    >
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
              El perfil se carga desde la cuenta con la que iniciaste sesión. Si ya registraste tu
              aliado, contacta al equipo de Veto para revisar la asociación de tu cuenta.
            </p>
          </div>
        )
      ) : aliadoEstado !== 'ACTIVO' ? null : (
        contenido()
      )}

      {modal && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className={`workspace-modal${modal === 'reglasPrecio' ? ' workspace-modal--pricing' : ' workspace-modal--small'}`}
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
                      {aliadoTipo !== 'VET_INDEPENDIENTE' && (
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
                      )}
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
                  {servicioForm.modalidad === 'EN_SEDE' && aliadoTipo !== 'VET_INDEPENDIENTE' && (
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
            ) : modal === 'reglasPrecio' ? (
              <>
                <h2>Reglas de precio</h2>
                <p className="workspace-card__intro">
                  {servicioReglasEditando?.nombre} · Precio base{' '}
                  {new Intl.NumberFormat('es-CO', {
                    style: 'currency',
                    currency: 'COP',
                    maximumFractionDigits: 0,
                  }).format(servicioReglasEditando?.precioBase ?? 0)}
                  . Los rangos incluyen sus límites; los campos vacíos aplican a cualquier valor.
                </p>
                {errorReglasPrecio && (
                  <AlertBox tone="error" title="Revisa las reglas">
                    {errorReglasPrecio}
                  </AlertBox>
                )}
                <form className="form-stack pricing-rules-form" onSubmit={guardarReglasPrecio}>
                  {reglasPrecio.map((regla, index) => (
                    <fieldset className="pricing-rule" key={index}>
                      <legend>Regla {index + 1}</legend>
                      <label className="field">
                        <span>Especie</span>
                        <select
                          className="control"
                          onChange={(event) =>
                            setReglasPrecio((actuales) =>
                              actuales.map((actual, i) =>
                                i === index ? { ...actual, especieId: event.target.value } : actual,
                              ),
                            )
                          }
                          value={regla.especieId}
                        >
                          <option value="">Cualquier especie</option>
                          {especies.map((especie) => (
                            <option key={especie.id} value={especie.id}>
                              {especie.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-two-col">
                        <label className="field">
                          <span>Peso mínimo (kg)</span>
                          <input
                            className="control"
                            min="0"
                            onChange={(event) =>
                              setReglasPrecio((actuales) =>
                                actuales.map((actual, i) =>
                                  i === index
                                    ? { ...actual, pesoMinKg: event.target.value }
                                    : actual,
                                ),
                              )
                            }
                            step="0.01"
                            type="number"
                            value={regla.pesoMinKg}
                          />
                        </label>
                        <label className="field">
                          <span>Peso máximo (kg)</span>
                          <input
                            className="control"
                            min="0"
                            onChange={(event) =>
                              setReglasPrecio((actuales) =>
                                actuales.map((actual, i) =>
                                  i === index
                                    ? { ...actual, pesoMaxKg: event.target.value }
                                    : actual,
                                ),
                              )
                            }
                            step="0.01"
                            type="number"
                            value={regla.pesoMaxKg}
                          />
                        </label>
                        <label className="field">
                          <span>Edad mínima (meses)</span>
                          <input
                            className="control"
                            min="0"
                            onChange={(event) =>
                              setReglasPrecio((actuales) =>
                                actuales.map((actual, i) =>
                                  i === index
                                    ? { ...actual, edadMinMeses: event.target.value }
                                    : actual,
                                ),
                              )
                            }
                            step="1"
                            type="number"
                            value={regla.edadMinMeses}
                          />
                        </label>
                        <label className="field">
                          <span>Edad máxima (meses)</span>
                          <input
                            className="control"
                            min="0"
                            onChange={(event) =>
                              setReglasPrecio((actuales) =>
                                actuales.map((actual, i) =>
                                  i === index
                                    ? { ...actual, edadMaxMeses: event.target.value }
                                    : actual,
                                ),
                              )
                            }
                            step="1"
                            type="number"
                            value={regla.edadMaxMeses}
                          />
                        </label>
                      </div>
                      <div className="form-two-col">
                        <label className="field">
                          <span>Precio (COP)</span>
                          <input
                            className="control"
                            min="0"
                            onChange={(event) =>
                              setReglasPrecio((actuales) =>
                                actuales.map((actual, i) =>
                                  i === index ? { ...actual, precio: event.target.value } : actual,
                                ),
                              )
                            }
                            required
                            step="0.01"
                            type="number"
                            value={regla.precio}
                          />
                        </label>
                        <label className="field">
                          <span>Prioridad</span>
                          <input
                            className="control"
                            max="32767"
                            min="-32768"
                            onChange={(event) =>
                              setReglasPrecio((actuales) =>
                                actuales.map((actual, i) =>
                                  i === index
                                    ? { ...actual, prioridad: event.target.value }
                                    : actual,
                                ),
                              )
                            }
                            step="1"
                            type="number"
                            value={regla.prioridad}
                          />
                        </label>
                      </div>
                      <button
                        className="text-action pricing-rule__remove"
                        onClick={() =>
                          setReglasPrecio((actuales) => actuales.filter((_, i) => i !== index))
                        }
                        type="button"
                      >
                        Eliminar regla
                      </button>
                    </fieldset>
                  ))}
                  {!reglasPrecio.length && (
                    <div className="empty-state empty-state--compact">
                      <h3>Este servicio no tiene reglas</h3>
                      <p>Al guardar sin reglas, las cotizaciones usarán el precio base.</p>
                    </div>
                  )}
                  <VetoButton
                    onClick={() =>
                      setReglasPrecio((actuales) => [...actuales, { ...reglaPrecioVacia }])
                    }
                    variant="secondary"
                  >
                    ＋ Agregar regla
                  </VetoButton>
                  <p className="field__hint">
                    Si varias reglas coinciden, se aplica primero la de mayor prioridad; si empatan,
                    la de mayor precio.
                  </p>
                  <div className="form-actions">
                    <VetoButton onClick={() => setModal(null)} variant="secondary">
                      Cancelar
                    </VetoButton>
                    <VetoButton loading={cargando} type="submit">
                      Guardar reglas
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
                  <CelularField
                    id="veterinario-celular"
                    label="Celular"
                    onChange={(celular) => setVeterinarioForm({ ...veterinarioForm, celular })}
                    required
                    value={veterinarioForm.celular}
                  />
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
    </PanelShell>
  );
}
