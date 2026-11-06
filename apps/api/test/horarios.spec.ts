import request from 'supertest';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ALIADO, COOKIE, crearApp, crearBdFalsa } from './utilidades';

const CLINICA = '33333333-3333-4333-8333-333333333333';
const VET = '44444444-4444-4444-8444-444444444444';

describe('integración HU-012 / HU-016 con la sesión', () => {
  it('el endpoint de horarios está registrado y exige sesión', async () => {
    const { db } = crearBdFalsa(() => undefined, null);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .get(`/api/aliados/${CLINICA}/veterinarios/${VET}/horarios`)
      .expect(401);
    await app.close();
  });

  it('el actor de horarios sale de la sesión y no de un header', async () => {
    const { db, consultas } = crearBdFalsa((sql) => {
      if (sql.includes('JOIN veterinario v')) {
        return {
          rows: [
            {
              tipo: 'CLINICA',
              estado: 'ACTIVO',
              usuario_id: ALIADO.id,
              veterinario_usuario_id: '55555555-5555-4555-8555-555555555555',
              rol: 'ALIADO',
              estado_cuenta: 'ACTIVA',
            },
          ],
        };
      }
    }, ALIADO);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .get(`/api/aliados/${CLINICA}/veterinarios/${VET}/horarios`)
      .set('Cookie', COOKIE)
      .set('x-user-id', 'otro-usuario')
      .expect(200);
    expect(consultas.some((c) => c.usuarioTx === ALIADO.id)).toBe(true);
    expect(consultas.some((c) => c.usuarioTx === 'otro-usuario')).toBe(false);
    await app.close();
  });

  it('permite al veterinario independiente gestionar el horario de su propio perfil', async () => {
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
    }, ALIADO);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .get(`/api/aliados/${CLINICA}/veterinarios/${VET}/horarios`)
      .set('Cookie', COOKIE)
      .expect(200);
    await app.close();
  });

  it('crear veterinario exige sesión', async () => {
    const { db } = crearBdFalsa(() => undefined, null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .post(`/api/aliados/${CLINICA}/veterinarios`)
      .send({})
      .expect(401);
    await app.close();
  });
});
