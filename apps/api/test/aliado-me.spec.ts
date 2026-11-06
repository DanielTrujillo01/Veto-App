import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';

function bd(usuario = ALIADO, tieneAliado = true) {
  const creadoEn = new Date('2026-01-15T12:00:00.000Z');
  const { db, consultas } = crearBdFalsa((sql) => {
    if (sql.includes('FROM aliado') && sql.includes('WHERE usuario_id = $1')) {
      return {
        rows: tieneAliado
          ? [
              {
                id: ALIADO_ID,
                tipo: 'CLINICA',
                nombre: 'Clínica Veto',
                descripcion: null,
                contacto: null,
                ciudad: null,
                ubicacion: null,
                estado: 'PENDIENTE',
                creado_en: creadoEn,
              },
            ]
          : [],
      };
    }
  }, usuario);
  return { db, consultas };
}

describe('GET /api/aliados/me', () => {
  it('devuelve el aliado vinculado a la cuenta autenticada aunque esté pendiente', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([AliadosModule], db);
    const respuesta = await request(app.getHttpServer())
      .get('/api/aliados/me')
      .set('Cookie', COOKIE)
      .expect(200);

    expect(respuesta.body).toEqual({
      aliado: {
        id: ALIADO_ID,
        tipo: 'CLINICA',
        nombre: 'Clínica Veto',
        descripcion: null,
        contacto: null,
        ciudad: null,
        ubicacion: null,
        estado: 'PENDIENTE',
        creadoEn: '2026-01-15T12:00:00.000Z',
      },
    });
    expect(consultas.at(-1)?.valores).toEqual([ALIADO.id]);
    await app.close();
  });

  it('requiere una sesión y un usuario con rol de aliado', async () => {
    const { db } = bd(null as never);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get('/api/aliados/me').expect(401);
    await app.close();
  });

  it('rechaza cuentas que no son aliados', async () => {
    const { db } = bd(TUTOR);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get('/api/aliados/me').set('Cookie', COOKIE).expect(403);
    await app.close();
  });

  it('responde 404 si la cuenta no tiene un aliado asociado', async () => {
    const { db } = bd(ALIADO, false);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get('/api/aliados/me').set('Cookie', COOKIE).expect(404);
    await app.close();
  });
});
