import { TUTOR, crearBdFalsa, type Fila, type UsuarioPrueba } from './utilidades';

/**
 * Base de datos simulada para el flujo de reserva (HU-029, HU-030, HU-031): aliado, servicio,
 * veterinarios, calendario, mascotas, citas y la tabla seleccion_horario, con el mismo
 * comportamiento que las consultas reales (una reserva en curso por tutor, citas que ocupan el
 * espacio, estado inicial según la configuración del aliado).
 */

export const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
export const VET = '44444444-4444-4444-8444-444444444444';
export const OTRO_VET = '99999999-9999-4999-8999-999999999999';
export const SERVICIO = '55555555-5555-4555-8555-555555555555';
export const MASCOTA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const OTRA_MASCOTA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const CITA_EXISTENTE = '66666666-6666-4666-8666-666666666666';
export const CITA_NUEVA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const ADMIN_ALIADO = '22222222-2222-4222-8222-222222222222';
export const OTRO_USUARIO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

export const INICIO = '2099-06-03T13:00:00.000Z';
export const FIN = '2099-06-03T13:30:00.000Z';
export const VENCE = '2099-06-03T14:00:00.000Z';
export const PASADO = '2000-01-01T10:00:00.000Z';
export const PASADO_FIN = '2000-01-01T10:30:00.000Z';

export type CitaFalsa = {
  id: string;
  tutor_id: string;
  mascota_id: string;
  veterinario_id: string;
  servicio_id: string;
  inicio: string;
  fin: string;
  estado: 'PENDIENTE' | 'AGENDADA' | 'CANCELADA';
  precio: number;
  motivo: string | null;
  recomendaciones?: string | null;
};

export type BorradorFalso = {
  aliado_id: string;
  servicio_id: string;
  veterinario_id: string;
  inicio: string;
  fin: string;
  mascota_id: string | null;
  motivo: string | null;
  cita_id: string | null;
  vencido: boolean;
};

export type MascotaFalsa = {
  id: string;
  tutor_id: string;
  nombre: string;
  especie_id: number;
  especie: string;
};

export type OpcionesReserva = {
  /** Quién inicia sesión (por defecto el tutor). */
  usuario?: UsuarioPrueba | null;
  servicioNoDisponible?: boolean;
  duracionMin?: number;
  veterinarios?: { id: string; nombre: string }[];
  /** Inicios que ofrece el calendario del veterinario (por defecto, el de INICIO). */
  espacios?: string[];
  /** Reserva en curso que el tutor ya tiene (`null`: ninguna). Por defecto, una sin mascota ni motivo. */
  borrador?: Partial<BorradorFalso> | null;
  mascotas?: MascotaFalsa[];
  atiendeEspecie?: boolean;
  modo?: 'AUTOMATICA' | 'MANUAL';
  precio?: number;
  citas?: CitaFalsa[];
  errorAlCrearCita?: Error;
  /** Usuarios (administrador del aliado, veterinarios) que pueden ver cualquier cita. */
  autorizadosAVer?: string[];
};

const MS_MINUTO = 60_000;

export const MASCOTA_FIRULAIS: MascotaFalsa = {
  id: MASCOTA,
  tutor_id: TUTOR.id,
  nombre: 'Firulais',
  especie_id: 1,
  especie: 'Perro',
};

const solapa = (aIni: number, aFin: number, bIni: number, bFin: number) =>
  aIni < bFin && bIni < aFin;

export function bdReservas(o: OpcionesReserva = {}) {
  const duracion = o.duracionMin ?? 30;
  const estado: { borrador: BorradorFalso | null; citas: CitaFalsa[] } = {
    borrador:
      o.borrador === null
        ? null
        : {
            aliado_id: ALIADO_ID,
            servicio_id: SERVICIO,
            veterinario_id: VET,
            inicio: INICIO,
            fin: FIN,
            mascota_id: null,
            motivo: null,
            cita_id: null,
            vencido: false,
            ...o.borrador,
          },
    citas: [...(o.citas ?? [])],
  };
  const mascotas = o.mascotas ?? [MASCOTA_FIRULAIS];
  const vigentes = () => estado.citas.filter((c) => ['PENDIENTE', 'AGENDADA'].includes(c.estado));

  const filaBorrador = (b: BorradorFalso): Fila => ({
    aliado_id: b.aliado_id,
    servicio_id: b.servicio_id,
    veterinario_id: b.veterinario_id,
    inicio: new Date(b.inicio),
    fin: new Date(b.fin),
    expira_en: new Date(VENCE),
    mascota_id: b.mascota_id,
    motivo: b.motivo,
    cita_id: b.cita_id,
  });

  const fabrica = crearBdFalsa(
    (sql, valores) => {
      // ---- servicio, aliado y veterinarios
      if (sql.includes('JOIN aliado a ON a.id = s.aliado_id')) {
        if (o.servicioNoDisponible) return { rows: [] };
        return {
          rows: [
            {
              id: SERVICIO,
              aliado_id: ALIADO_ID,
              tipo_servicio_id: 1,
              tipo_servicio: 'Consulta general',
              nombre: 'Consulta',
              descripcion: null,
              modalidad: 'A_DOMICILIO',
              sede_id: null,
              duracion_min: duracion,
              precio_base: 60000,
              activo: true,
              creado_en: new Date('2030-01-01'),
            },
          ],
        };
      }
      if (
        sql.includes("SELECT EXISTS (SELECT 1 FROM aliado WHERE id = $1 AND estado = 'ACTIVO')")
      ) {
        return { rows: [{ ok: true }] };
      }
      if (sql.includes('FROM veterinario v JOIN usuario u')) {
        return { rows: o.veterinarios ?? [{ id: VET, nombre: 'Dra. Ana' }] };
      }
      if (sql.includes('SELECT id, tipo, nombre, descripcion')) {
        return {
          rows: [
            {
              id: ALIADO_ID,
              tipo: 'CLINICA',
              nombre: 'Clínica Central',
              descripcion: null,
              logo_url: null,
              contacto: null,
              ciudad: 'Cali',
              ubicacion: null,
            },
          ],
        };
      }
      if (sql.includes('SELECT modo_confirmacion FROM aliado')) {
        return { rows: [{ modo_confirmacion: o.modo ?? 'AUTOMATICA' }] };
      }
      if (sql.includes('FROM aliado_especie WHERE aliado_id = $1 AND especie_id')) {
        return { rows: [{ ok: o.atiendeEspecie ?? true }] };
      }
      if (sql.includes('fn_precio_servicio($1, $2)::float8')) {
        return { rows: [{ precio: o.precio ?? 60000 }] };
      }

      // ---- mascotas
      if (sql.includes('FROM mascota m')) {
        const m = mascotas.find((x) => x.id === valores[0] && x.tutor_id === valores[1]);
        if (!m) return { rows: [] };
        return {
          rows: [
            {
              id: m.id,
              nombre: m.nombre,
              especie_id: m.especie_id,
              especie: m.especie,
              sexo: 'MACHO',
              raza: null,
              fecha_nacimiento: null,
              edad_meses: null,
              color: null,
              peso_kg: null,
              chip: null,
              fotos: [],
              creado_en: new Date('2030-01-01'),
            },
          ],
        };
      }

      // ---- calendario: espacios libres y citas que ocupan
      if (sql.includes('veterinario_id = ANY($1::uuid[])')) {
        return {
          rows: vigentes().map((c) => ({
            veterinario_id: c.veterinario_id,
            inicio: new Date(c.inicio),
            fin: new Date(c.fin),
          })),
        };
      }
      if (sql.includes('WITH dias AS')) {
        const inicios = o.espacios ?? [INICIO];
        return {
          rows: inicios
            .filter(
              (i) =>
                !vigentes().some(
                  (c) =>
                    c.veterinario_id === VET &&
                    solapa(
                      Date.parse(i),
                      Date.parse(i) + duracion * MS_MINUTO,
                      Date.parse(c.inicio),
                      Date.parse(c.fin),
                    ),
                ),
            )
            .map((i) => ({
              veterinario_id: VET,
              inicio: new Date(i),
              fin: new Date(Date.parse(i) + duracion * MS_MINUTO),
            })),
        };
      }
      if (sql.includes('tstzrange($2::timestamptz')) {
        const ini = Date.parse(valores[1] as string);
        const fin = Date.parse(valores[2] as string);
        return {
          rows: vigentes()
            .filter(
              (c) =>
                c.veterinario_id === valores[0] &&
                solapa(ini, fin, Date.parse(c.inicio), Date.parse(c.fin)),
            )
            .map((c) => ({
              id: c.id,
              inicio: new Date(c.inicio),
              fin: new Date(c.fin),
              estado: c.estado,
            })),
        };
      }

      // ---- reserva en curso (tabla seleccion_horario)
      if (sql.includes('INSERT INTO seleccion_horario')) {
        const previo = estado.borrador;
        const conserva = previo !== null && !previo.vencido;
        estado.borrador = {
          aliado_id: valores[1] as string,
          servicio_id: valores[2] as string,
          veterinario_id: valores[3] as string,
          inicio: valores[4] as string,
          fin: valores[5] as string,
          mascota_id: conserva ? previo.mascota_id : null,
          motivo: conserva && !previo.cita_id ? previo.motivo : null,
          cita_id: null,
          vencido: false,
        };
        return {
          rows: [
            {
              expira_en: new Date(VENCE),
              mascota_id: estado.borrador.mascota_id,
              motivo: estado.borrador.motivo,
            },
          ],
        };
      }
      if (sql.includes('UPDATE seleccion_horario') && sql.includes('SET mascota_id = CASE')) {
        const b = estado.borrador;
        if (!b || b.vencido || b.cita_id) return { rows: [], rowCount: 0 };
        if (valores[1]) b.mascota_id = valores[2] as string | null;
        if (valores[3]) b.motivo = valores[4] as string | null;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE seleccion_horario SET cita_id')) {
        if (estado.borrador) estado.borrador.cita_id = valores[1] as string;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM seleccion_horario')) {
        estado.borrador = null;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM seleccion_horario')) {
        const b = estado.borrador;
        if (!b) return { rows: [] };
        const paraReservar = sql.includes('FOR UPDATE');
        if (b.vencido && !(paraReservar && b.cita_id)) return { rows: [] };
        return { rows: [filaBorrador(b)] };
      }

      // ---- citas
      if (sql.includes('INSERT INTO cita')) {
        if (o.errorAlCrearCita) throw o.errorAlCrearCita;
        const cita: CitaFalsa = {
          id: CITA_NUEVA,
          tutor_id: valores[0] as string,
          mascota_id: valores[1] as string,
          servicio_id: valores[3] as string,
          veterinario_id: valores[4] as string,
          inicio: valores[5] as string,
          fin: valores[6] as string,
          estado: o.modo === 'MANUAL' ? 'PENDIENTE' : 'AGENDADA',
          precio: o.precio ?? 60000,
          motivo: valores[7] as string | null,
        };
        estado.citas.push(cita);
        return { rows: [{ id: cita.id }] };
      }
      if (sql.includes('mascota_id = $2 AND servicio_id = $3 AND inicio = $4')) {
        const igual = vigentes().find(
          (c) =>
            c.tutor_id === valores[0] &&
            c.mascota_id === valores[1] &&
            c.servicio_id === valores[2] &&
            Date.parse(c.inicio) === Date.parse(valores[3] as string),
        );
        return { rows: igual ? [{ id: igual.id }] : [] };
      }
      if (sql.includes('FROM v_cita_detalle d')) {
        const c = estado.citas.find((x) => x.id === valores[0]);
        if (!c) return { rows: [] };
        // Con 2 parámetros se pide con permiso: solo su tutor y los autorizados
        if (valores.length > 1) {
          const permitidos = [c.tutor_id, ...(o.autorizadosAVer ?? [])];
          if (!permitidos.includes(valores[1] as string)) return { rows: [] };
        }
        const m = mascotas.find((x) => x.id === c.mascota_id) ?? MASCOTA_FIRULAIS;
        return {
          rows: [
            {
              id: c.id,
              estado: c.estado,
              inicio: new Date(c.inicio),
              fin: new Date(c.fin),
              precio: String(c.precio),
              motivo: c.motivo,
              recomendaciones: c.recomendaciones ?? null,
              creado_en: new Date('2099-01-01T00:00:00Z'),
              tutor_id: c.tutor_id,
              tutor_nombre: 'Ana Tutor',
              mascota_id: c.mascota_id,
              mascota_nombre: m.nombre,
              especie: m.especie,
              aliado_id: ALIADO_ID,
              aliado_nombre: 'Clínica Central',
              servicio_id: c.servicio_id,
              servicio_nombre: 'Consulta',
              veterinario_id: c.veterinario_id,
              veterinario_nombre: 'Dra. Ana',
            },
          ],
        };
      }
    },
    o.usuario === undefined ? TUTOR : (o.usuario as UsuarioPrueba),
  );

  return { ...fabrica, estado };
}

/** Cuerpo de PUT /reservas/seleccion con lo que el calendario ofreció. */
export const eleccion = (extra: Record<string, unknown> = {}) => ({
  servicioId: SERVICIO,
  veterinarioId: VET,
  inicio: INICIO,
  ...extra,
});

export const citaExistente = (extra: Partial<CitaFalsa> = {}): CitaFalsa => ({
  id: CITA_EXISTENTE,
  tutor_id: OTRO_USUARIO,
  mascota_id: OTRA_MASCOTA,
  veterinario_id: VET,
  servicio_id: SERVICIO,
  inicio: INICIO,
  fin: FIN,
  estado: 'AGENDADA',
  precio: 60000,
  motivo: null,
  ...extra,
});
