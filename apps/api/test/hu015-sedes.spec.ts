import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, type Fila } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const SEDE_ID = '88888888-8888-4888-8888-888888888888';
const SEDE_AJENA_ID = '99999999-9999-4999-8999-999999999999';

const filaSede = (extra: Fila = {}) => ({
  id: SEDE_ID,
  aliado_id: ALIADO_ID,
  nombre: 'Sede Norte',
  direccion: 'Carrera 7 # 60-10',
  ciudad: 'Bogotá',
  activa: true,
  ...extra,
});

type Escenario = {
  tipo?: string;
  estado?: string;
  dueno?: string;
  sedes?: Fila[];
};

function bd(e: Escenario = {}, usuario = ALIADO) {
  const sedes = e.sedes ?? [filaSede()];
  return crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM aliado a JOIN usuario u')) {
      return {
        rows: [
          {
            tipo: e.tipo ?? 'CLINICA',
            estado: e.estado ?? 'ACTIVO',
            usuario_id: e.dueno ?? ALIADO.id,
            rol: 'ALIADO',
            estado_cuenta: 'ACTIVA',
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO sede')) return { rows: [filaSede()] };
    if (sql.includes('UPDATE sede')) {
      const desactivando = sql.includes('activa = false');
      const sede = sedes.find(
        (s) => s.id === valores[0] && s.aliado_id === valores[1] && (!desactivando || s.activa),
      );
      return {
        rows: sede
          ? [
              {
                ...sede,
                ...(desactivando
                  ? { activa: false }
                  : { nombre: valores[2], direccion: valores[3], ciudad: valores[4] }),
              },
            ]
          : [],
      };
    }
    if (sql.includes('FROM sede')) {
      if (sql.includes('WHERE id = $1 AND aliado_id = $2')) {
        const sede = sedes.find((s) => s.id === valores[0] && s.aliado_id === valores[1]);
        return { rows: sede ? [sede] : [] };
      }
      if (sql.includes('WHERE aliado_id = $1 AND activa')) {
        return { rows: sedes.filter((s) => s.activa) };
      }
      return { rows: sedes };
    }
    if (sql.includes('EXISTS (')) {
      return { rows: [{ tipo: 'CLINICA', estado: 'ACTIVO' }] };
    }
    return undefined;
  }, usuario);
}

const base = `/api/aliados/${ALIADO_ID}/sedes`;
const datos = { nombre: 'Sede Norte', direccion: 'Carrera 7 # 60-10', ciudad: 'Bogotá' };

describe('HU-015 · gestión de sedes', () => {
  it('crea, consulta, edita y desactiva sedes conservando su asociación a la clínica', async () => {
    const { db, consultas } = bd({
      sedes: [filaSede(), filaSede({ id: SEDE_AJENA_ID, activa: false, nombre: 'Sede Sur' })],
    });
    const app = await crearApp([AliadosModule], db);

    const creada = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send(datos)
      .expect(201);
    expect(creada.body).toMatchObject({ aliadoId: ALIADO_ID, ...datos, activa: true });
    expect(consultas.find((c) => c.sql.includes('INSERT INTO sede'))?.valores).toEqual([
      ALIADO_ID,
      datos.nombre,
      datos.direccion,
      datos.ciudad,
    ]);

    const gestion = await request(app.getHttpServer())
      .get(`${base}/gestion`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(gestion.body).toHaveLength(2);
    expect(gestion.body.map((s: { activa: boolean }) => s.activa)).toEqual([true, false]);

    await request(app.getHttpServer())
      .get(`${base}/${SEDE_ID}`)
      .set('Cookie', COOKIE)
      .expect(200)
      .expect(({ body }) => expect(body.id).toBe(SEDE_ID));

    await request(app.getHttpServer())
      .put(`${base}/${SEDE_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...datos, nombre: 'Sede Central' })
      .expect(200)
      .expect(({ body }) => expect(body.nombre).toBe('Sede Central'));

    await request(app.getHttpServer())
      .put(`${base}/${SEDE_AJENA_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...datos, nombre: 'Sede Sur editada' })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ activa: false, nombre: 'Sede Sur editada' }),
      );

    await request(app.getHttpServer())
      .patch(`${base}/${SEDE_ID}/desactivar`)
      .set('Cookie', COOKIE)
      .expect(200)
      .expect(({ body }) => expect(body.activa).toBe(false));
    await app.close();
  });

  it('publica solamente sedes activas de clínicas activas', async () => {
    const { db, consultas } = bd({
      sedes: [filaSede(), filaSede({ id: SEDE_AJENA_ID, activa: false })],
    });
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).get(base).expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ id: SEDE_ID, activa: true });
    expect(consultas[0].sql).toContain("tipo = 'CLINICA' AND estado = 'ACTIVO'");
    await app.close();
  });

  it('rechaza campos obligatorios vacíos o inválidos', async () => {
    const app = await crearApp([AliadosModule], bd().db);
    for (const body of [
      { ...datos, nombre: '  ' },
      { ...datos, direccion: '' },
      { ...datos, ciudad: '  ' },
      { ...datos, nombre: 'n'.repeat(121) },
    ]) {
      await request(app.getHttpServer()).post(base).set('Cookie', COOKIE).send(body).expect(400);
    }
    await app.close();
  });

  it.each([
    ['una tienda', { tipo: 'TIENDA' }, 403],
    ['un aliado pendiente', { estado: 'PENDIENTE' }, 403],
    ['el aliado de otro usuario', { dueno: TUTOR.id }, 403],
  ])('no permite a %s gestionar sedes', async (_caso, escenario, status) => {
    const { db, consultas } = bd(escenario);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).post(base).set('Cookie', COOKIE).send(datos).expect(status);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO sede'))).toBe(false);
    await app.close();
  });

  it('exige sesión y rol de aliado', async () => {
    const sinSesion = await crearApp([AliadosModule], bd({}, null as never).db);
    await request(sinSesion.getHttpServer()).post(base).send(datos).expect(401);
    await sinSesion.close();
    const tutor = await crearApp([AliadosModule], bd({}, TUTOR).db);
    await request(tutor.getHttpServer()).post(base).set('Cookie', COOKIE).send(datos).expect(403);
    await tutor.close();
  });

  it('impide editar y desactivar sedes que no pertenecen a la clínica', async () => {
    const app = await crearApp([AliadosModule], bd().db);
    await request(app.getHttpServer())
      .put(`${base}/${SEDE_AJENA_ID}`)
      .set('Cookie', COOKIE)
      .send(datos)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${base}/${SEDE_AJENA_ID}/desactivar`)
      .set('Cookie', COOKIE)
      .expect(404);
    await app.close();
  });
});
