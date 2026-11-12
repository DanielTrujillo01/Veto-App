import request from 'supertest';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, errorPg } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const VET = '44444444-4444-4444-8444-444444444444';
const OTRO_VET = '99999999-9999-4999-8999-999999999999';
const SERVICIO = '55555555-5555-4555-8555-555555555555';
const BLOQUEO = '66666666-6666-4666-8666-666666666666';
const OTRO_USUARIO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const FUTURO_INICIO = '2099-12-24T08:00:00-05:00';
const FUTURO_FIN = '2099-12-26T08:00:00-05:00';
const RUTA_BLOQUEOS = `/api/aliados/${ALIADO_ID}/veterinarios/${VET}/bloqueos`;

type Escenario = {
  tipo?: string;
  estado?: string;
  dueno?: string;
  vetDelAliado?: boolean;
  citas?: { id: string; inicio: string; fin: string; estado: string }[];
  errorAlInsertar?: Error;
  bloqueoExiste?: boolean;
};

/** Simula aliado, veterinario, citas y la tabla de bloqueos que usan los endpoints de HU-022. */
function bdBloqueos(e: Escenario = {}, usuario = ALIADO) {
  const fila = {
    id: BLOQUEO,
    veterinario_id: VET,
    inicio: new Date(FUTURO_INICIO),
    fin: new Date(FUTURO_FIN),
    motivo: null as string | null,
  };
  const fabrica = crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM aliado a JOIN usuario u')) {
      return {
        rows: [
          {
            tipo: e.tipo ?? 'VET_INDEPENDIENTE',
            estado: e.estado ?? 'ACTIVO',
            usuario_id: e.dueno ?? ALIADO.id,
            rol: 'ALIADO',
            estado_cuenta: 'ACTIVA',
          },
        ],
      };
    }
    if (sql.includes('FROM veterinario WHERE id = $1 AND aliado_id = $2')) {
      return { rows: [{ ok: e.vetDelAliado ?? true }] };
    }
    if (sql.includes('FROM cita') && sql.includes('tstzrange($2::timestamptz')) {
      return {
        rows: (e.citas ?? []).map((c) => ({
          ...c,
          inicio: new Date(c.inicio),
          fin: new Date(c.fin),
        })),
      };
    }
    if (sql.includes('INSERT INTO bloqueo_agenda')) {
      if (e.errorAlInsertar) throw e.errorAlInsertar;
      return {
        rows: [
          {
            ...fila,
            inicio: new Date(valores[2] as string),
            fin: new Date(valores[3] as string),
            motivo: valores[4] as string | null,
          },
        ],
      };
    }
    if (sql.startsWith('SELECT') && sql.includes('FROM bloqueo_agenda')) return { rows: [fila] };
    if (sql.includes('DELETE FROM bloqueo_agenda')) {
      return { rows: [], rowCount: e.bloqueoExiste === false ? 0 : 1 };
    }
  }, usuario);
  return fabrica;
}

const esEscritura = (sql: string) => /^(INSERT INTO|DELETE FROM) bloqueo_agenda/.test(sql.trim());

describe('HU-022 · bloquear un intervalo del calendario', () => {
  it('crea el bloqueo a nombre del administrador y lo devuelve', async () => {
    const { db, consultas } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN, motivo: 'Vacaciones' })
      .expect(201);
    expect(r.body).toEqual({
      id: BLOQUEO,
      veterinarioId: VET,
      inicio: '2099-12-24T13:00:00.000Z',
      fin: '2099-12-26T13:00:00.000Z',
      motivo: 'Vacaciones',
    });
    const escritura = consultas.find((c) => esEscritura(c.sql));
    expect(escritura?.usuarioTx).toBe(ALIADO.id);
    expect(escritura?.valores).toEqual([ALIADO_ID, VET, FUTURO_INICIO, FUTURO_FIN, 'Vacaciones']);
    await app.close();
  });

  it.each(['VET_INDEPENDIENTE', 'CLINICA'])(
    'lo puede hacer el administrador de %s',
    async (tipo) => {
      const { db } = bdBloqueos({ tipo });
      const app = await crearApp([ServiciosModule], db);
      await request(app.getHttpServer())
        .post(RUTA_BLOQUEOS)
        .set('Cookie', COOKIE)
        .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
        .expect(201);
      await app.close();
    },
  );

  it('sin motivo guarda null', async () => {
    const { db, consultas } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(201);
    expect(consultas.find((c) => esEscritura(c.sql))?.valores[4]).toBeNull();
    await app.close();
  });

  it('antes de insertar revisa las citas vigentes de ese veterinario en el intervalo', async () => {
    const { db, consultas } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(201);
    const revision = consultas.find((c) => c.sql.includes('FROM cita'));
    expect(revision?.valores).toEqual([VET, FUTURO_INICIO, FUTURO_FIN]);
    expect(revision?.sql).toContain("estado IN ('PENDIENTE', 'AGENDADA')");
    await app.close();
  });

  it('responde 409 con las citas que hay que atender antes y no bloquea', async () => {
    const cita = {
      id: 'c1111111-1111-4111-8111-111111111111',
      inicio: '2099-12-25T15:00:00.000Z',
      fin: '2099-12-25T15:30:00.000Z',
      estado: 'AGENDADA',
    };
    const { db, consultas } = bdBloqueos({ citas: [cita] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(409);
    expect(r.body.message).toContain('1 cita(s) vigente(s)');
    expect(r.body.citas).toEqual([cita]);
    expect(consultas.some((c) => esEscritura(c.sql))).toBe(false);
    await app.close();
  });

  it('responde 409 si se cruza con otro bloqueo', async () => {
    const { db } = bdBloqueos({ errorAlInsertar: errorPg('23P01', 'bloqueo_sin_solapamiento') });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(409);
    expect(r.body.message).toContain('otro bloqueo');
    await app.close();
  });

  it('si la base rechaza el intervalo (una reserva llegó primero) responde 409', async () => {
    const { db } = bdBloqueos({ errorAlInsertar: errorPg('23514') });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(409);
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    const { db } = bdBloqueos({}, null as never);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(401);
    await request(app.getHttpServer()).get(RUTA_BLOQUEOS).expect(401);
    await request(app.getHttpServer()).delete(`${RUTA_BLOQUEOS}/${BLOQUEO}`).expect(401);
    await app.close();
  });

  it.each([
    ['un tutor', { usuario: TUTOR, escenario: {} }],
    [
      'otro usuario que no administra el aliado',
      { usuario: ALIADO, escenario: { dueno: OTRO_USUARIO } },
    ],
    ['una tienda', { usuario: ALIADO, escenario: { tipo: 'TIENDA' } }],
    ['una fundación', { usuario: ALIADO, escenario: { tipo: 'FUNDACION' } }],
    ['un aliado pendiente de activación', { usuario: ALIADO, escenario: { estado: 'PENDIENTE' } }],
    ['un aliado suspendido', { usuario: ALIADO, escenario: { estado: 'SUSPENDIDO' } }],
  ])('responde 403 a %s y no cambia nada', async (_quien, { usuario, escenario }) => {
    const { db, consultas } = bdBloqueos(escenario, usuario);
    const app = await crearApp([ServiciosModule], db);
    const cuerpo = { inicio: FUTURO_INICIO, fin: FUTURO_FIN };
    await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send(cuerpo)
      .expect(403);
    await request(app.getHttpServer()).get(RUTA_BLOQUEOS).set('Cookie', COOKIE).expect(403);
    await request(app.getHttpServer())
      .delete(`${RUTA_BLOQUEOS}/${BLOQUEO}`)
      .set('Cookie', COOKIE)
      .expect(403);
    expect(consultas.some((c) => esEscritura(c.sql))).toBe(false);
    await app.close();
  });

  it('un veterinario que no es de ese aliado responde 404', async () => {
    const { db, consultas } = bdBloqueos({ vetDelAliado: false });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .post(`/api/aliados/${ALIADO_ID}/veterinarios/${OTRO_VET}/bloqueos`)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(404);
    expect(consultas.some((c) => esEscritura(c.sql))).toBe(false);
    await app.close();
  });

  it.each([
    ['sin cuerpo', {}, ['inicio', 'fin']],
    ['sin zona horaria', { inicio: '2099-12-24T08:00:00', fin: FUTURO_FIN }, ['inicio']],
    ['fin antes del inicio', { inicio: FUTURO_FIN, fin: FUTURO_INICIO }, ['fin']],
    ['fin igual al inicio', { inicio: FUTURO_INICIO, fin: FUTURO_INICIO }, ['fin']],
    ['más de un año', { inicio: FUTURO_INICIO, fin: '2101-12-26T08:00:00-05:00' }, ['fin']],
    [
      'motivo demasiado largo',
      { inicio: FUTURO_INICIO, fin: FUTURO_FIN, motivo: 'x'.repeat(201) },
      ['motivo'],
    ],
    [
      'un intervalo que ya terminó',
      { inicio: '2020-01-01T08:00:00-05:00', fin: '2020-01-02T08:00:00-05:00' },
      ['fin'],
    ],
  ])('responde 400 con %s y no escribe', async (_caso, cuerpo, campos) => {
    const { db, consultas } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .post(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .send(cuerpo)
      .expect(400);
    for (const campo of campos) expect(Object.keys(r.body.errores)).toContain(campo);
    expect(consultas.some((c) => esEscritura(c.sql))).toBe(false);
    await app.close();
  });

  it('un id que no es UUID responde 400', async () => {
    const { db } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .post(`/api/aliados/no-es-uuid/veterinarios/${VET}/bloqueos`)
      .set('Cookie', COOKIE)
      .send({ inicio: FUTURO_INICIO, fin: FUTURO_FIN })
      .expect(400);
    await app.close();
  });
});

describe('HU-022 · ver y quitar bloqueos', () => {
  it('lista solo los bloqueos que no han terminado', async () => {
    const { db, consultas } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .get(RUTA_BLOQUEOS)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].id).toBe(BLOQUEO);
    const consulta = consultas.find((c) => c.sql.includes('FROM bloqueo_agenda'));
    expect(consulta?.sql).toContain('fin > now()');
    expect(consulta?.valores).toEqual([ALIADO_ID, VET]);
    await app.close();
  });

  it('quita un bloqueo (204) filtrando por aliado y veterinario', async () => {
    const { db, consultas } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .delete(`${RUTA_BLOQUEOS}/${BLOQUEO}`)
      .set('Cookie', COOKIE)
      .expect(204);
    const borrado = consultas.find((c) => esEscritura(c.sql));
    expect(borrado?.valores).toEqual([BLOQUEO, ALIADO_ID, VET]);
    expect(borrado?.usuarioTx).toBe(ALIADO.id);
    await app.close();
  });

  it('un bloqueo que no existe (o es de otro) responde 404', async () => {
    const { db } = bdBloqueos({ bloqueoExiste: false });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .delete(`${RUTA_BLOQUEOS}/${BLOQUEO}`)
      .set('Cookie', COOKIE)
      .expect(404);
    await app.close();
  });

  it('un id de bloqueo que no es UUID responde 400', async () => {
    const { db } = bdBloqueos();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .delete(`${RUTA_BLOQUEOS}/nada`)
      .set('Cookie', COOKIE)
      .expect(400);
    await app.close();
  });
});

// ---------------------------------------------------------------------------------------------
// Calendario que ve el tutor
// ---------------------------------------------------------------------------------------------

type EscenarioDisp = {
  aliadoActivo?: boolean;
  servicioDeOtroAliado?: boolean;
  servicioNoDisponible?: boolean;
  veterinarios?: { id: string; nombre: string }[];
  ocupados?: { veterinario_id: string; inicio: Date; fin: Date }[];
  espacios?: { veterinario_id: string; inicio: Date; fin: Date }[];
};

const VET_B = '88888888-8888-4888-8888-888888888888';

function bdDisponibilidad(e: EscenarioDisp = {}) {
  return crearBdFalsa((sql) => {
    if (sql.includes('SELECT EXISTS (SELECT 1 FROM aliado WHERE id = $1')) {
      return { rows: [{ ok: e.aliadoActivo ?? true }] };
    }
    if (sql.includes('JOIN aliado a ON a.id = s.aliado_id')) {
      if (e.servicioNoDisponible) return { rows: [] };
      return {
        rows: [
          {
            id: SERVICIO,
            aliado_id: e.servicioDeOtroAliado ? OTRO_USUARIO : ALIADO_ID,
            tipo_servicio_id: 1,
            tipo_servicio: 'Consulta general',
            nombre: 'Consulta',
            descripcion: null,
            modalidad: 'A_DOMICILIO',
            sede_id: null,
            duracion_min: 30,
            precio_base: 60000,
            activo: true,
            creado_en: new Date('2030-01-01'),
          },
        ],
      };
    }
    if (sql.includes('FROM veterinario v JOIN usuario u')) {
      return { rows: e.veterinarios ?? [{ id: VET, nombre: 'Dra. Ana' }] };
    }
    if (sql.includes('veterinario_id = ANY($1::uuid[])')) return { rows: e.ocupados ?? [] };
    if (sql.includes('WITH dias AS')) {
      return {
        rows: e.espacios ?? [
          {
            veterinario_id: VET,
            inicio: new Date('2099-06-03T13:00:00Z'),
            fin: new Date('2099-06-03T13:30:00Z'),
          },
        ],
      };
    }
  }, null as never);
}

const RUTA_DISP = `/api/aliados/${ALIADO_ID}/disponibilidad`;
const CONSULTA = { servicioId: SERVICIO, desde: '2099-06-03', hasta: '2099-06-09' };

describe('HU-022 · calendario de disponibilidad para el tutor', () => {
  it('es público y devuelve los espacios con el nombre del veterinario', async () => {
    const { db } = bdDisponibilidad();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA_DISP).query(CONSULTA).expect(200);
    expect(r.body).toEqual({
      aliadoId: ALIADO_ID,
      servicioId: SERVICIO,
      duracionMin: 30,
      espacios: [
        {
          veterinarioId: VET,
          veterinarioNombre: 'Dra. Ana',
          inicio: '2099-06-03T13:00:00.000Z',
          fin: '2099-06-03T13:30:00.000Z',
        },
      ],
    });
    await app.close();
  });

  it('calcula con la duración del servicio, las fechas pedidas y las citas ocupadas', async () => {
    const ocupado = {
      veterinario_id: VET,
      inicio: new Date('2099-06-03T14:00:00Z'),
      fin: new Date('2099-06-03T14:30:00Z'),
    };
    const { db, consultas } = bdDisponibilidad({ ocupados: [ocupado] });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).get(RUTA_DISP).query(CONSULTA).expect(200);
    const calculo = consultas.find((c) => c.sql.includes('WITH dias AS'));
    expect(calculo?.valores).toEqual([
      ALIADO_ID,
      '2099-06-03',
      '2099-06-09',
      [VET],
      30,
      [VET],
      ['2099-06-03T14:00:00.000Z'],
      ['2099-06-03T14:30:00.000Z'],
    ]);
    // el cálculo descuenta bloqueos y citas, y no ofrece espacios que ya empezaron
    expect(calculo?.sql).toContain('FROM bloqueo_agenda');
    expect(calculo?.sql).toContain('e.inicio > now()');
    // la consulta es de solo lectura y sin usuario
    expect(consultas.every((c) => c.usuarioTx === null)).toBe(true);
    await app.close();
  });

  it('reparte los espacios entre los veterinarios del aliado', async () => {
    const { db, consultas } = bdDisponibilidad({
      veterinarios: [
        { id: VET, nombre: 'Dra. Ana' },
        { id: VET_B, nombre: 'Dr. Beto' },
      ],
      espacios: [
        {
          veterinario_id: VET_B,
          inicio: new Date('2099-06-03T13:00:00Z'),
          fin: new Date('2099-06-03T13:30:00Z'),
        },
        {
          veterinario_id: VET,
          inicio: new Date('2099-06-03T13:30:00Z'),
          fin: new Date('2099-06-03T14:00:00Z'),
        },
      ],
    });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA_DISP).query(CONSULTA).expect(200);
    expect(r.body.espacios.map((x: { veterinarioNombre: string }) => x.veterinarioNombre)).toEqual([
      'Dr. Beto',
      'Dra. Ana',
    ]);
    expect(consultas.find((c) => c.sql.includes('WITH dias AS'))?.valores[3]).toEqual([VET, VET_B]);
    await app.close();
  });

  it('puede pedirse para un solo veterinario', async () => {
    const { db, consultas } = bdDisponibilidad();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .get(RUTA_DISP)
      .query({ ...CONSULTA, veterinarioId: VET })
      .expect(200);
    const filtro = consultas.find((c) => c.sql.includes('FROM veterinario v JOIN usuario u'));
    expect(filtro?.valores).toEqual([ALIADO_ID, VET]);
    await app.close();
  });

  it('un veterinario que no atiende en ese aliado responde 404', async () => {
    const { db } = bdDisponibilidad({ veterinarios: [] });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .get(RUTA_DISP)
      .query({ ...CONSULTA, veterinarioId: OTRO_VET })
      .expect(404);
    await app.close();
  });

  it('un aliado sin veterinarios activos no tiene espacios y no calcula nada', async () => {
    const { db, consultas } = bdDisponibilidad({ veterinarios: [] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA_DISP).query(CONSULTA).expect(200);
    expect(r.body.espacios).toEqual([]);
    expect(consultas.some((c) => c.sql.includes('WITH dias AS'))).toBe(false);
    await app.close();
  });

  it('un aliado que no está activo responde 404', async () => {
    const { db } = bdDisponibilidad({ aliadoActivo: false });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).get(RUTA_DISP).query(CONSULTA).expect(404);
    await app.close();
  });

  it.each([
    ['un servicio que no está disponible', { servicioNoDisponible: true }],
    ['un servicio de otro aliado', { servicioDeOtroAliado: true }],
  ])('%s responde 404', async (_caso, escenario) => {
    const { db } = bdDisponibilidad(escenario);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).get(RUTA_DISP).query(CONSULTA).expect(404);
    await app.close();
  });

  it.each([
    ['sin servicio', { desde: '2099-06-03', hasta: '2099-06-09' }, 'servicioId'],
    ['sin fechas', { servicioId: SERVICIO }, 'desde'],
    ['con una fecha inventada', { ...CONSULTA, desde: '2099-02-31' }, 'desde'],
    ['con el rango al revés', { ...CONSULTA, desde: '2099-06-10' }, 'hasta'],
    ['con más de 31 días', { ...CONSULTA, hasta: '2099-08-01' }, 'hasta'],
    ['con un veterinario inválido', { ...CONSULTA, veterinarioId: 'x' }, 'veterinarioId'],
  ])('responde 400 %s', async (_caso, query, campo) => {
    const { db, consultas } = bdDisponibilidad();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA_DISP).query(query).expect(400);
    expect(Object.keys(r.body.errores)).toContain(campo);
    expect(consultas).toHaveLength(0);
    await app.close();
  });

  it('un id de aliado que no es UUID responde 400', async () => {
    const { db } = bdDisponibilidad();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .get('/api/aliados/no-es-uuid/disponibilidad')
      .query(CONSULTA)
      .expect(400);
    await app.close();
  });
});

// ---------------------------------------------------------------------------------------------
// Horario semanal (HU-016 ya existía para clínicas; HU-022 lo abre al veterinario independiente)
// ---------------------------------------------------------------------------------------------

describe('HU-022 · horario semanal del veterinario independiente', () => {
  const RUTA = `/api/aliados/${ALIADO_ID}/veterinarios/${VET}/horarios`;
  const CUERPO = { horarios: [{ diaSemana: 1, horaInicio: '08:00', horaFin: '12:00' }] };

  function bdHorario(tipo: string, errorAlConfirmar?: Error) {
    return crearBdFalsa((sql) => {
      if (sql.includes('JOIN veterinario v')) {
        return {
          rows: [
            {
              tipo,
              estado: 'ACTIVO',
              usuario_id: ALIADO.id,
              veterinario_usuario_id: ALIADO.id,
              rol: 'ALIADO',
              estado_cuenta: 'ACTIVA',
            },
          ],
        };
      }
      if (sql.startsWith('SET CONSTRAINTS') && errorAlConfirmar) throw errorAlConfirmar;
    }, ALIADO);
  }

  it('el veterinario independiente guarda su horario', async () => {
    const { db, consultas } = bdHorario('VET_INDEPENDIENTE');
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(CUERPO).expect(200);
    expect(consultas.some((c) => c.sql.startsWith('INSERT INTO horario'))).toBe(true);
    await app.close();
  });

  it('antes de terminar pide a la base comprobar que ninguna cita vigente queda sin cubrir', async () => {
    const { db, consultas } = bdHorario('CLINICA');
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(CUERPO).expect(200);
    const orden = consultas.map((c) => c.sql.split(/\s+/).slice(0, 2).join(' '));
    const iInsert = orden.lastIndexOf('INSERT INTO');
    const iControl = orden.indexOf('SET CONSTRAINTS');
    expect(iControl).toBeGreaterThan(iInsert);
    await app.close();
  });

  it('si el horario nuevo deja citas vigentes fuera, responde 409 con el motivo', async () => {
    const mensaje = 'El horario deja 2 cita(s) vigente(s) fuera de la atención';
    const { db } = bdHorario(
      'VET_INDEPENDIENTE',
      Object.assign(errorPg('23514'), { message: mensaje }),
    );
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(CUERPO)
      .expect(409);
    expect(r.body.message).toBe(mensaje);
    await app.close();
  });

  it('una tienda sigue sin poder tener horarios (403)', async () => {
    const { db } = bdHorario('TIENDA');
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(CUERPO).expect(403);
    await app.close();
  });

  it.each([
    [
      'fin antes del inicio',
      { horarios: [{ diaSemana: 1, horaInicio: '12:00', horaFin: '08:00' }] },
    ],
    [
      'inicio igual al fin',
      { horarios: [{ diaSemana: 1, horaInicio: '08:00', horaFin: '08:00' }] },
    ],
    ['hora mal escrita', { horarios: [{ diaSemana: 1, horaInicio: '8am', horaFin: '12:00' }] }],
    ['día fuera de rango', { horarios: [{ diaSemana: 8, horaInicio: '08:00', horaFin: '12:00' }] }],
    ['sin ninguna franja', { horarios: [] }],
  ])('un intervalo inválido (%s) responde 400 y no escribe', async (_caso, cuerpo) => {
    const { db, consultas } = bdHorario('VET_INDEPENDIENTE');
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(cuerpo).expect(400);
    expect(consultas.some((c) => /^(INSERT INTO|DELETE FROM) horario/.test(c.sql.trim()))).toBe(
      false,
    );
    await app.close();
  });

  it('dos franjas que se solapan responden 409', async () => {
    const { db } = crearBdFalsa((sql) => {
      if (sql.includes('JOIN veterinario v')) {
        return {
          rows: [
            {
              tipo: 'VET_INDEPENDIENTE',
              estado: 'ACTIVO',
              usuario_id: ALIADO.id,
              veterinario_usuario_id: ALIADO.id,
              rol: 'ALIADO',
              estado_cuenta: 'ACTIVA',
            },
          ],
        };
      }
      if (sql.startsWith('INSERT INTO horario')) throw errorPg('23P01');
    }, ALIADO);
    const app = await crearApp([ServiciosModule], db);
    const solapadas = {
      horarios: [
        { diaSemana: 1, horaInicio: '08:00', horaFin: '12:00' },
        { diaSemana: 1, horaInicio: '11:00', horaFin: '14:00' },
      ],
    };
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(solapadas)
      .expect(409);
    expect(r.body.message).toContain('se solapan');
    await app.close();
  });
});
