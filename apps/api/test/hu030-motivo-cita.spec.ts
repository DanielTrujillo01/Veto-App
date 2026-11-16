import request from 'supertest';
import { MINUTOS_VIGENCIA_SELECCION, MOTIVO_CITA_MAX_CARACTERES } from '@veto/shared';
import { ReservasModule } from '../src/modules/reservas/reservas.module';
import {
  ADMIN_ALIADO,
  CITA_EXISTENTE,
  MASCOTA,
  OTRA_MASCOTA,
  OTRO_USUARIO,
  bdReservas,
  citaExistente,
} from './reservas-falsa';
import { ALIADO, COOKIE, TUTOR, crearApp, type UsuarioPrueba } from './utilidades';

const RUTA = '/api/reservas/seleccion';
const hayEscritura = (consultas: { sql: string }[]) =>
  consultas.some((c) => c.sql.includes('UPDATE seleccion_horario'));
const escritura = (consultas: { sql: string; valores: unknown[]; usuarioTx: string | null }[]) =>
  consultas.find((c) => c.sql.includes('SET mascota_id = CASE'));

describe('HU-030 · motivo de la cita en texto libre', () => {
  it('guarda el motivo recortado a nombre del tutor y devuelve la reserva con él', async () => {
    const { db, consultas } = bdReservas();
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .patch(RUTA)
      .set('Cookie', COOKIE)
      .send({ motivo: '  Vómito desde ayer  ' })
      .expect(200);
    expect(r.body.motivo).toBe('Vómito desde ayer');
    const w = escritura(consultas);
    expect(w?.usuarioTx).toBe(TUTOR.id);
    // [tutor, ¿cambia la mascota?, mascota, ¿cambia el motivo?, motivo, minutos de vigencia]
    expect(w?.valores).toEqual([
      TUTOR.id,
      false,
      null,
      true,
      'Vómito desde ayer',
      MINUTOS_VIGENCIA_SELECCION,
    ]);
    await app.close();
  });

  it('el motivo se conserva al volver a leer la reserva (al avanzar en el flujo)', async () => {
    const { db } = bdReservas();
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer())
      .patch(RUTA)
      .set('Cookie', COOKIE)
      .send({ motivo: 'Control anual' })
      .expect(200);
    const r = await request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE).expect(200);
    expect(r.body.motivo).toBe('Control anual');
    await app.close();
  });

  describe('límite de caracteres', () => {
    it(`acepta exactamente ${MOTIVO_CITA_MAX_CARACTERES} caracteres (el límite es inclusivo)`, async () => {
      const motivo = 'a'.repeat(MOTIVO_CITA_MAX_CARACTERES);
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo })
        .expect(200);
      expect(r.body.motivo).toHaveLength(MOTIVO_CITA_MAX_CARACTERES);
      expect(escritura(consultas)?.valores[4]).toBe(motivo);
      await app.close();
    });

    it('con un carácter de más responde 400 con el aviso y cuántos escribió, sin guardar nada', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'a'.repeat(MOTIVO_CITA_MAX_CARACTERES + 1) })
        .expect(400);
      expect(r.body.errores.motivo).toBe(
        `El motivo admite máximo ${MOTIVO_CITA_MAX_CARACTERES} caracteres (escribiste ${
          MOTIVO_CITA_MAX_CARACTERES + 1
        })`,
      );
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });

    it('los espacios de las puntas no cuentan para el límite', async () => {
      const { db } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: `   ${'a'.repeat(MOTIVO_CITA_MAX_CARACTERES)}   ` })
        .expect(200);
      await app.close();
    });

    it('cuenta caracteres, no bytes ni unidades: 500 emojis caben y 501 no', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: '😀'.repeat(MOTIVO_CITA_MAX_CARACTERES) })
        .expect(200);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: '😀'.repeat(MOTIVO_CITA_MAX_CARACTERES + 1) })
        .expect(400);
      expect(r.body.errores.motivo).toContain('(escribiste 501)');
      expect(consultas.filter((c) => c.sql.includes('SET mascota_id = CASE'))).toHaveLength(1);
      await app.close();
    });
  });

  describe('texto libre', () => {
    it.each([
      ['vacío', ''],
      ['solo espacios', '   \n  '],
      ['null', null],
    ])('un motivo %s lo quita (queda sin motivo)', async (_caso, motivo) => {
      const { db, consultas } = bdReservas({ borrador: { motivo: 'Algo anterior' } });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo })
        .expect(200);
      expect(r.body.motivo).toBeNull();
      expect(escritura(consultas)?.valores.slice(3, 5)).toEqual([true, null]);
      await app.close();
    });

    it('acepta saltos de línea, tildes y signos; los saltos de Windows pasan a \\n', async () => {
      const { db } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'Tos seca\r\ndesde el lunes. ¿Vacunas al día? Sí.' })
        .expect(200);
      expect(r.body.motivo).toBe('Tos seca\ndesde el lunes. ¿Vacunas al día? Sí.');
      await app.close();
    });

    it('un texto con caracteres de control (como el nulo) se rechaza', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'hola\u0000mundo' })
        .expect(400);
      expect(r.body.errores.motivo).toBe('El motivo tiene caracteres que no se permiten');
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });

    it('un motivo que no es texto se rechaza', async () => {
      const { db } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 12345 })
        .expect(400);
      expect(r.body.errores.motivo).toBe('El motivo debe ser un texto');
      await app.close();
    });

    it('sin mascota ni motivo en el cuerpo responde 400', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer()).patch(RUTA).set('Cookie', COOKIE).send({}).expect(400);
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });
  });

  describe('la reserva en curso', () => {
    it('sin haber elegido fecha y hora responde 404', async () => {
      const { db, consultas } = bdReservas({ borrador: null });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'x' })
        .expect(404);
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });

    it('si la reserva venció responde 404', async () => {
      const { db } = bdReservas({ borrador: { vencido: true } });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'x' })
        .expect(404);
      await app.close();
    });

    it('una reserva ya confirmada no se puede cambiar: 409 YA_CONFIRMADA', async () => {
      const { db, consultas } = bdReservas({
        borrador: { mascota_id: MASCOTA, cita_id: CITA_EXISTENTE },
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'otro motivo' })
        .expect(409);
      expect(r.body.codigo).toBe('YA_CONFIRMADA');
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });

    it('al completar datos renueva el tiempo que se conserva la reserva', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ motivo: 'x' })
        .expect(200);
      const w = escritura(consultas);
      expect(w?.sql).toContain('expira_en = now() + make_interval(mins => $6)');
      expect(w?.sql).toContain('cita_id IS NULL');
      await app.close();
    });
  });

  describe('la mascota', () => {
    it('guarda la mascota (del tutor) junto con el motivo', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ mascotaId: MASCOTA, motivo: 'Vacuna anual' })
        .expect(200);
      expect(r.body).toMatchObject({
        mascotaId: MASCOTA,
        mascotaNombre: 'Firulais',
        motivo: 'Vacuna anual',
      });
      expect(escritura(consultas)?.valores.slice(0, 5)).toEqual([
        TUTOR.id,
        true,
        MASCOTA,
        true,
        'Vacuna anual',
      ]);
      await app.close();
    });

    it('solo cambia lo que se envía: la mascota sola no toca el motivo', async () => {
      const { db, consultas } = bdReservas({ borrador: { motivo: 'Motivo previo' } });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ mascotaId: MASCOTA })
        .expect(200);
      expect(r.body.motivo).toBe('Motivo previo');
      expect(escritura(consultas)?.valores.slice(3, 5)).toEqual([false, null]);
      await app.close();
    });

    it('una mascota de otra persona (o que no existe) responde 400 con el campo', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ mascotaId: OTRA_MASCOTA })
        .expect(400);
      expect(r.body.errores.mascotaId).toBe('La mascota no existe o no es tuya');
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });

    it('una mascota que no es un id responde 400', async () => {
      const { db } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ mascotaId: 'firulais' })
        .expect(400);
      expect(r.body.errores).toHaveProperty('mascotaId');
      await app.close();
    });

    it('si el aliado no atiende la especie de la mascota responde 409 y no guarda', async () => {
      const { db, consultas } = bdReservas({ atiendeEspecie: false });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .patch(RUTA)
        .set('Cookie', COOKIE)
        .send({ mascotaId: MASCOTA, motivo: 'x' })
        .expect(409);
      expect(r.body.codigo).toBe('ESPECIE_NO_ATENDIDA');
      expect(r.body.message).toBe('El aliado no atiende la especie de Firulais (Perro)');
      expect(hayEscritura(consultas)).toBe(false);
      await app.close();
    });
  });

  it('sin sesión (401) y solo para tutores (403)', async () => {
    const sin = bdReservas({ usuario: null });
    const app = await crearApp([ReservasModule], sin.db);
    await request(app.getHttpServer()).patch(RUTA).send({ motivo: 'x' }).expect(401);
    await app.close();
    const aliado = bdReservas({ usuario: ALIADO });
    const app2 = await crearApp([ReservasModule], aliado.db);
    await request(app2.getHttpServer())
      .patch(RUTA)
      .set('Cookie', COOKIE)
      .send({ motivo: 'x' })
      .expect(403);
    await app2.close();
  });
});

describe('HU-030 · el motivo se muestra al usuario autorizado', () => {
  const VETERINARIO: UsuarioPrueba = { ...ALIADO, id: ADMIN_ALIADO, rol: 'VETERINARIO' };
  const cita = (extra = {}) =>
    citaExistente({
      tutor_id: TUTOR.id,
      mascota_id: MASCOTA,
      motivo: 'Vómito desde ayer',
      ...extra,
    });

  it('el tutor de la cita ve el motivo y los datos principales', async () => {
    const { db, consultas } = bdReservas({ citas: [cita()] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toMatchObject({
      id: CITA_EXISTENTE,
      estado: 'AGENDADA',
      motivo: 'Vómito desde ayer',
      precio: 60000,
      tutor: { id: TUTOR.id },
      mascota: { id: MASCOTA, nombre: 'Firulais', especie: 'Perro' },
      aliado: { nombre: 'Clínica Central' },
      servicio: { nombre: 'Consulta' },
      veterinario: { nombre: 'Dra. Ana' },
    });
    // la consulta pregunta por la persona que mira, no solo por la cita
    const lectura = consultas.find((c) => c.sql.includes('FROM v_cita_detalle'));
    expect(lectura?.valores).toEqual([CITA_EXISTENTE, TUTOR.id]);
    await app.close();
  });

  it('una cita sin motivo lo muestra como null', async () => {
    const { db } = bdReservas({ citas: [cita({ motivo: null })] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.motivo).toBeNull();
    await app.close();
  });

  it('el tutor y el aliado ven las recomendaciones que dejó el aliado al finalizar (HU-033)', async () => {
    const conRecomendaciones = cita({
      estado: 'FINALIZADA',
      recomendaciones: 'Dieta blanda por 3 días y control en una semana.',
    });
    for (const usuario of [TUTOR, ALIADO]) {
      const { db } = bdReservas({
        usuario,
        citas: [conRecomendaciones],
        autorizadosAVer: [usuario.id],
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer())
        .get(`/api/citas/${CITA_EXISTENTE}`)
        .set('Cookie', COOKIE)
        .expect(200);
      expect(r.body).toMatchObject({
        estado: 'FINALIZADA',
        recomendaciones: 'Dieta blanda por 3 días y control en una semana.',
      });
      await app.close();
    }
  });

  it('mientras el aliado no las escriba, las recomendaciones son null', async () => {
    const { db } = bdReservas({ citas: [cita()] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.recomendaciones).toBeNull();
    await app.close();
  });

  it.each([
    ['el administrador del aliado', ALIADO],
    ['un veterinario del aliado', VETERINARIO],
  ])('%s también ve el motivo', async (_quien, usuario) => {
    const { db } = bdReservas({ usuario, citas: [cita()], autorizadosAVer: [usuario.id] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.motivo).toBe('Vómito desde ayer');
    await app.close();
  });

  it('otra persona no la ve: responde 404, igual que si no existiera', async () => {
    const otro: UsuarioPrueba = { ...TUTOR, id: OTRO_USUARIO };
    const { db } = bdReservas({ usuario: otro, citas: [cita()] });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(404);
    expect(JSON.stringify(r.body)).not.toContain('Vómito');
    await app.close();
    const inexistente = bdReservas({ citas: [] });
    const app2 = await crearApp([ReservasModule], inexistente.db);
    await request(app2.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(404);
    await app2.close();
  });

  it('el Equipo Veto no ve el motivo (403) y sin sesión tampoco (401)', async () => {
    const admin: UsuarioPrueba = { ...ALIADO, rol: 'EQUIPO_VETO' };
    const a = bdReservas({ usuario: admin, citas: [cita()], autorizadosAVer: [admin.id] });
    const app = await crearApp([ReservasModule], a.db);
    await request(app.getHttpServer())
      .get(`/api/citas/${CITA_EXISTENTE}`)
      .set('Cookie', COOKIE)
      .expect(403);
    await app.close();
    const b = bdReservas({ usuario: null, citas: [cita()] });
    const app2 = await crearApp([ReservasModule], b.db);
    await request(app2.getHttpServer()).get(`/api/citas/${CITA_EXISTENTE}`).expect(401);
    await app2.close();
  });

  it('un id que no es válido responde 400', async () => {
    const { db } = bdReservas();
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).get('/api/citas/abc').set('Cookie', COOKIE).expect(400);
    await app.close();
  });
});
