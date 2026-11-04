import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa } from './utilidades';

const CLINICA = '33333333-3333-4333-8333-333333333333';
const VET = '44444444-4444-4444-8444-444444444444';
const FOTO = 'https://images.example.com/veterinario.jpg';

describe('HU-013 · ficha pública y perfil de veterinario', () => {
  it('expone la foto y descripción registradas en la ficha pública', async () => {
    const { db } = crearBdFalsa((sql) => {
      if (sql.includes('FROM aliado') && sql.includes('tipo =')) {
        return {
          rows: [{ id: CLINICA, nombre: 'Clínica Veto', descripcion: 'Atención integral' }],
        };
      }
      if (sql.includes('FROM veterinario v')) {
        return {
          rows: [{ id: VET, nombre: 'Dra. Luna', foto_url: FOTO, descripcion: 'Medicina felina' }],
        };
      }
    }, null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .get(`/api/aliados/${CLINICA}/veterinarios`)
      .expect(200);
    expect(r.body).toMatchObject({
      id: CLINICA,
      veterinarios: [
        { id: VET, nombre: 'Dra. Luna', fotoUrl: FOTO, descripcion: 'Medicina felina' },
      ],
    });
    await app.close();
  });

  it('permite actualizar los campos y devuelve lo guardado', async () => {
    const { db, consultas } = crearBdFalsa((sql, valores) => {
      if (sql.includes('SELECT EXISTS')) return { rows: [{ ok: true }] };
      if (sql.includes('UPDATE veterinario')) {
        expect(valores).toEqual([VET, CLINICA, FOTO, 'Medicina felina']);
        return {
          rows: [
            {
              id: VET,
              usuario_id: TUTOR.id,
              aliado_id: CLINICA,
              foto_url: FOTO,
              descripcion: 'Medicina felina',
            },
          ],
        };
      }
    }, ALIADO);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(`/api/aliados/${CLINICA}/veterinarios/${VET}/perfil`)
      .set('Cookie', COOKIE)
      .send({ fotoUrl: FOTO, descripcion: 'Medicina felina' })
      .expect(200);
    expect(r.body).toMatchObject({ fotoUrl: FOTO, descripcion: 'Medicina felina' });
    expect(consultas.find((c) => c.sql.includes('UPDATE veterinario'))?.usuarioTx).toBe(ALIADO.id);
    await app.close();
  });

  it('rechaza perfiles inválidos, usuarios sin rol aliado y cambios sobre veterinarios ajenos', async () => {
    const invalido = await crearApp([AliadosModule], crearBdFalsa(() => undefined, ALIADO).db);
    await request(invalido.getHttpServer())
      .put(`/api/aliados/${CLINICA}/veterinarios/${VET}/perfil`)
      .set('Cookie', COOKIE)
      .send({ fotoUrl: 'no-es-url' })
      .expect(400);
    await invalido.close();

    const tutor = await crearApp([AliadosModule], crearBdFalsa(() => undefined, TUTOR).db);
    await request(tutor.getHttpServer())
      .put(`/api/aliados/${CLINICA}/veterinarios/${VET}/perfil`)
      .set('Cookie', COOKIE)
      .send({ descripcion: 'Cambio no autorizado' })
      .expect(403);
    await tutor.close();

    const ajeno = await crearApp(
      [AliadosModule],
      crearBdFalsa((sql) => {
        if (sql.includes('SELECT EXISTS')) return { rows: [{ ok: true }] };
        if (sql.includes('UPDATE veterinario')) return { rows: [] };
      }, ALIADO).db,
    );
    await request(ajeno.getHttpServer())
      .put(`/api/aliados/${CLINICA}/veterinarios/${VET}/perfil`)
      .set('Cookie', COOKIE)
      .send({ descripcion: 'No debe guardarse' })
      .expect(404);
    await ajeno.close();
  });
});
