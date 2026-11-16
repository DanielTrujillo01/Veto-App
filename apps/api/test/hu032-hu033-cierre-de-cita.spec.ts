import request from 'supertest';
import {
  OBSERVACION_CITA_MAX_CARACTERES,
  RECOMENDACIONES_MAX_CARACTERES,
  type EstadoCita,
} from '@veto/shared';
import { GestionCitasModule } from '../src/modules/gestion-citas/gestion-citas.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, type UsuarioPrueba } from './utilidades';

const CITA = '66666666-6666-4666-8666-666666666666';
const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const VET_USER: UsuarioPrueba = {
  ...ALIADO,
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  nombre: 'Dra. Ana',
  rol: 'VETERINARIO',
};
const CAMBIO = '2099-06-03T14:05:00.000Z';
const INICIO = '2099-06-03T13:00:00.000Z';
const FIN = '2099-06-03T13:30:00.000Z';

type Escenario = {
  usuario?: UsuarioPrueba | null;
  /** La cita no existe. */
  sinCita?: boolean;
  estado?: EstadoCita;
  yaOcurrio?: boolean;
  puedeGestionar?: boolean;
  recomendacionesGuardadas?: string | null;
  /** Error al actualizar la cita (por ejemplo, una regla de fn_cita_validar). */
  errorAlActualizar?: Error;
  /** La notificación no se puede crear. */
  fallaLaNotificacion?: boolean;
  /** Quién puede ver la cita en el historial (además de su tutor). */
  autorizadosAVer?: string[];
  historial?: {
    estado_anterior: string | null;
    estado_nuevo: string;
    cambiado_por: string | null;
    motivo: string | null;
    cambiado_en: Date;
  }[];
};

/** Simula la cita, el permiso del usuario, el historial y las notificaciones. */
function bdCierre(e: Escenario = {}) {
  let recomendaciones = e.recomendacionesGuardadas ?? null;
  let estado: EstadoCita = e.estado ?? 'AGENDADA';
  return crearBdFalsa(
    (sql, valores) => {
      if (sql.includes('FROM cita WHERE id = $1 FOR UPDATE')) {
        if (e.sinCita) return { rows: [] };
        return {
          rows: [{ id: CITA, aliado_id: ALIADO_ID, estado, ya_ocurrio: e.yaOcurrio ?? true }],
        };
      }
      if (sql.includes('SELECT (EXISTS (SELECT 1 FROM aliado WHERE id = $1 AND usuario_id = $2)')) {
        return { rows: [{ ok: e.puedeGestionar ?? true }] };
      }
      if (sql.includes('UPDATE cita')) {
        if (e.errorAlActualizar) throw e.errorAlActualizar;
        estado = valores[1] as EstadoCita;
        if (valores[2] !== null) recomendaciones = valores[2] as string;
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('FROM historial_estado') && sql.includes('LIMIT 1')) {
        return { rows: [{ cambiado_en: new Date(CAMBIO), cambiado_por: ALIADO.id }] };
      }
      if (sql.includes('FROM historial_estado')) return { rows: e.historial ?? [] };
      if (sql.includes('FROM v_cita_detalle d')) {
        if (e.sinCita) return { rows: [] };
        if (valores.length > 1) {
          const permitidos = [TUTOR.id, ...(e.autorizadosAVer ?? [])];
          if (!permitidos.includes(valores[1] as string)) return { rows: [] };
        }
        return {
          rows: [
            {
              id: CITA,
              estado,
              inicio: new Date(INICIO),
              fin: new Date(FIN),
              precio: '60000',
              motivo: 'Vómito desde ayer',
              recomendaciones,
              creado_en: new Date('2099-01-01T00:00:00Z'),
              tutor_id: TUTOR.id,
              tutor_nombre: 'Ana Tutor',
              mascota_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              mascota_nombre: 'Firulais',
              especie: 'Perro',
              aliado_id: ALIADO_ID,
              aliado_nombre: 'Clínica Central',
              servicio_id: '55555555-5555-4555-8555-555555555555',
              servicio_nombre: 'Consulta',
              veterinario_id: '44444444-4444-4444-8444-444444444444',
              veterinario_nombre: 'Dra. Ana',
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO notificacion') && e.fallaLaNotificacion) {
        throw new Error('no se pudo crear la notificación');
      }
    },
    e.usuario === undefined ? ALIADO : (e.usuario as UsuarioPrueba),
  );
}

const finalizar = (id = CITA) => `/api/citas/${id}/finalizar`;
const noAsistio = (id = CITA) => `/api/citas/${id}/no-asistio`;
const historial = (id = CITA) => `/api/citas/${id}/historial`;

const sentencias = (consultas: { sql: string }[]) => consultas.map((c) => c.sql);
const indiceDe = (consultas: { sql: string }[], texto: string) =>
  sentencias(consultas).findIndex((sql) => sql.includes(texto));
const hayEscritura = (consultas: { sql: string }[]) =>
  consultas.some(
    (c) => c.sql.includes('UPDATE cita') || c.sql.includes('INSERT INTO notificacion'),
  );

describe('HU-032 · finalizar una cita', () => {
  it('la marca FINALIZADA a nombre de quien la cierra y devuelve la cita actualizada', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toMatchObject({
      id: CITA,
      estado: 'FINALIZADA',
      actualizadoEn: CAMBIO,
      actualizadoPor: ALIADO.id,
      mascota: { nombre: 'Firulais' },
      aliado: { nombre: 'Clínica Central' },
    });
    const cambio = consultas.find((c) => c.sql.includes('UPDATE cita'));
    expect(cambio?.usuarioTx).toBe(ALIADO.id);
    // [cita, estado, recomendaciones]
    expect(cambio?.valores).toEqual([CITA, 'FINALIZADA', null]);
    // finalizar no lleva observación: el historial queda sin nota
    const motivo = consultas.find((c) => c.sql.includes("set_config('app.motivo'"));
    expect(motivo?.valores).toEqual(['']);
    await app.close();
  });

  it('no guarda una observación aunque se envíe: solo la inasistencia la lleva', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .send({ observacion: 'Nota que no debería guardarse', recomendaciones: 'Reposo' })
      .expect(200);
    expect(consultas.find((c) => c.sql.includes("set_config('app.motivo'"))?.valores).toEqual(['']);
    expect(consultas.find((c) => c.sql.includes('UPDATE cita'))?.valores).toEqual([
      CITA,
      'FINALIZADA',
      'Reposo',
    ]);
    await app.close();
  });

  it('guarda las recomendaciones junto con el cambio de estado y el tutor las ve', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .send({ recomendaciones: '  Dieta blanda por 3 días y control en una semana.  ' })
      .expect(200);
    expect(r.body.recomendaciones).toBe('Dieta blanda por 3 días y control en una semana.');
    const cambio = consultas.find((c) => c.sql.includes('UPDATE cita'));
    expect(cambio?.valores).toEqual([
      CITA,
      'FINALIZADA',
      'Dieta blanda por 3 días y control en una semana.',
    ]);
    // en la misma sentencia: estado y recomendaciones no se guardan por separado
    expect(cambio?.sql).toContain('recomendaciones = COALESCE($3::text, recomendaciones)');
    await app.close();
  });

  it('el cuerpo es opcional: sin recomendaciones también finaliza', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.estado).toBe('FINALIZADA');
    expect(consultas.find((c) => c.sql.includes("set_config('app.motivo'"))?.valores).toEqual(['']);
    expect(consultas.find((c) => c.sql.includes('UPDATE cita'))?.valores[2]).toBeNull();
    await app.close();
  });

  it.each([
    ['vacías', { recomendaciones: '   ' }],
    ['null', { recomendaciones: null }],
  ])('unas recomendaciones %s se toman como ausentes', async (_caso, cuerpo) => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .send(cuerpo)
      .expect(200);
    expect(consultas.find((c) => c.sql.includes("set_config('app.motivo'"))?.valores).toEqual(['']);
    expect(consultas.find((c) => c.sql.includes('UPDATE cita'))?.valores[2]).toBeNull();
    await app.close();
  });

  it('un veterinario del aliado también puede', async () => {
    const { db, consultas } = bdCierre({ usuario: VET_USER });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.estado).toBe('FINALIZADA');
    expect(consultas.find((c) => c.sql.includes('UPDATE cita'))?.usuarioTx).toBe(VET_USER.id);
    await app.close();
  });

  it('comprueba la hora con el reloj de la base de datos, no con el de la aplicación', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    await request(app.getHttpServer()).patch(finalizar()).set('Cookie', COOKIE).expect(200);
    const lectura = consultas.find((c) => c.sql.includes('FOR UPDATE'));
    expect(lectura?.sql).toContain('inicio <= now()');
    // y al actualizar repite las condiciones, para que nada cambie si otra petición ganó antes
    const cambio = consultas.find((c) => c.sql.includes('UPDATE cita'));
    expect(cambio?.sql).toContain("estado = 'AGENDADA' AND inicio <= now()");
    await app.close();
  });

  describe('avisa al tutor', () => {
    it('crea la notificación interna de la cita finalizada, después de actualizar la cita', async () => {
      const { db, consultas } = bdCierre();
      const app = await crearApp([GestionCitasModule], db);
      await request(app.getHttpServer()).patch(finalizar()).set('Cookie', COOKIE).expect(200);
      const aviso = consultas.find((c) => c.sql.includes('INSERT INTO notificacion'));
      expect(aviso?.valores).toEqual([
        TUTOR.id,
        'CITA_FINALIZADA',
        'Tu cita de Consulta para Firulais en Clínica Central fue marcada como finalizada.',
        CITA,
      ]);
      expect(indiceDe(consultas, 'INSERT INTO notificacion')).toBeGreaterThan(
        indiceDe(consultas, 'UPDATE cita'),
      );
      await app.close();
    });

    it('si hay recomendaciones, el aviso lo dice', async () => {
      const { db, consultas } = bdCierre();
      const app = await crearApp([GestionCitasModule], db);
      await request(app.getHttpServer())
        .patch(finalizar())
        .set('Cookie', COOKIE)
        .send({ recomendaciones: 'Reposo' })
        .expect(200);
      const aviso = consultas.find((c) => c.sql.includes('INSERT INTO notificacion'));
      expect(aviso?.valores[2]).toContain('El aliado dejó recomendaciones para ti.');
      await app.close();
    });

    it('la notificación va protegida: si falla, la cita igual queda finalizada', async () => {
      const { db, consultas } = bdCierre({ fallaLaNotificacion: true });
      const app = await crearApp([GestionCitasModule], db);
      const r = await request(app.getHttpServer())
        .patch(finalizar())
        .set('Cookie', COOKIE)
        .expect(200);
      expect(r.body.estado).toBe('FINALIZADA');
      const orden = sentencias(consultas);
      expect(orden).toContain('SAVEPOINT notificacion');
      expect(orden).toContain('ROLLBACK TO SAVEPOINT notificacion');
      expect(orden).not.toContain('RELEASE SAVEPOINT notificacion');
      // el cambio de estado no se deshizo
      expect(orden).not.toContain('ROLLBACK');
      await app.close();
    });

    it('si la notificación sale bien, se libera el punto de control', async () => {
      const { db, consultas } = bdCierre();
      const app = await crearApp([GestionCitasModule], db);
      await request(app.getHttpServer()).patch(finalizar()).set('Cookie', COOKIE).expect(200);
      expect(sentencias(consultas)).toContain('RELEASE SAVEPOINT notificacion');
      await app.close();
    });
  });
});

describe('HU-032 · marcar que el tutor no asistió', () => {
  it('la marca NO_ASISTIO con su observación y avisa al tutor', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(noAsistio())
      .set('Cookie', COOKIE)
      .send({ observacion: 'El tutor no se presentó a la cita.' })
      .expect(200);
    expect(r.body).toMatchObject({
      estado: 'NO_ASISTIO',
      actualizadoEn: CAMBIO,
      actualizadoPor: ALIADO.id,
    });
    expect(consultas.find((c) => c.sql.includes("set_config('app.motivo'"))?.valores).toEqual([
      'El tutor no se presentó a la cita.',
    ]);
    expect(consultas.find((c) => c.sql.includes('UPDATE cita'))?.valores).toEqual([
      CITA,
      'NO_ASISTIO',
      null,
    ]);
    const aviso = consultas.find((c) => c.sql.includes('INSERT INTO notificacion'));
    expect(aviso?.valores).toEqual([
      TUTOR.id,
      'CITA_NO_ASISTIO',
      'Tu cita de Consulta para Firulais en Clínica Central fue marcada como no asistió.',
      CITA,
    ]);
    await app.close();
  });

  it('el cuerpo es opcional', async () => {
    const { db } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    await request(app.getHttpServer()).patch(noAsistio()).set('Cookie', COOKIE).expect(200);
    await app.close();
  });

  it('no guarda recomendaciones aunque se envíen: solo se escriben al finalizar', async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    await request(app.getHttpServer())
      .patch(noAsistio())
      .set('Cookie', COOKIE)
      .send({ recomendaciones: 'no deberían guardarse' })
      .expect(200);
    expect(consultas.find((c) => c.sql.includes('UPDATE cita'))?.valores[2]).toBeNull();
    await app.close();
  });

  it('si la notificación falla, la cita igual queda como no asistió', async () => {
    const { db } = bdCierre({ fallaLaNotificacion: true });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(noAsistio())
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.estado).toBe('NO_ASISTIO');
    await app.close();
  });
});

describe.each([
  ['finalizar', finalizar],
  ['no-asistio', noAsistio],
])('HU-032 · errores de %s', (_nombre, ruta) => {
  it('una cita que no existe responde 404 CITA_NO_ENCONTRADA', async () => {
    const { db, consultas } = bdCierre({ sinCita: true });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(404);
    expect(r.body).toMatchObject({ codigo: 'CITA_NO_ENCONTRADA', message: 'La cita no existe' });
    expect(hayEscritura(consultas)).toBe(false);
    await app.close();
  });

  it('un usuario que no gestiona ese aliado responde 403 SIN_PERMISOS_CITA y no cambia nada', async () => {
    const { db, consultas } = bdCierre({ puedeGestionar: false });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(403);
    expect(r.body.codigo).toBe('SIN_PERMISOS_CITA');
    expect(hayEscritura(consultas)).toBe(false);
    // se pregunta por el aliado de la cita y por quien actúa
    const permiso = consultas.find((c) => c.sql.includes('FROM aliado WHERE id = $1'));
    expect(permiso?.valores).toEqual([ALIADO_ID, ALIADO.id]);
    await app.close();
  });

  it('el permiso se revisa antes que el estado: un ajeno no se entera de cómo está la cita', async () => {
    const { db } = bdCierre({ puedeGestionar: false, estado: 'FINALIZADA', yaOcurrio: false });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(403);
    expect(r.body).not.toHaveProperty('estadoActual');
    await app.close();
  });

  it.each([
    ['PENDIENTE', 'pendiente de aceptación'],
    ['FINALIZADA', 'ya fue finalizada'],
    ['NO_ASISTIO', 'no asistió'],
    ['CANCELADA', 'fue cancelada'],
  ] as const)('una cita %s responde 409 ESTADO_CITA_INVALIDO', async (estado, texto) => {
    const { db, consultas } = bdCierre({ estado });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(409);
    expect(r.body).toMatchObject({ codigo: 'ESTADO_CITA_INVALIDO', estadoActual: estado });
    expect(r.body.message).toContain(texto);
    expect(hayEscritura(consultas)).toBe(false);
    await app.close();
  });

  it('antes de la hora de la cita responde 422 CITA_NO_FINALIZABLE y no cambia nada', async () => {
    const { db, consultas } = bdCierre({ yaOcurrio: false });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(422);
    expect(r.body.codigo).toBe('CITA_NO_FINALIZABLE');
    expect(hayEscritura(consultas)).toBe(false);
    await app.close();
  });

  it('si la base rechaza el cambio por permiso (42501), responde 403', async () => {
    const error = Object.assign(new Error('Solo el aliado puede marcar la cita'), {
      code: '42501',
    });
    const { db } = bdCierre({ errorAlActualizar: error });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(403);
    expect(r.body.codigo).toBe('SIN_PERMISOS_CITA');
    await app.close();
  });

  it.each(['55000', '23514'])(
    'si la base rechaza la transición (%s), responde 409 ESTADO_CITA_INVALIDO',
    async (code) => {
      const error = Object.assign(new Error('La cita está en estado final'), { code });
      const { db, consultas } = bdCierre({ errorAlActualizar: error });
      const app = await crearApp([GestionCitasModule], db);
      const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(409);
      expect(r.body).toMatchObject({
        codigo: 'ESTADO_CITA_INVALIDO',
        message: 'La cita está en estado final',
      });
      expect(consultas.some((c) => c.sql.includes('INSERT INTO notificacion'))).toBe(false);
      await app.close();
    },
  );

  it('un error inesperado responde 500 ERROR_INTERNO sin mostrar el detalle y sin avisar al tutor', async () => {
    const { db, consultas } = bdCierre({ errorAlActualizar: new Error('se cayó la conexión') });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(500);
    expect(r.body.codigo).toBe('ERROR_INTERNO');
    expect(JSON.stringify(r.body)).not.toContain('conexión');
    expect(consultas.some((c) => c.sql.includes('INSERT INTO notificacion'))).toBe(false);
    await app.close();
  });

  it('un id que no es válido responde 400 DATOS_INVALIDOS', async () => {
    const { db } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(ruta('no-es-un-id'))
      .set('Cookie', COOKIE)
      .expect(400);
    expect(r.body.codigo).toBe('DATOS_INVALIDOS');
    await app.close();
  });

  it('sin sesión responde 401 NO_AUTENTICADO', async () => {
    const { db } = bdCierre({ usuario: null });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).expect(401);
    expect(r.body.codigo).toBe('NO_AUTENTICADO');
    await app.close();
  });

  it('un tutor no puede cerrar citas: 403 SIN_PERMISOS_CITA', async () => {
    const { db, consultas } = bdCierre({ usuario: TUTOR });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).patch(ruta()).set('Cookie', COOKIE).expect(403);
    expect(r.body.codigo).toBe('SIN_PERMISOS_CITA');
    expect(hayEscritura(consultas)).toBe(false);
    await app.close();
  });
});

describe('HU-032 y HU-033 · validación de los datos enviados', () => {
  it(`una observación de más de ${OBSERVACION_CITA_MAX_CARACTERES} caracteres responde 400 con el número`, async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(noAsistio())
      .set('Cookie', COOKIE)
      .send({ observacion: 'a'.repeat(OBSERVACION_CITA_MAX_CARACTERES + 1) })
      .expect(400);
    expect(r.body.codigo).toBe('DATOS_INVALIDOS');
    expect(r.body.errores.observacion).toBe(
      `La observación admite máximo ${OBSERVACION_CITA_MAX_CARACTERES} caracteres (escribiste ${
        OBSERVACION_CITA_MAX_CARACTERES + 1
      })`,
    );
    // se valida antes de tocar la base: ni siquiera se abre la transacción de la cita
    expect(consultas.some((c) => c.sql.includes('FOR UPDATE'))).toBe(false);
    await app.close();
  });

  it(`unas recomendaciones de más de ${RECOMENDACIONES_MAX_CARACTERES} caracteres responden 400 con el número`, async () => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .send({ recomendaciones: 'a'.repeat(RECOMENDACIONES_MAX_CARACTERES + 1) })
      .expect(400);
    expect(r.body.errores.recomendaciones).toBe(
      `Las recomendaciones admiten máximo ${RECOMENDACIONES_MAX_CARACTERES} caracteres (escribiste ${
        RECOMENDACIONES_MAX_CARACTERES + 1
      })`,
    );
    expect(hayEscritura(consultas)).toBe(false);
    await app.close();
  });

  it('acepta justo el límite de recomendaciones', async () => {
    const { db } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    await request(app.getHttpServer())
      .patch(finalizar())
      .set('Cookie', COOKIE)
      .send({ recomendaciones: 'a'.repeat(RECOMENDACIONES_MAX_CARACTERES) })
      .expect(200);
    await app.close();
  });

  it.each([
    ['observación que no es texto', noAsistio, { observacion: 5 }, 'observacion'],
    ['carácter nulo en la observación', noAsistio, { observacion: 'hola\u0000' }, 'observacion'],
    ['recomendaciones que no son texto', finalizar, { recomendaciones: ['a'] }, 'recomendaciones'],
    [
      'carácter nulo en las recomendaciones',
      finalizar,
      { recomendaciones: 'hola\u0000' },
      'recomendaciones',
    ],
  ])('rechaza %s', async (_caso, ruta, cuerpo, campo) => {
    const { db, consultas } = bdCierre();
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer())
      .patch(ruta())
      .set('Cookie', COOKIE)
      .send(cuerpo)
      .expect(400);
    expect(r.body.errores).toHaveProperty(campo);
    expect(hayEscritura(consultas)).toBe(false);
    await app.close();
  });
});

describe('HU-032 · historial de cambios de estado', () => {
  const CAMBIOS = [
    {
      estado_anterior: null,
      estado_nuevo: 'AGENDADA',
      cambiado_por: TUTOR.id,
      motivo: null,
      cambiado_en: new Date('2099-01-01T10:00:00Z'),
    },
    {
      estado_anterior: 'AGENDADA',
      estado_nuevo: 'NO_ASISTIO',
      cambiado_por: ALIADO.id,
      motivo: 'El tutor no se presentó a la cita.',
      cambiado_en: new Date(CAMBIO),
    },
  ];

  it('el aliado ve cada cambio con quién lo hizo y la observación', async () => {
    const { db } = bdCierre({ historial: CAMBIOS, autorizadosAVer: [ALIADO.id] });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).get(historial()).set('Cookie', COOKIE).expect(200);
    expect(r.body).toEqual([
      {
        estadoAnterior: null,
        estadoNuevo: 'AGENDADA',
        cambiadoEn: '2099-01-01T10:00:00.000Z',
        cambiadoPor: TUTOR.id,
        observacion: null,
      },
      {
        estadoAnterior: 'AGENDADA',
        estadoNuevo: 'NO_ASISTIO',
        cambiadoEn: CAMBIO,
        cambiadoPor: ALIADO.id,
        observacion: 'El tutor no se presentó a la cita.',
      },
    ]);
    await app.close();
  });

  it('el tutor ve los cambios, pero no la observación del aliado', async () => {
    const { db } = bdCierre({ usuario: TUTOR, historial: CAMBIOS, puedeGestionar: false });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).get(historial()).set('Cookie', COOKIE).expect(200);
    expect(r.body.map((c: { estadoNuevo: string }) => c.estadoNuevo)).toEqual([
      'AGENDADA',
      'NO_ASISTIO',
    ]);
    expect(r.body.every((c: { observacion: unknown }) => c.observacion === null)).toBe(true);
    await app.close();
  });

  it('otra persona no la ve: 404 CITA_NO_ENCONTRADA', async () => {
    const otro: UsuarioPrueba = { ...ALIADO, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' };
    const { db } = bdCierre({ usuario: otro, historial: CAMBIOS });
    const app = await crearApp([GestionCitasModule], db);
    const r = await request(app.getHttpServer()).get(historial()).set('Cookie', COOKIE).expect(404);
    expect(r.body.codigo).toBe('CITA_NO_ENCONTRADA');
    expect(JSON.stringify(r.body)).not.toContain('no se presentó');
    await app.close();
  });

  it('exige sesión y no la ve el Equipo Veto', async () => {
    const sin = bdCierre({ usuario: null });
    const app = await crearApp([GestionCitasModule], sin.db);
    await request(app.getHttpServer()).get(historial()).expect(401);
    await app.close();
    const admin = bdCierre({ usuario: { ...ALIADO, rol: 'EQUIPO_VETO' } });
    const app2 = await crearApp([GestionCitasModule], admin.db);
    await request(app2.getHttpServer()).get(historial()).set('Cookie', COOKIE).expect(403);
    await app2.close();
  });
});
