import request from 'supertest';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, errorPg, type Fila } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const SERVICIO_ID = '88888888-8888-4888-8888-888888888888';
const SEDE_ID = '99999999-9999-4999-8999-999999999999';
const SEDE_AJENA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const filaServicio = (extra: Fila = {}) => ({
  id: SERVICIO_ID,
  aliado_id: ALIADO_ID,
  tipo_servicio_id: 1,
  tipo_servicio: 'Consulta general',
  nombre: 'Consulta general',
  descripcion: null,
  modalidad: 'A_DOMICILIO',
  sede_id: null,
  duracion_min: 30,
  precio_base: 60000,
  activo: true,
  creado_en: new Date('2026-01-01T00:00:00Z'),
  ...extra,
});

type Escenario = {
  tipo?: string;
  estado?: string;
  dueno?: string;
  tieneCitas?: boolean;
  servicios?: Fila[];
  error?: (sql: string) => void;
};

function bd(e: Escenario = {}, usuario = ALIADO) {
  const servicios = e.servicios ?? [filaServicio()];
  return crearBdFalsa((sql, valores) => {
    e.error?.(sql);
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
    if (sql.includes('FROM sede WHERE')) return { rows: [{ ok: valores[0] === SEDE_ID }] };
    if (sql.includes('FROM aliado WHERE'))
      return { rows: [{ ok: (e.estado ?? 'ACTIVO') === 'ACTIVO' }] };
    if (sql.includes('FROM cita')) return { rows: [{ tiene: e.tieneCitas ?? false }] };
    if (sql.includes('INSERT INTO servicio')) return { rows: [{ id: SERVICIO_ID }] };
    if (sql.includes('FROM servicio s')) {
      if (sql.includes('s.id = $1'))
        return { rows: valores[0] === SERVICIO_ID ? [servicios[0]] : [] };
      const disponibles = sql.includes('s.activo AND');
      return {
        rows: servicios.filter(
          (s) =>
            !disponibles ||
            (s.activo &&
              (!sql.includes('se.activa') || s.modalidad !== 'EN_SEDE' || s.sede_activa !== false)),
        ),
      };
    }
  }, usuario);
}

const valido = {
  tipoServicioId: 1,
  nombre: 'Consulta general',
  modalidad: 'A_DOMICILIO',
  duracionMin: 30,
  precioBase: 60000,
};
const base = `/api/aliados/${ALIADO_ID}/servicios`;

describe('HU-018 · crear servicio', () => {
  it('el aliado dueño crea un servicio con los campos obligatorios', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send(valido)
      .expect(201);
    expect(r.body).toMatchObject({ id: SERVICIO_ID, activo: true, precioBase: 60000 });
    const insert = consultas.find((c) => c.sql.includes('INSERT INTO servicio'));
    expect(insert?.valores[0]).toBe(ALIADO_ID);
    expect(insert?.usuarioTx).toBe(ALIADO.id);
    await app.close();
  });

  it('valida los datos: en sede sin sede, precio negativo', async () => {
    const app = await crearApp([ServiciosModule], bd().db);
    const r = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...valido, modalidad: 'EN_SEDE' })
      .expect(400);
    expect(r.body.errores).toHaveProperty('sedeId');
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...valido, precioBase: -1 })
      .expect(400);
    await app.close();
  });

  it('la sede debe ser una sede activa del mismo aliado', async () => {
    const app = await crearApp([ServiciosModule], bd().db);
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...valido, modalidad: 'EN_SEDE', sedeId: SEDE_AJENA })
      .expect(400);
    await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...valido, modalidad: 'EN_SEDE', sedeId: SEDE_ID })
      .expect(201);
    await app.close();
  });

  it('un tipo de servicio inexistente responde 400', async () => {
    const { db } = bd({
      error: (sql) => {
        if (sql.includes('INSERT INTO servicio')) throw errorPg('23503');
      },
    });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .post(base)
      .set('Cookie', COOKIE)
      .send({ ...valido, tipoServicioId: 99 })
      .expect(400);
    expect(r.body.errores).toHaveProperty('tipoServicioId');
    await app.close();
  });

  it.each([
    ['una tienda', { tipo: 'TIENDA' }, 403],
    ['un aliado pendiente', { estado: 'PENDIENTE' }, 403],
    ['el aliado de otro usuario', { dueno: TUTOR.id }, 403],
  ])('no permite gestionar servicios de %s', async (_caso, escenario, codigo) => {
    const { db, consultas } = bd(escenario);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).post(base).set('Cookie', COOKIE).send(valido).expect(codigo);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO servicio'))).toBe(false);
    await app.close();
  });

  it('exige sesión y rol de aliado', async () => {
    const sinSesion = await crearApp([ServiciosModule], bd({}, null as never).db);
    await request(sinSesion.getHttpServer()).post(base).send(valido).expect(401);
    await sinSesion.close();
    const tutor = await crearApp([ServiciosModule], bd({}, TUTOR).db);
    await request(tutor.getHttpServer()).post(base).set('Cookie', COOKIE).send(valido).expect(403);
    await tutor.close();
  });
});

describe('HU-018 · editar servicio', () => {
  it('edita nombre y precio aunque tenga citas (las citas guardan su precio)', async () => {
    const { db, consultas } = bd({ tieneCitas: true });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .put(`${base}/${SERVICIO_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...valido, nombre: 'Consulta premium', precioBase: 80000 })
      .expect(200);
    expect(consultas.some((c) => c.sql.includes('UPDATE servicio'))).toBe(true);
    expect(consultas.some((c) => /UPDATE cita/.test(c.sql))).toBe(false);
    await app.close();
  });

  it('con citas no permite cambiar el tipo ni la modalidad', async () => {
    const { db, consultas } = bd({ tieneCitas: true });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .put(`${base}/${SERVICIO_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...valido, tipoServicioId: 2 })
      .expect(409);
    expect(consultas.some((c) => c.sql.includes('UPDATE servicio'))).toBe(false);
    await app.close();
  });

  it('sin citas sí permite cambiar el tipo', async () => {
    const app = await crearApp([ServiciosModule], bd({ tieneCitas: false }).db);
    await request(app.getHttpServer())
      .put(`${base}/${SERVICIO_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...valido, tipoServicioId: 2 })
      .expect(200);
    await app.close();
  });

  it('un servicio de otro aliado o inexistente responde 404', async () => {
    const app = await crearApp([ServiciosModule], bd().db);
    await request(app.getHttpServer())
      .put(`${base}/${SEDE_AJENA}`)
      .set('Cookie', COOKIE)
      .send(valido)
      .expect(404);
    await app.close();
  });
});

describe('HU-018 · desactivar servicio', () => {
  it('desactiva sin borrar y sin tocar las citas', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer())
      .patch(`${base}/${SERVICIO_ID}/desactivar`)
      .set('Cookie', COOKIE)
      .expect(200);
    const update = consultas.find((c) => c.sql.includes('SET activo'));
    expect(update?.valores).toEqual([SERVICIO_ID, ALIADO_ID, false]);
    expect(consultas.some((c) => /DELETE|UPDATE cita/.test(c.sql))).toBe(false);
    await app.close();
  });

  it('los desactivados no aparecen como disponibles, pero sí en la gestión', async () => {
    const servicios = [
      filaServicio(),
      filaServicio({ id: SEDE_AJENA, nombre: 'Baño', activo: false }),
      filaServicio({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        nombre: 'Consulta en sede desactivada',
        modalidad: 'EN_SEDE',
        sede_id: SEDE_ID,
        sede_activa: false,
      }),
    ];
    const { db, consultas } = bd({ servicios });
    const app = await crearApp([ServiciosModule], db);
    const publico = await request(app.getHttpServer()).get(base).expect(200);
    expect(publico.body.map((s: { nombre: string }) => s.nombre)).toEqual(['Consulta general']);
    expect(consultas.find((c) => c.sql.includes('FROM servicio s'))?.sql).toContain(
      'se.id = s.sede_id AND se.aliado_id = s.aliado_id AND se.activa',
    );
    const gestion = await request(app.getHttpServer())
      .get(`${base}/gestion`)
      .set('Cookie', COOKIE)
      .expect(200);
    expect(gestion.body).toHaveLength(3);
    await app.close();
  });

  it('el catálogo de tipos de servicio es público', async () => {
    const { db } = crearBdFalsa(() => ({ rows: [{ id: 1, nombre: 'Consulta general' }] }), null);
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).get('/api/servicios/tipos').expect(200);
    await app.close();
  });
});
