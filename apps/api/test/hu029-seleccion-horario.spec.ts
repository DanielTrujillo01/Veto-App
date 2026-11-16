import request from 'supertest';
import { MINUTOS_VIGENCIA_SELECCION } from '@veto/shared';
import { ReservasModule } from '../src/modules/reservas/reservas.module';
import {
  ALIADO_ID,
  CITA_EXISTENTE,
  FIN,
  INICIO,
  MASCOTA,
  OTRO_VET,
  PASADO,
  PASADO_FIN,
  SERVICIO,
  VENCE,
  VET,
  bdReservas,
  citaExistente,
  eleccion,
} from './reservas-falsa';
import { ALIADO, COOKIE, TUTOR, crearApp } from './utilidades';

const RUTA = '/api/reservas/seleccion';

const guardo = (consultas: { sql: string }[]) =>
  consultas.some((c) => c.sql.includes('INSERT INTO seleccion_horario'));

describe('HU-029 · elegir fecha y hora en el calendario', () => {
  it('guarda el espacio elegido a nombre del tutor y calcula el fin con la duración del servicio', async () => {
    const { db, consultas } = bdReservas({ borrador: null });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(eleccion())
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
      mascotaId: null,
      mascotaNombre: null,
      motivo: null,
      citaId: null,
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

  it('elegir otro espacio reemplaza el anterior (una reserva en curso por tutor)', async () => {
    const { db, consultas } = bdReservas({
      espacios: [INICIO, '2099-06-03T14:00:00.000Z'],
    });
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(eleccion()).expect(200);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(eleccion({ inicio: '2099-06-03T14:00:00.000Z' }))
      .expect(200);
    expect(r.body.inicio).toBe('2099-06-03T14:00:00.000Z');
    const escritura = consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'));
    expect(escritura?.sql).toContain('ON CONFLICT (tutor_id) DO UPDATE');
    await app.close();
  });

  it('al cambiar de horario conserva la mascota y el motivo ya escritos', async () => {
    const { db } = bdReservas({
      espacios: [INICIO, '2099-06-03T14:00:00.000Z'],
      borrador: { mascota_id: MASCOTA, motivo: 'Vómito desde ayer' },
    });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(eleccion({ inicio: '2099-06-03T14:00:00.000Z' }))
      .expect(200);
    expect(r.body).toMatchObject({
      mascotaId: MASCOTA,
      mascotaNombre: 'Firulais',
      motivo: 'Vómito desde ayer',
      citaId: null,
    });
    await app.close();
  });

  it('acepta la hora con zona horaria y la guarda como instante', async () => {
    const { db, consultas } = bdReservas({ borrador: null });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(eleccion({ inicio: '2099-06-03T08:00:00-05:00' }))
      .expect(200);
    expect(r.body.inicio).toBe(INICIO);
    expect(consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'))?.valores[4]).toBe(
      INICIO,
    );
    await app.close();
  });

  it('revisa el espacio con el calendario de ese veterinario y la duración del servicio', async () => {
    const { db, consultas } = bdReservas({ duracionMin: 45, espacios: [] });
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).put(RUTA).set('Cookie', COOKIE).send(eleccion()).expect(409);
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
    ])('rechaza %s con 400 y razon PASADO, sin guardar nada', async (_caso, inicio) => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion({ inicio }))
        .expect(400);
      expect(r.body.razon).toBe('PASADO');
      expect(r.body.message).toBe('No puedes elegir una fecha u hora que ya pasó');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('rechaza un espacio ocupado por otra cita con 409 y razon OCUPADO', async () => {
      const { db, consultas } = bdReservas({ citas: [citaExistente()] });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion())
        .expect(409);
      expect(r.body.razon).toBe('OCUPADO');
      expect(r.body.message).toBe('Ese horario ya fue tomado: elige otro');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('una cita que solo se cruza con parte del espacio también lo vuelve ocupado', async () => {
      const { db, consultas } = bdReservas({
        citas: [
          citaExistente({
            inicio: '2099-06-03T12:45:00.000Z',
            fin: '2099-06-03T13:15:00.000Z',
            estado: 'PENDIENTE',
          }),
        ],
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion())
        .expect(409);
      expect(r.body.razon).toBe('OCUPADO');
      // la revisión de citas usa el intervalo completo del servicio
      const cruce = consultas.find((c) => c.sql.includes('tstzrange($2::timestamptz'));
      expect(cruce?.valores).toEqual([VET, INICIO, FIN]);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('una cita cancelada no ocupa el espacio', async () => {
      const { db } = bdReservas({ citas: [citaExistente({ estado: 'CANCELADA' })] });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion())
        .expect(200);
      await app.close();
    });

    it('rechaza un horario fuera de la atención o bloqueado con 409 y razon NO_DISPONIBLE', async () => {
      const { db, consultas } = bdReservas({ espacios: [] });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion())
        .expect(409);
      expect(r.body.razon).toBe('NO_DISPONIBLE');
      expect(r.body.message).toBe('El aliado no atiende en ese horario: elige uno del calendario');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it.each([
      ['a mitad de un espacio (13:10)', '2099-06-03T13:10:00.000Z'],
      ['con segundos', '2099-06-03T13:00:30.000Z'],
      ['en otro día con la misma hora', '2099-06-04T13:00:00.000Z'],
    ])('solo acepta un espacio exacto del calendario: no %s', async (_caso, inicio) => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion({ inicio }))
        .expect(409);
      expect(r.body.razon).toBe('NO_DISPONIBLE');
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('el servicio que no está disponible responde 404', async () => {
      const { db, consultas } = bdReservas({ servicioNoDisponible: true });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion())
        .expect(404);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('un veterinario que no es de ese aliado o no está activo responde 404', async () => {
      const { db, consultas } = bdReservas({ veterinarios: [] });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion({ veterinarioId: OTRO_VET }))
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
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion(extra))
        .expect(400);
      expect(r.body.errores).toHaveProperty(campo);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });

    it('el fin no se acepta del cliente: lo calcula la API', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion({ fin: '2099-06-03T23:00:00.000Z' }))
        .expect(200);
      expect(r.body.fin).toBe(FIN);
      expect(
        consultas.find((c) => c.sql.includes('INSERT INTO seleccion_horario'))?.valores[5],
      ).toBe(FIN);
      await app.close();
    });

    it('sin sesión responde 401', async () => {
      const { db } = bdReservas({ usuario: null });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer()).put(RUTA).send(eleccion()).expect(401);
      await request(app.getHttpServer()).get(RUTA).expect(401);
      await request(app.getHttpServer()).patch(RUTA).send({ motivo: 'x' }).expect(401);
      await request(app.getHttpServer()).delete(RUTA).expect(401);
      await app.close();
    });

    it('solo los tutores eligen horario: un aliado recibe 403', async () => {
      const { db, consultas } = bdReservas({ usuario: ALIADO });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send(eleccion())
        .expect(403);
      await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(403);
      await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'x' })
        .expect(403);
      await request(app.getHttpServer()).delete(RUTA).set('Cookie', COOKIE).expect(403);
      expect(guardo(consultas)).toBe(false);
      await app.close();
    });
  });
});

describe('HU-029 · la selección se conserva al avanzar en la reserva', () => {
  it('devuelve lo elegido, con los nombres y hasta cuándo se conserva', async () => {
    const { db, consultas } = bdReservas();
    const app = await crearApp([ReservasModule], db);
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
      mascotaId: null,
      mascotaNombre: null,
      motivo: null,
      citaId: null,
      vigente: true,
    });
    // solo se lee la reserva de la persona que pregunta y mientras no haya vencido
    const lectura = consultas.find((c) => c.sql.includes('FROM seleccion_horario'));
    expect(lectura?.sql).toContain('expira_en > now()');
    expect(lectura?.valores).toEqual([TUTOR.id]);
    await app.close();
  });

  it('sin selección (o vencida) responde 404', async () => {
    const { db } = bdReservas({ borrador: null });
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(404);
    await app.close();
    const vencida = bdReservas({ borrador: { vencido: true } });
    const app2 = await crearApp([ReservasModule], vencida.db);
    await request(app2.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(404);
    await app2.close();
  });

  it('vuelve a comprobar el espacio: si otra persona lo tomó, avisa OCUPADO', async () => {
    const { db } = bdReservas({ espacios: [], citas: [citaExistente()] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, razon: 'OCUPADO', inicio: INICIO });
    await app.close();
  });

  it('si el aliado dejó de atender en ese horario, avisa NO_DISPONIBLE', async () => {
    const { db } = bdReservas({ espacios: [] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, razon: 'NO_DISPONIBLE' });
    await app.close();
  });

  it('si la hora ya pasó, avisa PASADO', async () => {
    const { db } = bdReservas({ borrador: { inicio: PASADO, fin: PASADO_FIN } });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, razon: 'PASADO' });
    await app.close();
  });

  it('si el servicio ya no está disponible, avisa NO_DISPONIBLE sin romperse', async () => {
    const { db } = bdReservas({ servicioNoDisponible: true });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({
      vigente: false,
      razon: 'NO_DISPONIBLE',
      servicioNombre: '',
      veterinarioNombre: '',
    });
    await app.close();
  });

  it('si el veterinario ya no atiende, avisa NO_DISPONIBLE', async () => {
    const { db } = bdReservas({ veterinarios: [] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({
      vigente: false,
      razon: 'NO_DISPONIBLE',
      servicioNombre: 'Consulta',
      veterinarioNombre: '',
    });
    await app.close();
  });

  it('si el servicio cambió de duración desde que se eligió, ya no coincide con el calendario', async () => {
    const { db } = bdReservas({ duracionMin: 60 });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ vigente: false, razon: 'NO_DISPONIBLE' });
    await app.close();
  });

  it('una reserva ya confirmada se muestra con su cita y sin volver a comprobar el espacio', async () => {
    const { db } = bdReservas({
      borrador: { mascota_id: MASCOTA, cita_id: CITA_EXISTENTE },
      citas: [citaExistente({ tutor_id: TUTOR.id, mascota_id: MASCOTA })],
      espacios: [],
    });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({
      vigente: true,
      citaId: CITA_EXISTENTE,
      mascotaNombre: 'Firulais',
    });
    await app.close();
  });

  it('descartar borra solo la reserva de quien lo pide y responde 204', async () => {
    const { db, consultas } = bdReservas();
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).delete(RUTA).set('Cookie', COOKIE).expect(204);
    const borrado = consultas.find((c) => c.sql.includes('DELETE FROM seleccion_horario'));
    expect(borrado?.valores).toEqual([TUTOR.id]);
    expect(borrado?.usuarioTx).toBe(TUTOR.id);
    await app.close();
  });
});
