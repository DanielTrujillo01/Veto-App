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

describe('HU-013 · los cambios se reflejan en la ficha pública', () => {
  /** Ficha en memoria: la clínica tiene un veterinario cuya foto y descripción se editan. */
  function fichaEnMemoria() {
    const vet = {
      id: VET,
      nombre: 'Dra. Luna',
      foto_url: null as string | null,
      descripcion: null as string | null,
    };
    const { db } = crearBdFalsa((sql, valores) => {
      if (sql.includes('SELECT EXISTS')) return { rows: [{ ok: true }] };
      if (sql.includes('FROM aliado') && sql.includes('tipo =')) {
        return { rows: [{ id: CLINICA, nombre: 'Clínica Veto', descripcion: null }] };
      }
      if (sql.includes('UPDATE veterinario')) {
        const sets = sql.slice(sql.indexOf('SET') + 3, sql.indexOf('WHERE'));
        sets.split(',').forEach((asignacion) => {
          const [columna, parametro] = asignacion.split('=').map((t) => t.trim());
          const valor = valores[Number(parametro.slice(1)) - 1] as string | null;
          if (columna === 'foto_url') vet.foto_url = valor;
          if (columna === 'descripcion') vet.descripcion = valor;
        });
        return { rows: [{ ...vet, usuario_id: TUTOR.id, aliado_id: CLINICA }] };
      }
      if (sql.includes('FROM veterinario v')) return { rows: [vet] };
    }, ALIADO);
    return db;
  }

  const ficha = async (app: Awaited<ReturnType<typeof crearApp>>) =>
    (await request(app.getHttpServer()).get(`/api/aliados/${CLINICA}/veterinarios`).expect(200))
      .body.veterinarios[0];
  const guardar = (app: Awaited<ReturnType<typeof crearApp>>, body: object) =>
    request(app.getHttpServer())
      .put(`/api/aliados/${CLINICA}/veterinarios/${VET}/perfil`)
      .set('Cookie', COOKIE)
      .send(body);

  it('sin foto ni descripción la ficha lo indica con null, y tras guardar los muestra', async () => {
    const app = await crearApp([AliadosModule], fichaEnMemoria());
    expect(await ficha(app)).toMatchObject({ fotoUrl: null, descripcion: null });

    await guardar(app, { fotoUrl: FOTO, descripcion: '  Medicina felina  ' }).expect(200);
    expect(await ficha(app)).toMatchObject({ fotoUrl: FOTO, descripcion: 'Medicina felina' });

    await guardar(app, { descripcion: 'Cirugía' }).expect(200);
    expect(await ficha(app)).toMatchObject({ fotoUrl: FOTO, descripcion: 'Cirugía' });
    await app.close();
  });

  it('un texto vacío quita la foto y la ficha vuelve a la alternativa visual', async () => {
    const app = await crearApp([AliadosModule], fichaEnMemoria());
    await guardar(app, { fotoUrl: FOTO }).expect(200);
    await guardar(app, { fotoUrl: '' }).expect(200);
    expect((await ficha(app)).fotoUrl).toBeNull();
    await app.close();
  });

  it('rechaza una foto que no es http(s) con el detalle por campo', async () => {
    const app = await crearApp([AliadosModule], fichaEnMemoria());
    const r = await guardar(app, { fotoUrl: 'javascript:alert(1)' }).expect(400);
    expect(r.body.errores).toHaveProperty('fotoUrl');
    expect((await ficha(app)).fotoUrl).toBeNull();
    await app.close();
  });
});

describe('HU-013 · la ficha solo muestra veterinarios activos', () => {
  it('filtra veterinarios desactivados y cuentas que no están activas', async () => {
    const { db, consultas } = crearBdFalsa((sql) => {
      if (sql.includes('FROM aliado') && sql.includes('tipo =')) {
        return { rows: [{ id: CLINICA, nombre: 'Clínica Veto', descripcion: null }] };
      }
    }, null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get(`/api/aliados/${CLINICA}/veterinarios`).expect(200);
    const sql = consultas.find((c) => c.sql.includes('FROM veterinario v'))?.sql ?? '';
    expect(sql).toContain('v.activo');
    expect(sql).toContain("u.estado = 'ACTIVA'");
    await app.close();
  });

  it('una clínica inexistente o inactiva responde 404', async () => {
    const { db } = crearBdFalsa(() => undefined, null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get(`/api/aliados/${CLINICA}/veterinarios`).expect(404);
    await app.close();
  });
});
