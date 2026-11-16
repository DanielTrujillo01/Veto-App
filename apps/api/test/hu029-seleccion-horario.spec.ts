import request from 'supertest';
import { MINUTOS_VIGENCIA_SELECCION } from '@veto/shared';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const VET = '44444444-4444-4444-8444-444444444444';
const OTRO_VET = '99999999-9999-4999-8999-999999999999';
const SERVICIO = '55555555-5555-4555-8555-555555555555';
const CITA = '66666666-6666-4666-8666-666666666666';

const RUTA = '/api/reservas/seleccion';
const INICIO = '2099-06-03T13:00:00.000Z';
const FIN = '2099-06-03T13:30:00.000Z';
const VENCE = '2099-06-03T14:00:00.000Z';
const PASADO = '2000-01-01T10:00:00.000Z';
const PASADO_FIN = '2000-01-01T10:30:00.000Z';

type Escenario = {
  servicioNoDisponible?: boolean;
  duracionMin?: number;
  veterinarios?: { id: string; nombre: string }[];
  /** Espacios que ofrece el calendario del veterinario; por defecto, el de 13:00. */
  espacios?: { veterinario_id: string; inicio: Date; fin: Date }[];
  /** Citas vigentes del veterinario que se cruzan con lo elegido. */
  citas?: { id: string; inicio: Date; fin: Date; estado: string }[];
  /** Selección que el tutor ya tiene guardada. */
  guardada?: { inicio: string; fin: string } | null;
};

const ESPACIO_13 = {
  veterinario_id: VET,
  inicio: new Date(INICIO),
  fin: new Date(FIN),
};

/** Simula servicio, veterinarios, calendario, citas y la tabla seleccion_horario. */
function bd(e: Escenario = {}, usuario = TUTOR) {
  return crearBdFalsa((sql) => {
    if (sql.includes('JOIN aliado a ON a.id = s.aliado_id')) {
      if (e.servicioNoDisponible) return { rows: [] };
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
            duracion_min: e.duracionMin ?? 30,
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
    if (sql.includes('veterinario_id = ANY($1::uuid[])')) return { rows: [] };
    if (sql.includes('WITH dias AS')) return { rows: e.espacios ?? [ESPACIO_13] };
    if (sql.includes('tstzrange($2::timestamptz')) return { rows: e.citas ?? [] };
    if (sql.includes('INSERT INTO seleccion_horario')) {
      return { rows: [{ expira_en: new Date(VENCE) }] };
    }
    if (sql.includes('FROM seleccion_horario')) {
      if (e.guardada === null) return { rows: [] };
      const g = e.guardada ?? { inicio: INICIO, fin: FIN };
      return {
        rows: [
          {
            aliado_id: ALIADO_ID,
            servicio_id: SERVICIO,
            veterinario_id: VET,
            inicio: new Date(g.inicio),
            fin: new Date(g.fin),
            expira_en: new Date(VENCE),
          },
        ],
      };
    }
    if (sql.includes('DELETE FROM seleccion_horario')) return { rows: [], rowCount: 1 };
  }, usuario);
}

const cuerpo = (extra: Record<string, unknown> = {}) => ({
  servicioId: SERVICIO,
  veterinarioId: VET,
  inicio: INICIO,
  ...extra,
});

const guardo = (consultas: { sql: string }[]) =>
  consultas.some((c) => c.sql.includes('INSERT INTO seleccion_horario'));

describe('HU-029 · elegir fecha y hora en el calendario', () => {
  it('guarda el espacio elegido a nombre del tutor y calcula el fin con la duración del servicio', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(cuerpo())
      .expect(200);
    expect(r.body).toEqual({
      aliadoId: ALIADO_ID,
      servicioId: SERVICIO,
      servicioNombre: 'Consulta',
      veterinarioId: VET,
      veterinarioNombre: 'Dra. Ana',
      inicio: INICIO,
      fin: FIN,
      venceEn: VENCE,
      vigente: true,
    });
    const escritura = consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'));
    expect(escritura?.usuarioTx).toBe(TUTOR.id);
    expect(escritura?.valores).toEqual([
      TUTOR.id,
      ALIADO_ID,
      SERVICIO,
      VET,
      INICIO,
      FIN,
      MINUTOS_VIGENCIA_SELECCION,
    ]);
    await app.close();
  });

  it('elegir otro espacio reemplaza el anterior (una selección por tutor)', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(cuerpo()).expect(200);
    const escritura = consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'));
    expect(escritura?.sql).toContain('ON CONFLICT (tutor_id) DO UPDATE');
    await app.close();
  });

  it('acepta la hora con zona horaria y la guarda como instante', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(cuerpo({ inicio: '2099-06-03T08:00:00-05:00' }))
      .expect(200);
    expect(r.body.inicio).toBe(INICIO);
    expect(consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'))?.valores[4]).toBe(
      INICIO,
    );
    await app.close();
  });

  it('revisa el espacio con el calendario de ese veterinario y la duración del servicio', async () => {
    const { db, consultas } = bd({ duracionMin: 45, espacios: [] });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(cuerpo()).expect(409);
    const calculo = consultas.find((c) => c.sql.includes('WITH dias AS'));
    // [aliado, desde, hasta, veterinarios, duración, ...citas ocupadas]
    expect(calculo?.valores.slice(0, 5)).toEqual([
      ALIADO_ID,
      '2099-06-02',
      '2099-06-04',
      [VET],
      45,
    ]);
    await app.close();
  });

  describe('lo que no se puede elegir', () => {
    it.each([
      ['hoy a una hora que ya pasó', PASADO],
      ['una fecha de años atrás', '1999-12-31T10:00:00.000Z'],
    ])('rechaza %s con 400 y motivo PASADO, sin guardar nada', async (_caso, inicio) => {
      const { db, consultas } = bd();
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo({ inicio }))
        .expect(400);
      expect(r.body.motivo).toBe('PASADO');
      expect(r.body.message).toBe('No puedes elegir una fecha u hora que ya pasó');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('rechaza un espacio ocupado por otra cita con 409 y motivo OCUPADO', async () => {
      const { db, consultas } = bd({
        espacios: [],
        citas: [{ id: CITA, inicio: new Date(INICIO), fin: new Date(FIN), estado: 'AGENDADA' }],
      });
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo())
        .expect(409);
      expect(r.body.motivo).toBe('OCUPADO');
      expect(r.body.message).toBe('Ese horario ya fue tomado: elige otro');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('una cita que solo se cruza con parte del espacio también lo vuelve ocupado', async () => {
      const { db, consultas } = bd({
        espacios: [],
        citas: [
          {
            id: CITA,
            inicio: new Date('2099-06-03T12:45:00Z'),
            fin: new Date('2099-06-03T13:15:00Z'),
            estado: 'PENDIENTE',
          },
        ],
      });
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo())
        .expect(409);
      expect(r.body.motivo).toBe('OCUPADO');
      // la revisión de citas usa el intervalo completo del servicio
      const cruce = consultas.find((c) => c.sql.includes('tstzrange($2::timestamptz'));
      expect(cruce?.valores).toEqual([VET, INICIO, FIN]);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('rechaza un horario fuera de la atención o bloqueado con 409 y motivo NO_DISPONIBLE', async () => {
      const { db, consultas } = bd({ espacios: [], citas: [] });
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo())
        .expect(409);
      expect(r.body.motivo).toBe('NO_DISPONIBLE');
      expect(r.body.message).toBe('El aliado no atiende en ese horario: elige uno del calendario');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it.each([
      ['a mitad de un espacio (13:10)', '2099-06-03T13:10:00.000Z'],
      ['con segundos', '2099-06-03T13:00:30.000Z'],
      ['en otro día con la misma hora', '2099-06-04T13:00:00.000Z'],
    ])('solo acepta un espacio exacto del calendario: no %s', async (_caso, inicio) => {
      const { db, consultas } = bd();
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo({ inicio }))
        .expect(409);
      expect(r.body.motivo).toBe('NO_DISPONIBLE');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('el servicio que no está disponible responde 404', async () => {
      const { db, consultas } = bd({ servicioNoDisponible: true });
      const app = await crearApp([ServiciosModule], db);
      await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(cuerpo()).expect(404);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('un veterinario que no es de ese aliado o no está activo responde 404', async () => {
      const { db, consultas } = bd({ veterinarios: [] });
      const app = await crearApp([ServiciosModule], db);
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo({ veterinarioId: OTRO_VET }))
        .expect(404);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });
  });

  describe('validación y permisos', () => {
    it.each([
      ['sin servicio', { servicioId: undefined }, 'servicioId'],
      ['servicio que no es un id', { servicioId: 'abc' }, 'servicioId'],
      ['sin veterinario', { veterinarioId: undefined }, 'veterinarioId'],
      ['sin inicio', { inicio: undefined }, 'inicio'],
      ['inicio sin zona horaria', { inicio: '2099-06-03T13:00:00' }, 'inicio'],
      ['solo la fecha', { inicio: '2099-06-03' }, 'inicio'],
      ['inicio que no es una fecha', { inicio: 'mañana' }, 'inicio'],
    ])('rechaza %s con 400 y el campo', async (_caso, extra, campo) => {
      const { db, consultas } = bd();
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo(extra))
        .expect(400);
      expect(r.body.errores).toHaveProperty(campo);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('el fin no se acepta del cliente: lo calcula la API', async () => {
      const { db, consultas } = bd();
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(cuerpo({ fin: '2099-06-03T23:00:00.000Z' }))
        .expect(200);
      expect(r.body.fin).toBe(FIN);
      expect(
        consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'))?.valores[5],
      ).toBe(FIN);
      await app.close();
    });

    it('sin sesión responde 401', async () => {
      const { db } = bd({}, null as never);
      const app = await crearApp([ServiciosModule], db);
      await request(app.getHttpServer()).put(RUTA).send(cuerpo()).expect(401);
      await request(app.getHttpServer()).get(RUTA).expect(401);
      await request(app.getHttpServer()).delete(RUTA).expect(401);
      await app.close();
    });

    it('solo los tutores eligen horario: un aliado recibe 403', async () => {
      const { db, consultas } = bd({}, ALIADO);
      const app = await crearApp([ServiciosModule], db);
      await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(cuerpo()).expect(403);
      await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(403);
      await request(app.getHttpServer()).delete(RUTA).set('Cookie', COOKIE).expect(403);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });
  });
});

describe('HU-029 · la selección se conserva al avanzar en la reserva', () => {
  it('devuelve lo elegido, con los nombres y hasta cuándo se conserva', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toEqual({
      aliadoId: ALIADO_ID,
      servicioId: SERVICIO,
      servicioNombre: 'Consulta',
      veterinarioId: VET,
      veterinarioNombre: 'Dra. Ana',
      inicio: INICIO,
      fin: FIN,
      venceEn: VENCE,
      vigente: true,
    });
    // solo se lee la selección de la persona que pregunta y mientras no haya vencido
    const lectura = consultas.find((c) => c.sql.includes('FROM seleccion_horario'));
    expect(lectura?.sql).toContain('expira_en > now()');
    expect(lectura?.valores).toEqual([TUTOR.id]);
    await app.close();
  });

  it('sin selección (o vencida) responde 404', async () => {
    const { db } = bd({ guardada: null });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(404);
    await app.close();
  });

  it('vuelve a comprobar el espacio: si otra persona lo tomó, avisa OCUPADO', async () => {
    const { db } = bd({
      espacios: [],
      citas: [{ id: CITA, inicio: new Date(INICIO), fin: new Date(FIN), estado: 'AGENDADA' }],
    });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, motivo: 'OCUPADO', inicio: INICIO });
    await app.close();
  });

  it('si el aliado dejó de atender en ese horario, avisa NO_DISPONIBLE', async () => {
    const { db } = bd({ espacios: [], citas: [] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, motivo: 'NO_DISPONIBLE' });
    await app.close();
  });

  it('si la hora ya pasó, avisa PASADO', async () => {
    const { db } = bd({ guardada: { inicio: PASADO, fin: PASADO_FIN } });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, motivo: 'PASADO' });
    await app.close();
  });

  it('si el servicio ya no está disponible, avisa NO_DISPONIBLE sin romperse', async () => {
    const { db } = bd({ servicioNoDisponible: true });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({
      vigente: false,
      motivo: 'NO_DISPONIBLE',
      servicioNombre: '',
      veterinarioNombre: '',
    });
    await app.close();
  });

  it('si el veterinario ya no atiende, avisa NO_DISPONIBLE', async () => {
    const { db } = bd({ veterinarios: [] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({
      vigente: false,
      motivo: 'NO_DISPONIBLE',
      servicioNombre: 'Consulta',
      veterinarioNombre: '',
    });
    await app.close();
  });

  it('si el servicio cambió de duración desde que se eligió, ya no coincide con el calendario', async () => {
    const { db } = bd({ duracionMin: 60 });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, motivo: 'NO_DISPONIBLE' });
    await app.close();
  });

  it('descartar borra solo la selección de quien lo pide y responde 204', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).delete(RUTA).set('Cookie', COOKIE).expect(204);
    const borrado = consultas.find((c) => c.sql.includes('DELETE FROM seleccion_horario'));
    expect(borrado?.valores).toEqual([TUTOR.id]);
    expect(borrado?.usuarioTx).toBe(TUTOR.id);
    await app.close();
  });
});
