import request from 'supertest';
import { ReservasModule } from '../src/modules/reservas/reservas.module';
import {
  ALIADO_ID,
  CITA_EXISTENTE,
  CITA_NUEVA,
  FIN,
  INICIO,
  MASCOTA,
  OTRA_MASCOTA,
  OTRO_VET,
  PASADO,
  PASADO_FIN,
  SERVICIO,
  VET,
  bdReservas,
  citaExistente,
} from './reservas-falsa';
import { ALIADO, COOKIE, TUTOR, crearApp, errorPg } from './utilidades';

const RESUMEN = '/api/reservas/resumen';
const RESERVAS = '/api/reservas';

const creoCita = (consultas: { sql: string }[]) =>
  consultas.filter((c) => c.sql.includes('INSERT INTO cita'));
const BORRADOR_LISTO = { mascota_id: MASCOTA, motivo: 'Vómito desde ayer' };

describe('HU-031 · resumen antes de confirmar', () => {
  it('muestra los datos principales, el precio y el estado en que quedará la cita', async () => {
    const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO, precio: 90000 });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({
      aliadoNombre: 'Clínica Central',
      precio: 90000,
      estadoInicial: 'AGENDADA',
      listo: true,
      pendientes: [],
      seleccion: {
        aliadoId: ALIADO_ID,
        servicioId: SERVICIO,
        servicioNombre: 'Consulta',
        veterinarioId: VET,
        veterinarioNombre: 'Dra. Ana',
        inicio: INICIO,
        fin: FIN,
        mascotaId: MASCOTA,
        mascotaNombre: 'Firulais',
        motivo: 'Vómito desde ayer',
        vigente: true,
      },
    });
    // ver el resumen no crea ni cambia nada
    expect(consultas.some((c) => /^(INSERT|UPDATE|DELETE)/.test(c.sql.trim()))).toBe(false);
    await app.close();
  });

  it('avisa que la cita quedará PENDIENTE cuando el aliado acepta las citas a mano', async () => {
    const { db } = bdReservas({ borrador: BORRADOR_LISTO, modo: 'MANUAL' });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body.estadoInicial).toBe('PENDIENTE');
    expect(r.body.listo).toBe(true);
    await app.close();
  });

  it('sin mascota no está listo y dice qué falta', async () => {
    const { db } = bdReservas();
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body.listo).toBe(false);
    expect(r.body.precio).toBeNull();
    expect(r.body.pendientes).toEqual([
      { campo: 'mascotaId', mensaje: 'Elige la mascota para la cita' },
    ]);
    await app.close();
  });

  it('el motivo no es obligatorio: sin motivo sigue estando listo', async () => {
    const { db } = bdReservas({ borrador: { mascota_id: MASCOTA } });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body).toMatchObject({ listo: true, seleccion: { motivo: null } });
    await app.close();
  });

  it('si el espacio ya lo tomó otra persona no está listo y lo dice', async () => {
    const { db } = bdReservas({
      borrador: BORRADOR_LISTO,
      espacios: [INICIO],
      citas: [citaExistente()],
    });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body.listo).toBe(false);
    expect(r.body.seleccion).toMatchObject({ vigente: false, razon: 'OCUPADO' });
    expect(r.body.pendientes).toEqual([
      { campo: 'horario', mensaje: 'Ese horario ya fue tomado: elige otro' },
    ]);
    await app.close();
  });

  it('si la hora ya pasó no está listo', async () => {
    const { db } = bdReservas({
      borrador: { ...BORRADOR_LISTO, inicio: PASADO, fin: PASADO_FIN },
    });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body.pendientes[0]).toEqual({
      campo: 'horario',
      mensaje: 'No puedes elegir una fecha u hora que ya pasó',
    });
    await app.close();
  });

  it('si el aliado dejó de atender la especie de la mascota no está listo', async () => {
    const { db } = bdReservas({ borrador: BORRADOR_LISTO, atiendeEspecie: false });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body.listo).toBe(false);
    expect(r.body.pendientes).toEqual([
      {
        campo: 'mascotaId',
        mensaje: 'El aliado no atiende la especie de Firulais (Perro)',
      },
    ]);
    await app.close();
  });

  it('una reserva que ya se confirmó no está lista para confirmar otra vez', async () => {
    const { db } = bdReservas({
      borrador: { ...BORRADOR_LISTO, cita_id: CITA_EXISTENTE },
      citas: [citaExistente({ tutor_id: TUTOR.id, mascota_id: MASCOTA })],
    });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(200);
    expect(r.body.listo).toBe(false);
    expect(r.body.pendientes).toEqual([
      { campo: 'reserva', mensaje: 'Esta reserva ya se confirmó' },
    ]);
    await app.close();
  });

  it('sin una reserva en curso responde 404', async () => {
    const { db } = bdReservas({ borrador: null });
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(404);
    await app.close();
  });

  it('exige sesión de tutor', async () => {
    const sin = bdReservas({ usuario: null });
    const app = await crearApp([ReservasModule], sin.db);
    await request(app.getHttpServer()).get(RESUMEN).expect(401);
    await app.close();
    const aliado = bdReservas({ usuario: ALIADO });
    const app2 = await crearApp([ReservasModule], aliado.db);
    await request(app2.getHttpServer()).get(RESUMEN).set('Cookie', COOKIE).expect(403);
    await app2.close();
  });
});

describe('HU-031 · confirmar la reserva', () => {
  it('crea la cita con mascota, servicio, aliado, fecha, hora y motivo elegidos', async () => {
    const { db, consultas, estado } = bdReservas({ borrador: BORRADOR_LISTO });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(201);
    expect(r.body).toMatchObject({
      id: CITA_NUEVA,
      estado: 'AGENDADA',
      inicio: INICIO,
      fin: FIN,
      precio: 60000,
      motivo: 'Vómito desde ayer',
      tutor: { id: TUTOR.id },
      mascota: { id: MASCOTA, nombre: 'Firulais' },
      aliado: { id: ALIADO_ID, nombre: 'Clínica Central' },
      servicio: { id: SERVICIO, nombre: 'Consulta' },
      veterinario: { id: VET },
      repetida: false,
    });
    const insercion = consultas.find((c) => c.sql.includes('INSERT INTO cita'));
    // [tutor, mascota, aliado, servicio, veterinario, inicio, fin, motivo]
    expect(insercion?.valores).toEqual([
      TUTOR.id,
      MASCOTA,
      ALIADO_ID,
      SERVICIO,
      VET,
      INICIO,
      FIN,
      'Vómito desde ayer',
    ]);
    expect(insercion?.usuarioTx).toBe(TUTOR.id);
    // la reserva queda apuntando a la cita creada
    expect(estado.borrador?.cita_id).toBe(CITA_NUEVA);
    await app.close();
  });

  it('el precio es el del servicio para esa mascota y el estado lo fija la base, no la petición', async () => {
    const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO });
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer())
      .post(RESERVAS)
      .set('Cookie', COOKIE)
      .send({ estado: 'FINALIZADA', precio: 1, motivo: 'otro', mascotaId: OTRA_MASCOTA })
      .expect(201);
    const insercion = consultas.find((c) => c.sql.includes('INSERT INTO cita'));
    expect(insercion?.sql).toContain('fn_precio_servicio($4, $2)');
    expect(insercion?.sql).not.toContain('estado');
    // nada del cuerpo se usa: solo lo elegido en el flujo
    expect(insercion?.valores).toContain(MASCOTA);
    expect(insercion?.valores).not.toContain(OTRA_MASCOTA);
    expect(insercion?.valores).not.toContain('otro');
    await app.close();
  });

  it('sin motivo la cita se crea con motivo null', async () => {
    const { db, consultas } = bdReservas({ borrador: { mascota_id: MASCOTA } });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(201);
    expect(r.body.motivo).toBeNull();
    expect(consultas.find((c) => c.sql.includes('INSERT INTO cita'))?.valores[7]).toBeNull();
    await app.close();
  });

  it('con confirmación manual del aliado la cita queda PENDIENTE', async () => {
    const { db } = bdReservas({ borrador: BORRADOR_LISTO, modo: 'MANUAL' });
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(201);
    expect(r.body.estado).toBe('PENDIENTE');
    await app.close();
  });

  it('bloquea la reserva del tutor mientras confirma (para que un doble clic espere)', async () => {
    const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO });
    const app = await crearApp([ReservasModule], db);
    await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(201);
    const lectura = consultas.find((c) => c.sql.includes('FOR UPDATE'));
    expect(lectura?.sql).toContain('FROM seleccion_horario');
    expect(lectura?.valores).toEqual([TUTOR.id]);
    await app.close();
  });

  describe('sin duplicados ante doble clic o reintento', () => {
    it('confirmar dos veces devuelve la misma cita y solo crea una', async () => {
      const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO });
      const app = await crearApp([ReservasModule], db);
      const primera = await request(app.getHttpServer())
        .post(RESERVAS)
        .set('Cookie', COOKIE)
        .expect(201);
      const segunda = await request(app.getHttpServer())
        .post(RESERVAS)
        .set('Cookie', COOKIE)
        .expect(200);
      expect(segunda.body).toEqual({ ...primera.body, repetida: true });
      expect(creoCita(consultas)).toHaveLength(1);
      await app.close();
    });

    it('un reintento tardío, con la reserva ya vencida, devuelve la misma cita', async () => {
      const { db, consultas } = bdReservas({
        borrador: { ...BORRADOR_LISTO, cita_id: CITA_EXISTENTE, vencido: true },
        citas: [
          citaExistente({ tutor_id: TUTOR.id, mascota_id: MASCOTA, motivo: 'Vómito desde ayer' }),
        ],
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(200);
      expect(r.body).toMatchObject({ id: CITA_EXISTENTE, repetida: true });
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('si la cita de esa reserva ya se canceló no crea otra sola: pide elegir de nuevo', async () => {
      const { db, consultas } = bdReservas({
        borrador: { ...BORRADOR_LISTO, cita_id: CITA_EXISTENTE },
        citas: [citaExistente({ tutor_id: TUTOR.id, mascota_id: MASCOTA, estado: 'CANCELADA' })],
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.codigo).toBe('YA_CONFIRMADA');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('una cita igual que el tutor ya tiene (misma mascota, servicio y hora, con otro veterinario) se rechaza como duplicada', async () => {
      const { db, consultas } = bdReservas({
        borrador: BORRADOR_LISTO,
        citas: [
          citaExistente({
            tutor_id: TUTOR.id,
            mascota_id: MASCOTA,
            veterinario_id: OTRO_VET,
          }),
        ],
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body).toMatchObject({
        codigo: 'DUPLICADA',
        citaId: CITA_EXISTENTE,
        message: 'Ya tienes una cita para Firulais en ese horario',
      });
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('la misma hora para otra mascota no es duplicada', async () => {
      const { db, consultas } = bdReservas({
        borrador: BORRADOR_LISTO,
        citas: [
          citaExistente({
            tutor_id: TUTOR.id,
            mascota_id: OTRA_MASCOTA,
            veterinario_id: OTRO_VET,
          }),
        ],
      });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(201);
      expect(creoCita(consultas)).toHaveLength(1);
      await app.close();
    });

    it('si la base detecta la duplicada al insertar (23505) responde 409 DUPLICADA', async () => {
      const { db } = bdReservas({
        borrador: BORRADOR_LISTO,
        errorAlCrearCita: errorPg('23505'),
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.codigo).toBe('DUPLICADA');
      await app.close();
    });
  });

  describe('validación antes de crear', () => {
    it('sin una reserva en curso responde 404', async () => {
      const { db, consultas } = bdReservas({ borrador: null });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(404);
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('sin mascota responde 400 con el campo requerido', async () => {
      const { db, consultas } = bdReservas();
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(400);
      expect(r.body.errores.mascotaId).toBe('Elige la mascota para la cita');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('si la mascota ya no es del tutor responde 400', async () => {
      const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO, mascotas: [] });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(400);
      expect(r.body.errores).toHaveProperty('mascotaId');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('si la hora ya pasó responde 400 PASADO', async () => {
      const { db, consultas } = bdReservas({
        borrador: { ...BORRADOR_LISTO, inicio: PASADO, fin: PASADO_FIN },
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(400);
      expect(r.body.razon).toBe('PASADO');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('si otra persona tomó el espacio mientras tanto responde 409 OCUPADO', async () => {
      const { db, consultas } = bdReservas({
        borrador: BORRADOR_LISTO,
        espacios: [INICIO],
        citas: [citaExistente()],
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.razon).toBe('OCUPADO');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('si el aliado ya no atiende en ese horario responde 409 NO_DISPONIBLE', async () => {
      const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO, espacios: [] });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.razon).toBe('NO_DISPONIBLE');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it.each([
      ['el servicio ya no está disponible', { servicioNoDisponible: true }],
      ['el veterinario ya no atiende', { veterinarios: [] }],
      ['el servicio cambió de duración', { duracionMin: 60 }],
    ])('si %s responde 409 NO_DISPONIBLE', async (_caso, opciones) => {
      const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO, ...opciones });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.razon).toBe('NO_DISPONIBLE');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });

    it('si el aliado no atiende la especie de la mascota responde 409', async () => {
      const { db, consultas } = bdReservas({ borrador: BORRADOR_LISTO, atiendeEspecie: false });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.codigo).toBe('ESPECIE_NO_ATENDIDA');
      expect(creoCita(consultas)).toHaveLength(0);
      await app.close();
    });
  });

  describe('si la base rechaza la cita al crearla', () => {
    it('23P01 (otro se llevó el espacio justo ahora): 409 OCUPADO', async () => {
      const { db, estado } = bdReservas({
        borrador: BORRADOR_LISTO,
        errorAlCrearCita: errorPg('23P01'),
      });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body.razon).toBe('OCUPADO');
      expect(estado.borrador?.cita_id).toBeNull();
      await app.close();
    });

    it('23514 (otra regla de la base): 409 NO_DISPONIBLE con el mensaje de la base', async () => {
      const error = Object.assign(new Error('La cita está fuera del horario configurado'), {
        code: '23514',
      });
      const { db } = bdReservas({ borrador: BORRADOR_LISTO, errorAlCrearCita: error });
      const app = await crearApp([ReservasModule], db);
      const r = await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(409);
      expect(r.body).toMatchObject({
        razon: 'NO_DISPONIBLE',
        message: 'La cita está fuera del horario configurado',
      });
      await app.close();
    });

    it('un error inesperado responde 500 y no deja la reserva marcada como confirmada', async () => {
      const { db, estado } = bdReservas({
        borrador: BORRADOR_LISTO,
        errorAlCrearCita: new Error('se cayó la conexión'),
      });
      const app = await crearApp([ReservasModule], db);
      await request(app.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(500);
      expect(estado.borrador?.cita_id).toBeNull();
      await app.close();
    });
  });

  it('sin sesión (401) y solo para tutores (403)', async () => {
    const sin = bdReservas({ usuario: null });
    const app = await crearApp([ReservasModule], sin.db);
    await request(app.getHttpServer()).post(RESERVAS).expect(401);
    await app.close();
    const aliado = bdReservas({ usuario: ALIADO, borrador: BORRADOR_LISTO });
    const app2 = await crearApp([ReservasModule], aliado.db);
    await request(app2.getHttpServer()).post(RESERVAS).set('Cookie', COOKIE).expect(403);
    expect(creoCita(aliado.consultas)).toHaveLength(0);
    await app2.close();
  });
});
