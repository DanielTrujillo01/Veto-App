import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const OTRO_USUARIO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const RUTA = `/api/aliados/${ALIADO_ID}/confirmacion`;

type Escenario = {
  tipo?: string;
  estado?: string;
  dueno?: string;
  /** Modo guardado hoy (la base lo crea en AUTOMATICA). */
  modo?: 'AUTOMATICA' | 'MANUAL';
};

/**
 * Simula la tabla aliado: la consulta pública solo ve aliados activos que reciben citas (como
 * su WHERE), y el UPDATE cambia el modo en memoria.
 */
function bd(e: Escenario = {}, usuario = ALIADO) {
  const estado = { modo: e.modo ?? 'AUTOMATICA' };
  const tipo = e.tipo ?? 'CLINICA';
  const estadoAliado = e.estado ?? 'ACTIVO';
  const fabrica = crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM aliado a JOIN usuario u')) {
      return {
        rows: [
          {
            tipo,
            estado: estadoAliado,
            usuario_id: e.dueno ?? ALIADO.id,
            rol: 'ALIADO',
            estado_cuenta: 'ACTIVA',
          },
        ],
      };
    }
    if (sql.includes('SELECT modo_confirmacion')) {
      const tiposValidos = valores[1] as string[];
      const visible = estadoAliado === 'ACTIVO' && tiposValidos.includes(tipo);
      return { rows: visible ? [{ modo_confirmacion: estado.modo }] : [] };
    }
    if (sql.includes('UPDATE aliado SET modo_confirmacion')) {
      estado.modo = valores[1] as 'AUTOMATICA' | 'MANUAL';
      return { rows: [{ modo_confirmacion: estado.modo }] };
    }
  }, usuario);
  return { ...fabrica, estado };
}

const esEscritura = (sql: string) => /^UPDATE aliado/.test(sql.trim());

describe('HU-023 · ver cómo confirma sus citas un aliado (público)', () => {
  it('por defecto es automática: la reserva queda AGENDADA, sin necesidad de sesión', async () => {
    const { db } = bd({}, null as never);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).expect(200);
    expect(r.body).toEqual({ modo: 'AUTOMATICA', estadoInicialCita: 'AGENDADA' });
    await app.close();
  });

  it('en modo manual avisa al tutor que la reserva quedará PENDIENTE de aceptación', async () => {
    const { db } = bd({ modo: 'MANUAL' });
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).expect(200);
    expect(r.body).toEqual({ modo: 'MANUAL', estadoInicialCita: 'PENDIENTE' });
    await app.close();
  });

  it.each([
    ['un aliado pendiente de activación', { estado: 'PENDIENTE' }],
    ['un aliado suspendido', { estado: 'SUSPENDIDO' }],
    ['una tienda (no recibe citas)', { tipo: 'TIENDA' }],
    ['una fundación (no recibe citas)', { tipo: 'FUNDACION' }],
  ])('responde 404 para %s', async (_quien, escenario) => {
    const { db } = bd(escenario);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get(RUTA).expect(404);
    await app.close();
  });

  it('un id que no es UUID responde 400', async () => {
    const { db } = bd();
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get('/api/aliados/no-es-uuid/confirmacion').expect(400);
    await app.close();
  });
});

describe('HU-023 · elegir confirmación automática o manual', () => {
  it('pasa a manual a nombre del administrador y lo comunica al tutor', async () => {
    const { db, consultas, estado } = bd();
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ modo: 'MANUAL' })
      .expect(200);
    expect(r.body).toEqual({ modo: 'MANUAL', estadoInicialCita: 'PENDIENTE' });
    expect(estado.modo).toBe('MANUAL');

    const escritura = consultas.find((c) => esEscritura(c.sql));
    expect(escritura?.usuarioTx).toBe(ALIADO.id); // transacción a nombre del administrador
    expect(escritura?.sql).toContain('WHERE id = $1');
    expect(escritura?.valores).toEqual([ALIADO_ID, 'MANUAL']);

    // el estado que ve el tutor coincide con la configuración guardada
    const publica = await request(app.getHttpServer()).get(RUTA).expect(200);
    expect(publica.body).toEqual(r.body);
    await app.close();
  });

  it('puede volver a automática', async () => {
    const { db, estado } = bd({ modo: 'MANUAL' });
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ modo: 'AUTOMATICA' })
      .expect(200);
    expect(r.body).toEqual({ modo: 'AUTOMATICA', estadoInicialCita: 'AGENDADA' });
    expect(estado.modo).toBe('AUTOMATICA');
    await app.close();
  });

  it('guardar el mismo modo dos veces no falla (idempotente)', async () => {
    const { db, estado } = bd();
    const app = await crearApp([AliadosModule], db);
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send({ modo: 'MANUAL' })
        .expect(200);
    }
    expect(estado.modo).toBe('MANUAL');
    await app.close();
  });

  it('un veterinario independiente también puede elegirlo', async () => {
    const { db } = bd({ tipo: 'VET_INDEPENDIENTE' });
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ modo: 'MANUAL' })
      .expect(200);
    await app.close();
  });

  it('solo se guarda el modo: otros campos del cuerpo no llegan a la base', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ modo: 'MANUAL', estado: 'SUSPENDIDO', tipo: 'TIENDA' })
      .expect(200);
    const escritura = consultas.find((c) => esEscritura(c.sql));
    expect(escritura?.valores).toEqual([ALIADO_ID, 'MANUAL']);
    expect(escritura?.sql).not.toMatch(/estado\s*=|tipo\s*=/);
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    const { db } = bd({}, null as never);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).put(RUTA).send({ modo: 'MANUAL' }).expect(401);
    await app.close();
  });

  it.each([
    ['un tutor', { usuario: TUTOR, escenario: {} }],
    [
      'otro usuario que no administra el aliado',
      { usuario: ALIADO, escenario: { dueno: OTRO_USUARIO } },
    ],
    ['una tienda (no recibe citas)', { usuario: ALIADO, escenario: { tipo: 'TIENDA' } }],
    ['una fundación', { usuario: ALIADO, escenario: { tipo: 'FUNDACION' } }],
    [
      'un aliado todavía pendiente de activación',
      { usuario: ALIADO, escenario: { estado: 'PENDIENTE' } },
    ],
    ['un aliado suspendido', { usuario: ALIADO, escenario: { estado: 'SUSPENDIDO' } }],
  ])('responde 403 a %s y no cambia nada', async (_quien, { usuario, escenario }) => {
    const { db, consultas, estado } = bd(escenario, usuario);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ modo: 'MANUAL' })
      .expect(403);
    expect(consultas.some((c) => esEscritura(c.sql))).toBe(false);
    expect(estado.modo).toBe('AUTOMATICA');
    await app.close();
  });

  it.each([
    ['sin el modo', {}],
    ['modo vacío', { modo: '' }],
    ['modo en minúsculas', { modo: 'manual' }],
    ['modo desconocido', { modo: 'SEMI' }],
    ['modo nulo', { modo: null }],
    ['modo numérico', { modo: 1 }],
  ])('responde 400 con %s y no cambia nada', async (_caso, cuerpo) => {
    const { db, consultas, estado } = bd();
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(cuerpo)
      .expect(400);
    expect(Object.keys(r.body.errores as Record<string, string>)).toContain('modo');
    expect(consultas.some((c) => esEscritura(c.sql))).toBe(false);
    expect(estado.modo).toBe('AUTOMATICA');
    await app.close();
  });

  it('un id que no es UUID responde 400', async () => {
    const { db } = bd();
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put('/api/aliados/no-es-uuid/confirmacion')
      .set('Cookie', COOKIE)
      .send({ modo: 'MANUAL' })
      .expect(400);
    await app.close();
  });
});
