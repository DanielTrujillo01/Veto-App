import { ConflictException, Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HoraLocalInterceptor, aHoraLocalEnRespuesta } from '../src/common/hora-local.interceptor';
import { OPCIONES_DE_SESION } from '../src/database/sesion';
import { ReservasModule } from '../src/modules/reservas/reservas.module';
import { ALIADO_ID, FIN, INICIO, SERVICIO, VENCE, bdReservas } from './reservas-falsa';
import { COOKIE, crearApp } from './utilidades';

// INICIO = 2099-06-03T13:00Z = 08:00 en Colombia
const INICIO_LOCAL = '2099-06-03T08:00:00.000-05:00';
const FIN_LOCAL = '2099-06-03T08:30:00.000-05:00';
const VENCE_LOCAL = '2099-06-03T09:00:00.000-05:00';

describe('zona horaria · conversión de una respuesta', () => {
  it('pasa a hora de Colombia las fechas (Date) y los textos en UTC', () => {
    expect(aHoraLocalEnRespuesta(new Date(INICIO))).toBe(INICIO_LOCAL);
    expect(aHoraLocalEnRespuesta(INICIO)).toBe(INICIO_LOCAL);
    expect(aHoraLocalEnRespuesta('2099-06-03T13:00:00Z')).toBe(INICIO_LOCAL);
  });

  it('recorre objetos y listas anidadas', () => {
    const entrada = {
      id: 'abc',
      total: 3,
      activo: true,
      nada: null,
      espacios: [{ inicio: INICIO, fin: FIN, veterinario: { creado: new Date(FIN) } }],
    };
    expect(aHoraLocalEnRespuesta(entrada)).toEqual({
      id: 'abc',
      total: 3,
      activo: true,
      nada: null,
      espacios: [{ inicio: INICIO_LOCAL, fin: FIN_LOCAL, veterinario: { creado: FIN_LOCAL } }],
    });
  });

  it('deja igual lo que no es un instante en UTC', () => {
    const intactos = [
      '2099-06-03T08:00:00.000-05:00', // ya está en hora de Colombia
      '2099-06-03T13:00:00+02:00', // otro desfase
      '2099-06-03', // fecha sin hora
      '08:00', // hora del día
      'Cita el 2099-06-03T13:00:00.000Z en la clínica', // un texto que solo lo menciona
      '2099-13-45T99:99:99.000Z', // con forma de fecha pero no lo es
      'hola',
      '',
    ];
    for (const texto of intactos) expect(aHoraLocalEnRespuesta(texto)).toBe(texto);
    expect(aHoraLocalEnRespuesta(42)).toBe(42);
    expect(aHoraLocalEnRespuesta(null)).toBeNull();
    expect(aHoraLocalEnRespuesta(undefined)).toBeUndefined();
    expect(aHoraLocalEnRespuesta(true)).toBe(true);
  });

  it('no inventa nada con una fecha inválida', () => {
    const invalida = new Date('x');
    expect(aHoraLocalEnRespuesta(invalida)).toBe(invalida);
  });

  it('no toca objetos que no son JSON plano, como un Buffer', () => {
    const buffer = Buffer.from('2099-06-03T13:00:00.000Z');
    expect(aHoraLocalEnRespuesta(buffer)).toBe(buffer);
  });

  it('no modifica el objeto original', () => {
    const original = { inicio: INICIO };
    aHoraLocalEnRespuesta(original);
    expect(original.inicio).toBe(INICIO);
  });
});

@Controller('prueba')
class PruebaController {
  @Get('fechas')
  fechas() {
    return { desde: new Date(INICIO), hasta: FIN, lista: [{ en: INICIO }], creado: '2099-01-01' };
  }

  @Get('conflicto')
  conflicto() {
    throw new ConflictException({
      message: 'Hay citas en ese intervalo',
      codigo: 'CONFLICTO',
      citas: [{ id: 'c1', inicio: INICIO, fin: FIN }],
    });
  }

  @Get('texto')
  texto() {
    throw new ConflictException('Mensaje simple');
  }

  @Get('roto')
  roto(): never {
    throw new Error('falla inesperada');
  }
}

async function appDePrueba(): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ controllers: [PruebaController] }).compile();
  const app = modulo.createNestApplication();
  app.useGlobalInterceptors(new HoraLocalInterceptor());
  await app.init();
  return app;
}

describe('zona horaria · interceptor de la API', () => {
  it('las respuestas salen en hora de Colombia', async () => {
    const app = await appDePrueba();
    const r = await request(app.getHttpServer()).get('/prueba/fechas').expect(200);
    expect(r.body).toEqual({
      desde: INICIO_LOCAL,
      hasta: FIN_LOCAL,
      lista: [{ en: INICIO_LOCAL }],
      creado: '2099-01-01',
    });
    await app.close();
  });

  it('los cuerpos de error también (por ejemplo, las citas que impiden un bloqueo)', async () => {
    const app = await appDePrueba();
    const r = await request(app.getHttpServer()).get('/prueba/conflicto').expect(409);
    expect(r.body).toEqual({
      message: 'Hay citas en ese intervalo',
      codigo: 'CONFLICTO',
      citas: [{ id: 'c1', inicio: INICIO_LOCAL, fin: FIN_LOCAL }],
    });
    await app.close();
  });

  it('un error con mensaje simple conserva su estado y su mensaje', async () => {
    const app = await appDePrueba();
    const r = await request(app.getHttpServer()).get('/prueba/texto').expect(409);
    expect(r.body.message).toBe('Mensaje simple');
    await app.close();
  });

  it('un error inesperado sigue siendo un 500', async () => {
    const app = await appDePrueba();
    await request(app.getHttpServer()).get('/prueba/roto').expect(500);
    await app.close();
  });
});

describe('zona horaria · el calendario y la reserva (HU-022, HU-029)', () => {
  const RUTA_DISPONIBILIDAD = `/api/aliados/${ALIADO_ID}/disponibilidad`;

  it('los espacios libres llegan en hora de Colombia: el de las 08:00 dice 08:00', async () => {
    const { db } = bdReservas();
    const app = await crearApp([ReservasModule], db, {}, { horaLocal: true });
    const r = await request(app.getHttpServer())
      .get(RUTA_DISPONIBILIDAD)
      .query({ servicioId: SERVICIO, desde: '2099-06-03', hasta: '2099-06-03' })
      .expect(200);
    expect(r.body.espacios).toEqual([
      expect.objectContaining({ inicio: INICIO_LOCAL, fin: FIN_LOCAL }),
    ]);
    await app.close();
  });

  it('la selección del tutor llega en hora de Colombia, incluido cuándo vence', async () => {
    const { db } = bdReservas();
    const app = await crearApp([ReservasModule], db, {}, { horaLocal: true });
    const r = await request(app.getHttpServer())
      .get('/api/reservas/seleccion')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toMatchObject({ inicio: INICIO_LOCAL, fin: FIN_LOCAL, venceEn: VENCE_LOCAL });
    await app.close();
  });

  it('se puede elegir con la hora que llegó (-05:00) o con la misma hora en UTC (Z)', async () => {
    const { db, consultas } = bdReservas({ borrador: null });
    const app = await crearApp([ReservasModule], db, {}, { horaLocal: true });
    for (const inicio of [INICIO_LOCAL, INICIO]) {
      const r = await request(app.getHttpServer())
        .put('/api/reservas/seleccion')
        .set('Cookie', COOKIE)
        .send({
          servicioId: SERVICIO,
          veterinarioId: '44444444-4444-4444-8444-444444444444',
          inicio,
        })
        .expect(200);
      expect(r.body.inicio).toBe(INICIO_LOCAL);
    }
    // a la base siempre llega el mismo instante
    const guardados = consultas
      .filter((c) => c.sql.includes('INSERT INTO seleccion_horario'))
      .map((c) => c.valores[4]);
    expect(guardados).toEqual([INICIO, INICIO]);
    await app.close();
  });

  it('sin el interceptor la API entregaría UTC (por eso main.ts lo registra)', async () => {
    const { db } = bdReservas();
    const app = await crearApp([ReservasModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/reservas/seleccion')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toMatchObject({ inicio: INICIO, fin: FIN, venceEn: VENCE });
    await app.close();
  });
});

describe('zona horaria · sesión de la base de datos', () => {
  it('cada conexión usa hora de Colombia y el esquema veto', () => {
    expect(OPCIONES_DE_SESION).toContain('-c timezone=America/Bogota');
    expect(OPCIONES_DE_SESION).toContain('-c search_path=veto,public');
  });
});
