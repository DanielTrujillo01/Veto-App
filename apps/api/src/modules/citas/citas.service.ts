import { Injectable } from '@nestjs/common';
import {
  MINUTOS_VIGENCIA_SELECCION,
  type CambioDeEstado,
  type CitaDetalle,
  type EstadoCita,
  type EstadoDeCierre,
} from '@veto/shared';
import type { PoolClient } from 'pg';
import type { Consultor } from '../../database/database.service';

/** Reserva en curso del tutor (tabla seleccion_horario), tal como la usan los demás módulos. */
export type SeleccionGuardada = {
  aliadoId: string;
  servicioId: string;
  veterinarioId: string;
  inicio: string;
  fin: string;
  venceEn: string;
  mascotaId: string | null;
  motivo: string | null;
  /** Cita en que terminó la reserva; `null` mientras no se confirme. */
  citaId: string | null;
};

type SeleccionRow = {
  aliado_id: string;
  servicio_id: string;
  veterinario_id: string;
  inicio: Date | string;
  fin: Date | string;
  expira_en: Date | string;
  mascota_id: string | null;
  motivo: string | null;
  cita_id: string | null;
};

const SELECT_SELECCION = `SELECT aliado_id, servicio_id, veterinario_id, inicio, fin, expira_en,
        mascota_id, motivo, cita_id
   FROM seleccion_horario`;

function aSeleccion(fila: SeleccionRow): SeleccionGuardada {
  return {
    aliadoId: fila.aliado_id,
    servicioId: fila.servicio_id,
    veterinarioId: fila.veterinario_id,
    inicio: new Date(fila.inicio).toISOString(),
    fin: new Date(fila.fin).toISOString(),
    venceEn: new Date(fila.expira_en).toISOString(),
    mascotaId: fila.mascota_id,
    motivo: fila.motivo,
    citaId: fila.cita_id,
  };
}

type DetalleRow = {
  id: string;
  estado: EstadoCita;
  inicio: Date | string;
  fin: Date | string;
  precio: string | number;
  motivo: string | null;
  creado_en: Date | string;
  tutor_id: string;
  tutor_nombre: string;
  mascota_id: string;
  mascota_nombre: string;
  especie: string;
  aliado_id: string;
  aliado_nombre: string;
  servicio_id: string;
  servicio_nombre: string;
  veterinario_id: string | null;
  veterinario_nombre: string | null;
  recomendaciones: string | null;
};

// La vista v_cita_detalle (migración 0013) une la cita con los nombres que se muestran.
const SELECT_DETALLE = `SELECT d.id, d.estado, d.inicio, d.fin, d.precio, d.motivo, d.creado_en,
        d.tutor_id, d.tutor_nombre, d.mascota_id, d.mascota_nombre, d.especie,
        d.aliado_id, d.aliado_nombre, d.servicio_id, d.servicio_nombre,
        d.veterinario_id, d.veterinario_nombre, d.recomendaciones
   FROM v_cita_detalle d`;

function aDetalle(f: DetalleRow): CitaDetalle {
  return {
    id: f.id,
    estado: f.estado,
    inicio: new Date(f.inicio).toISOString(),
    fin: new Date(f.fin).toISOString(),
    precio: Number(f.precio),
    motivo: f.motivo,
    recomendaciones: f.recomendaciones ?? null,
    creadaEn: new Date(f.creado_en).toISOString(),
    tutor: { id: f.tutor_id, nombre: f.tutor_nombre },
    mascota: { id: f.mascota_id, nombre: f.mascota_nombre, especie: f.especie },
    aliado: { id: f.aliado_id, nombre: f.aliado_nombre },
    servicio: { id: f.servicio_id, nombre: f.servicio_nombre },
    veterinario:
      f.veterinario_id && f.veterinario_nombre
        ? { id: f.veterinario_id, nombre: f.veterinario_nombre }
        : null,
  };
}

/**
 * Operaciones sobre citas que otros módulos necesitan. Reciben el `client` de la transacción
 * abierta con `DatabaseService.withUser` para que todo ocurra en la misma transacción.
 */
@Injectable()
export class CitasService {
  /** HU-006: al eliminar la cuenta se cancelan sus citas futuras, confirmadas o pendientes (el trigger registra el historial). */
  async cancelarFuturasDelTutor(client: PoolClient, tutorId: string): Promise<number> {
    const resultado = await client.query(
      `UPDATE cita SET estado = 'CANCELADA'
        WHERE tutor_id = $1 AND estado IN ('PENDIENTE', 'AGENDADA') AND inicio > now()`,
      [tutorId],
    );
    return resultado.rowCount ?? 0;
  }

  /**
   * HU-022: citas vigentes (PENDIENTE o AGENDADA) de un veterinario que se cruzan con
   * [inicio, fin). Sirve para avisar qué hay que reprogramar antes de bloquear ese intervalo.
   */
  async vigentesEnIntervalo(
    client: Consultor,
    veterinarioId: string,
    inicio: string,
    fin: string,
  ): Promise<{ id: string; inicio: string; fin: string; estado: string }[]> {
    const r = await client.query<{
      id: string;
      inicio: Date | string;
      fin: Date | string;
      estado: string;
    }>(
      `SELECT id, inicio, fin, estado FROM cita
        WHERE veterinario_id = $1 AND estado IN ('PENDIENTE', 'AGENDADA')
          AND tstzrange(inicio, fin) && tstzrange($2::timestamptz, $3::timestamptz)
        ORDER BY inicio`,
      [veterinarioId, inicio, fin],
    );
    return r.rows.map((c) => ({
      id: c.id,
      inicio: new Date(c.inicio).toISOString(),
      fin: new Date(c.fin).toISOString(),
      estado: c.estado,
    }));
  }

  /**
   * HU-022: espacios ocupados (citas PENDIENTE o AGENDADA que no terminaron) de varios
   * veterinarios entre dos fechas de calendario, ambas incluidas. El calendario del tutor
   * descuenta estos intervalos de la atención.
   */
  async ocupadosEntre(
    client: Consultor,
    veterinarioIds: string[],
    desde: string,
    hasta: string,
  ): Promise<{ veterinarioId: string; inicio: string; fin: string }[]> {
    if (veterinarioIds.length === 0) return [];
    const r = await client.query<{
      veterinario_id: string;
      inicio: Date | string;
      fin: Date | string;
    }>(
      `SELECT veterinario_id, inicio, fin FROM cita
        WHERE veterinario_id = ANY($1::uuid[]) AND estado IN ('PENDIENTE', 'AGENDADA')
          AND fin > $2::date::timestamptz AND inicio < ($3::date + 1)::timestamptz`,
      [veterinarioIds, desde, hasta],
    );
    return r.rows.map((c) => ({
      veterinarioId: c.veterinario_id,
      inicio: new Date(c.inicio).toISOString(),
      fin: new Date(c.fin).toISOString(),
    }));
  }

  /**
   * HU-029: guarda la fecha y hora que el tutor eligió (una por tutor: elegir otra reemplaza la
   * anterior) y la conserva `MINUTOS_VIGENCIA_SELECCION` minutos. No reserva el espacio: eso lo
   * hace la creación de la cita (HU-031). Quien llama ya comprobó que el espacio está libre.
   *
   * Lo que el tutor ya había completado se conserva al cambiar de horario: la mascota (es de él,
   * no del horario) y el motivo, salvo que la reserva anterior ya se haya confirmado o haya
   * vencido, que entonces se empieza de cero.
   */
  async guardarSeleccion(
    client: PoolClient,
    datos: {
      tutorId: string;
      aliadoId: string;
      servicioId: string;
      veterinarioId: string;
      inicio: string;
      fin: string;
    },
  ): Promise<{ venceEn: string; mascotaId: string | null; motivo: string | null }> {
    const r = await client.query<{
      expira_en: Date | string;
      mascota_id: string | null;
      motivo: string | null;
    }>(
      `INSERT INTO seleccion_horario
              (tutor_id, aliado_id, servicio_id, veterinario_id, inicio, fin, actualizado_en, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, now(), now() + make_interval(mins => $7))
       ON CONFLICT (tutor_id) DO UPDATE
          SET aliado_id = EXCLUDED.aliado_id, servicio_id = EXCLUDED.servicio_id,
              veterinario_id = EXCLUDED.veterinario_id, inicio = EXCLUDED.inicio,
              fin = EXCLUDED.fin, actualizado_en = EXCLUDED.actualizado_en,
              expira_en = EXCLUDED.expira_en,
              mascota_id = CASE WHEN seleccion_horario.expira_en > now()
                                THEN seleccion_horario.mascota_id END,
              motivo = CASE WHEN seleccion_horario.expira_en > now()
                                 AND seleccion_horario.cita_id IS NULL
                            THEN seleccion_horario.motivo END,
              cita_id = NULL
       RETURNING expira_en, mascota_id, motivo`,
      [
        datos.tutorId,
        datos.aliadoId,
        datos.servicioId,
        datos.veterinarioId,
        datos.inicio,
        datos.fin,
        MINUTOS_VIGENCIA_SELECCION,
      ],
    );
    const fila = r.rows[0];
    return {
      venceEn: new Date(fila.expira_en).toISOString(),
      mascotaId: fila.mascota_id,
      motivo: fila.motivo,
    };
  }

  /** HU-029: la reserva en curso del tutor, o `null` si no tiene o ya venció. */
  async obtenerSeleccion(client: Consultor, tutorId: string): Promise<SeleccionGuardada | null> {
    const r = await client.query<SeleccionRow>(
      `${SELECT_SELECCION} WHERE tutor_id = $1 AND expira_en > now()`,
      [tutorId],
    );
    return r.rows[0] ? aSeleccion(r.rows[0]) : null;
  }

  /**
   * HU-031: la reserva en curso, bloqueada para que dos confirmaciones del mismo tutor (doble
   * clic, reintento) no corran a la vez: la segunda espera, ve la cita que creó la primera y la
   * devuelve. También devuelve la que ya se confirmó aunque haya vencido, para poder repetir
   * la respuesta de un reintento tardío.
   */
  async obtenerSeleccionParaReservar(
    client: PoolClient,
    tutorId: string,
  ): Promise<SeleccionGuardada | null> {
    const r = await client.query<SeleccionRow>(
      `${SELECT_SELECCION}
        WHERE tutor_id = $1 AND (expira_en > now() OR cita_id IS NOT NULL)
          FOR UPDATE`,
      [tutorId],
    );
    return r.rows[0] ? aSeleccion(r.rows[0]) : null;
  }

  /**
   * HU-030 y HU-031: guarda la mascota y/o el motivo elegidos (solo lo que se indica; `null`
   * quita el motivo) y renueva la vigencia, porque la persona sigue en el flujo. Devuelve false
   * si ya no hay una reserva en curso sin confirmar.
   */
  async actualizarSeleccion(
    client: PoolClient,
    tutorId: string,
    cambios: { mascotaId?: string; motivo?: string | null },
  ): Promise<boolean> {
    const r = await client.query(
      `UPDATE seleccion_horario
          SET mascota_id = CASE WHEN $2::boolean THEN $3::uuid ELSE mascota_id END,
              motivo = CASE WHEN $4::boolean THEN $5::text ELSE motivo END,
              actualizado_en = now(),
              expira_en = now() + make_interval(mins => $6)
        WHERE tutor_id = $1 AND expira_en > now() AND cita_id IS NULL`,
      [
        tutorId,
        cambios.mascotaId !== undefined,
        cambios.mascotaId ?? null,
        cambios.motivo !== undefined,
        cambios.motivo ?? null,
        MINUTOS_VIGENCIA_SELECCION,
      ],
    );
    return (r.rowCount ?? 0) > 0;
  }

  /** HU-031: deja la reserva en curso apuntando a la cita que se creó con ella. */
  async marcarSeleccionReservada(
    client: PoolClient,
    tutorId: string,
    citaId: string,
  ): Promise<void> {
    await client.query('UPDATE seleccion_horario SET cita_id = $2 WHERE tutor_id = $1', [
      tutorId,
      citaId,
    ]);
  }

  /** HU-029: descarta la selección del tutor (no falla si no tenía). */
  async eliminarSeleccion(client: PoolClient, tutorId: string): Promise<void> {
    await client.query('DELETE FROM seleccion_horario WHERE tutor_id = $1', [tutorId]);
  }

  /**
   * HU-031: crea la cita. El precio es el de ese servicio para esa mascota en este momento
   * (`fn_precio_servicio`) y queda como instantánea. El estado inicial NO se pide: la base lo
   * fija según la configuración del aliado (AGENDADA o PENDIENTE, HU-023) y valida horario,
   * bloqueos, solapamientos, especie y que el servicio esté disponible. Los errores de esas
   * reglas llegan como errores de PostgreSQL (23P01, 23505, 23514) para quien llama.
   */
  async crearCita(
    client: PoolClient,
    datos: {
      tutorId: string;
      mascotaId: string;
      aliadoId: string;
      servicioId: string;
      veterinarioId: string;
      inicio: string;
      fin: string;
      motivo: string | null;
    },
  ): Promise<string> {
    const r = await client.query<{ id: string }>(
      `INSERT INTO cita (tutor_id, mascota_id, aliado_id, servicio_id, veterinario_id,
                         inicio, fin, precio, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, fn_precio_servicio($4, $2), $8)
       RETURNING id`,
      [
        datos.tutorId,
        datos.mascotaId,
        datos.aliadoId,
        datos.servicioId,
        datos.veterinarioId,
        datos.inicio,
        datos.fin,
        datos.motivo,
      ],
    );
    return r.rows[0].id;
  }

  /** HU-031: id de la cita vigente (PENDIENTE o AGENDADA) igual a esta, si el tutor ya la tiene. */
  async buscarVigenteIgual(
    client: Consultor,
    datos: { tutorId: string; mascotaId: string; servicioId: string; inicio: string },
  ): Promise<string | null> {
    const r = await client.query<{ id: string }>(
      `SELECT id FROM cita
        WHERE tutor_id = $1 AND mascota_id = $2 AND servicio_id = $3 AND inicio = $4
          AND estado IN ('PENDIENTE', 'AGENDADA')`,
      [datos.tutorId, datos.mascotaId, datos.servicioId, datos.inicio],
    );
    return r.rows[0]?.id ?? null;
  }

  /**
   * HU-030 y HU-031: la cita con sus nombres, solo si `usuarioId` puede verla: es su tutor, el
   * administrador del aliado o un veterinario activo del aliado (las mismas personas que la base
   * reconoce como "el aliado" al finalizar una cita). Si no, `null`: no se distingue entre una
   * cita que no existe y una ajena.
   */
  async detalleVisiblePara(
    client: Consultor,
    citaId: string,
    usuarioId: string,
  ): Promise<CitaDetalle | null> {
    const r = await client.query<DetalleRow>(
      `${SELECT_DETALLE}
        WHERE d.id = $1
          AND (d.tutor_id = $2 OR d.aliado_usuario_id = $2
               OR EXISTS (SELECT 1 FROM veterinario v
                           WHERE v.aliado_id = d.aliado_id AND v.usuario_id = $2 AND v.activo))`,
      [citaId, usuarioId],
    );
    return r.rows[0] ? aDetalle(r.rows[0]) : null;
  }

  /**
   * Agenda de citas para quien atiende o administra (no para el tutor): el administrador del
   * aliado ve todas las citas del aliado; un veterinario activo, solo las asignadas a él. Las
   * mismas personas que pueden abrir el detalle y cerrar la cita (HU-032, HU-033).
   */
  async agendaPara(
    client: Consultor,
    usuarioId: string,
    filtros: { estado: EstadoCita | null; limite: number },
  ): Promise<CitaDetalle[]> {
    const r = await client.query<DetalleRow>(
      `${SELECT_DETALLE}
        WHERE (d.aliado_usuario_id = $1
               OR EXISTS (SELECT 1 FROM veterinario v
                           WHERE v.id = d.veterinario_id AND v.usuario_id = $1 AND v.activo))
          AND ($2::estado_cita IS NULL OR d.estado = $2::estado_cita)
        ORDER BY d.inicio DESC, d.id
        LIMIT $3`,
      [usuarioId, filtros.estado, filtros.limite],
    );
    return r.rows.map(aDetalle);
  }

  /** Para quien ya comprobó el permiso (por ejemplo, el tutor que acaba de crear la cita). */
  async detalle(client: Consultor, citaId: string): Promise<CitaDetalle | null> {
    const r = await client.query<DetalleRow>(`${SELECT_DETALLE} WHERE d.id = $1`, [citaId]);
    return r.rows[0] ? aDetalle(r.rows[0]) : null;
  }

  /**
   * HU-032: la cita bloqueada para decidir y cambiarle el estado sin que otra petición se
   * cruce. `yaOcurrio` se calcula con el reloj de la base (la hora de inicio ya llegó).
   */
  async bloquearParaCierre(
    client: PoolClient,
    citaId: string,
  ): Promise<{
    id: string;
    aliadoId: string;
    estado: EstadoCita;
    yaOcurrio: boolean;
  } | null> {
    const r = await client.query<{
      id: string;
      aliado_id: string;
      estado: EstadoCita;
      ya_ocurrio: boolean;
    }>(
      `SELECT id, aliado_id, estado, (inicio <= now()) AS ya_ocurrio
         FROM cita WHERE id = $1 FOR UPDATE`,
      [citaId],
    );
    const fila = r.rows[0];
    return fila
      ? { id: fila.id, aliadoId: fila.aliado_id, estado: fila.estado, yaOcurrio: fila.ya_ocurrio }
      : null;
  }

  /**
   * HU-032, HU-033: ¿`usuarioId` es el administrador del aliado o un veterinario activo de él?
   * Es la misma definición de "el aliado" que usa fn_cita_validar al finalizar una cita.
   */
  async puedeGestionar(client: Consultor, aliadoId: string, usuarioId: string): Promise<boolean> {
    const r = await client.query<{ ok: boolean }>(
      `SELECT (EXISTS (SELECT 1 FROM aliado WHERE id = $1 AND usuario_id = $2)
            OR EXISTS (SELECT 1 FROM veterinario
                        WHERE aliado_id = $1 AND usuario_id = $2 AND activo)) AS ok`,
      [aliadoId, usuarioId],
    );
    return Boolean(r.rows[0]?.ok);
  }

  /**
   * HU-032, HU-033: pasa una cita AGENDADA, cuya hora ya llegó, a FINALIZADA o NO_ASISTIO. Las
   * recomendaciones (solo al finalizar) se guardan en la misma sentencia. La observación viaja
   * en `app.motivo` y la base la anota en `historial_estado` junto con el responsable
   * (`app.usuario_id`, que ya dejó `DatabaseService.withUser`). La transición la valida
   * fn_cita_validar; aquí solo se repiten las condiciones para que nada cambie si otra petición
   * ganó antes. Devuelve null si no se actualizó nada.
   */
  async cerrar(
    client: PoolClient,
    datos: {
      citaId: string;
      estado: EstadoDeCierre;
      observacion: string | null;
      recomendaciones: string | null;
    },
  ): Promise<{ actualizadoEn: string; actualizadoPor: string } | null> {
    await client.query("SELECT set_config('app.motivo', $1, true)", [datos.observacion ?? '']);
    const r = await client.query(
      `UPDATE cita
          SET estado = $2::estado_cita, recomendaciones = COALESCE($3::text, recomendaciones)
        WHERE id = $1 AND estado = 'AGENDADA' AND inicio <= now()`,
      [datos.citaId, datos.estado, datos.recomendaciones],
    );
    if ((r.rowCount ?? 0) === 0) return null;
    const h = await client.query<{ cambiado_en: Date | string; cambiado_por: string }>(
      `SELECT cambiado_en, cambiado_por FROM historial_estado
        WHERE entidad = 'cita' AND entidad_id = $1 ORDER BY id DESC LIMIT 1`,
      [datos.citaId],
    );
    const fila = h.rows[0];
    return {
      actualizadoEn: new Date(fila.cambiado_en).toISOString(),
      actualizadoPor: fila.cambiado_por,
    };
  }

  /** HU-032: los cambios de estado de una cita, del más antiguo al más reciente. */
  async historial(
    client: Consultor,
    citaId: string,
    conObservacion: boolean,
  ): Promise<CambioDeEstado[]> {
    const r = await client.query<{
      estado_anterior: EstadoCita | null;
      estado_nuevo: EstadoCita;
      cambiado_por: string | null;
      motivo: string | null;
      cambiado_en: Date | string;
    }>(
      `SELECT estado_anterior, estado_nuevo, cambiado_por, motivo, cambiado_en
         FROM historial_estado
        WHERE entidad = 'cita' AND entidad_id = $1 ORDER BY id`,
      [citaId],
    );
    return r.rows.map((h) => ({
      estadoAnterior: h.estado_anterior,
      estadoNuevo: h.estado_nuevo,
      cambiadoEn: new Date(h.cambiado_en).toISOString(),
      cambiadoPor: h.cambiado_por,
      observacion: conObservacion ? h.motivo : null,
    }));
  }

  /** HU-018: indica si un servicio ya tiene citas (de cualquier estado). */
  async servicioTieneCitas(client: PoolClient, servicioId: string): Promise<boolean> {
    const resultado = await client.query(
      'SELECT EXISTS (SELECT 1 FROM cita WHERE servicio_id = $1) AS tiene',
      [servicioId],
    );
    return Boolean(resultado.rows[0]?.tiene);
  }
}
