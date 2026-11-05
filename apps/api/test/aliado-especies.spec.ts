import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa, errorPg } from './utilidades';

const ALIADO_ID = '77777777-7777-4777-8777-777777777777';
const SERVICIO_ID = '88888888-8888-4888-8888-888888888888';
const OTRO_USUARIO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

/** Catálogo de especies de la base de datos (el id 99 no existe). */
const CATALOGO = [
  { id: 1, nombre: 'Perro' },
  { id: 2, nombre: 'Gato' },
  { id: 3, nombre: 'Ave' },
  { id: 4, nombre: 'Conejo' },
];

type Escenario = {
  tipo?: string;
  estado?: string;
  dueno?: string;
  /** Especies que el aliado ya atiende. */
  atiende?: number[];
};

/**
 * Simula aliado, aliado_especie y especie. aliado_especie se guarda en memoria y responde a
 * DELETE / INSERT como la base real (incluida la llave foránea contra el catálogo).
 */
function bd(e: Escenario = {}, usuario = ALIADO) {
  const atiende = new Set(e.atiende ?? []);
  const catalogo = new Set(CATALOGO.map((x) => x.id));
  const fabrica = crearBdFalsa((sql, valores) => {
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
    if (sql.includes('FROM aliado WHERE')) {
      return { rows: [{ ok: (e.estado ?? 'ACTIVO') === 'ACTIVO' }] };
    }
    if (sql.includes('DELETE FROM aliado_especie')) {
      const conservar = new Set(valores[1] as number[]);
      for (const id of [...atiende]) if (!conservar.has(id)) atiende.delete(id);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO aliado_especie')) {
      const ids = valores[1] as number[];
      if (ids.some((id) => !catalogo.has(id)))
        throw errorPg('23503', 'aliado_especie_especie_id_fkey');
      for (const id of ids) atiende.add(id);
      return { rows: [] };
    }
    if (sql.includes('SELECT especie_id FROM aliado_especie')) {
      return { rows: [...atiende].map((especie_id) => ({ especie_id })) };
    }
    if (sql.includes('EXISTS (SELECT 1 FROM aliado_especie')) {
      return { rows: [{ ok: atiende.has(valores[1] as number) }] };
    }
    if (sql.includes('FROM especie')) return { rows: CATALOGO };
    if (sql.includes('FROM servicio s')) {
      return {
        rows: [
          {
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
          },
        ],
      };
    }
  }, usuario);
  return { ...fabrica, atiende };
}

const RUTA = `/api/aliados/${ALIADO_ID}/especies`;

describe('HU-021 · ver las especies de un aliado (ficha pública)', () => {
  it('lista las especies que atiende, por orden alfabético, sin necesidad de sesión', async () => {
    const { db } = bd({ atiende: [1, 2, 3] }, null as never);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).expect(200);
    expect(r.body).toEqual([
      { id: 3, nombre: 'Ave' },
      { id: 2, nombre: 'Gato' },
      { id: 1, nombre: 'Perro' },
    ]);
    await app.close();
  });

  it('un aliado que aún no configuró especies devuelve una lista vacía', async () => {
    const { db } = bd({ atiende: [] });
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).get(RUTA).expect(200);
    expect(r.body).toEqual([]);
    await app.close();
  });

  it('un aliado que no está activo responde 404', async () => {
    const { db } = bd({ estado: 'PENDIENTE', atiende: [1] });
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get(RUTA).expect(404);
    await app.close();
  });

  it('un id que no es UUID responde 400', async () => {
    const { db } = bd();
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get('/api/aliados/no-es-uuid/especies').expect(400);
    await app.close();
  });
});

describe('HU-021 · guardar y actualizar las especies que atiende', () => {
  it('guarda la selección a nombre del administrador y devuelve las especies', async () => {
    const { db, consultas, atiende } = bd();
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ especieIds: [1, 3] })
      .expect(200);

    expect(r.body).toEqual([
      { id: 3, nombre: 'Ave' },
      { id: 1, nombre: 'Perro' },
    ]);
    expect([...atiende].sort()).toEqual([1, 3]);
    const escrituras = consultas.filter((c) => /^(DELETE|INSERT)/.test(c.sql.trim()));
    expect(escrituras).toHaveLength(2);
    for (const c of escrituras) {
      expect(c.usuarioTx).toBe(ALIADO.id); // transacción a nombre del administrador
      expect(c.valores[0]).toBe(ALIADO_ID);
    }
    await app.close();
  });

  it('actualizar reemplaza la selección: agrega las nuevas y quita las que ya no atiende', async () => {
    const { db, atiende, consultas } = bd({ atiende: [1, 2] });
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ especieIds: [2, 4] })
      .expect(200);
    // el SQL borra solo lo que ya no está en la selección y agrega sin duplicar
    const borrado = consultas.find((c) => c.sql.includes('DELETE FROM aliado_especie'));
    expect(borrado?.sql).toContain('NOT (especie_id = ANY($2::smallint[]))');
    expect(borrado?.valores).toEqual([ALIADO_ID, [2, 4]]);
    const insercion = consultas.find((c) => c.sql.includes('INSERT INTO aliado_especie'));
    expect(insercion?.sql).toContain('ON CONFLICT DO NOTHING');
    expect([...atiende].sort()).toEqual([2, 4]); // quitó Perro (1), conservó Gato (2), agregó Conejo (4)
    expect(r.body.map((e: { id: number }) => e.id).sort()).toEqual([2, 4]);

    // y la ficha pública ya refleja el cambio
    const ficha = await request(app.getHttpServer()).get(RUTA).expect(200);
    expect(ficha.body.map((e: { nombre: string }) => e.nombre)).toEqual(['Conejo', 'Gato']);
    await app.close();
  });

  it('guardar dos veces lo mismo no duplica ni falla (idempotente)', async () => {
    const { db, atiende } = bd({ atiende: [1] });
    const app = await crearApp([AliadosModule], db);
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .put(RUTA)
        .set('Cookie', COOKIE)
        .send({ especieIds: [1] })
        .expect(200);
    }
    expect([...atiende]).toEqual([1]);
    await app.close();
  });

  it('un veterinario independiente también puede configurar sus especies', async () => {
    const { db } = bd({ tipo: 'VET_INDEPENDIENTE' });
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ especieIds: [1] })
      .expect(200);
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    const { db } = bd({}, null as never);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put(RUTA)
      .send({ especieIds: [1] })
      .expect(401);
    await app.close();
  });

  it.each([
    ['un tutor', { usuario: TUTOR, escenario: {} }],
    [
      'otro usuario que no administra el aliado',
      { usuario: ALIADO, escenario: { dueno: OTRO_USUARIO } },
    ],
    ['una tienda (no atiende animales)', { usuario: ALIADO, escenario: { tipo: 'TIENDA' } }],
    ['una fundación', { usuario: ALIADO, escenario: { tipo: 'FUNDACION' } }],
    [
      'un aliado todavía pendiente de activación',
      { usuario: ALIADO, escenario: { estado: 'PENDIENTE' } },
    ],
    ['un aliado suspendido', { usuario: ALIADO, escenario: { estado: 'SUSPENDIDO' } }],
  ])('responde 403 a %s y no escribe nada', async (_quien, { usuario, escenario }) => {
    const { db, consultas, atiende } = bd({ ...escenario, atiende: [1] }, usuario);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ especieIds: [2] })
      .expect(403);
    expect(consultas.some((c) => /^(DELETE|INSERT)/.test(c.sql.trim()))).toBe(false);
    expect([...atiende]).toEqual([1]);
    await app.close();
  });

  it.each([
    ['sin la lista', {}],
    ['lista vacía', { especieIds: [] }],
    ['especies repetidas', { especieIds: [1, 1] }],
    ['un id que no es número', { especieIds: ['perro'] }],
    ['un id negativo', { especieIds: [-2] }],
  ])('responde 400 con %s y no escribe nada', async (_caso, cuerpo) => {
    const { db, consultas } = bd({ atiende: [1] });
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send(cuerpo)
      .expect(400);
    // un elemento inválido se reporta con su posición: "especieIds.0"
    const campos = Object.keys(r.body.errores as Record<string, string>);
    expect(campos.some((campo) => campo.startsWith('especieIds'))).toBe(true);
    expect(consultas.some((c) => /^(DELETE|INSERT)/.test(c.sql.trim()))).toBe(false);
    await app.close();
  });

  it('una especie que no existe en el catálogo responde 400', async () => {
    const { db } = bd();
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .put(RUTA)
      .set('Cookie', COOKIE)
      .send({ especieIds: [1, 99] })
      .expect(400);
    expect(r.body.errores.especieIds).toBe('Alguna de las especies no existe');
    await app.close();
  });
});

describe('HU-021 · la búsqueda y los filtros solo consideran las especies configuradas', () => {
  const SERVICIOS = `/api/aliados/${ALIADO_ID}/servicios`;

  it('sin filtro de especie lista los servicios disponibles', async () => {
    const { db } = bd({ atiende: [1] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(SERVICIOS).expect(200);
    expect(r.body).toHaveLength(1);
    await app.close();
  });

  it('con una especie que el aliado atiende, devuelve sus servicios', async () => {
    const { db } = bd({ atiende: [1, 2] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(`${SERVICIOS}?especieId=2`).expect(200);
    expect(r.body).toHaveLength(1);
    await app.close();
  });

  it('con una especie que NO atiende, la lista llega vacía y ni siquiera consulta servicios', async () => {
    const { db, consultas } = bd({ atiende: [1] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(`${SERVICIOS}?especieId=3`).expect(200);
    expect(r.body).toEqual([]);
    expect(consultas.some((c) => c.sql.includes('FROM servicio s'))).toBe(false);
    await app.close();
  });

  it('un aliado sin especies configuradas no es compatible con ninguna', async () => {
    const { db } = bd({ atiende: [] });
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer()).get(`${SERVICIOS}?especieId=1`).expect(200);
    expect(r.body).toEqual([]);
    await app.close();
  });

  it('un aliado inactivo sigue respondiendo 404, con o sin filtro', async () => {
    const { db } = bd({ estado: 'SUSPENDIDO', atiende: [1] });
    const app = await crearApp([ServiciosModule], db);
    await request(app.getHttpServer()).get(`${SERVICIOS}?especieId=1`).expect(404);
    await request(app.getHttpServer()).get(SERVICIOS).expect(404);
    await app.close();
  });

  it.each(['abc', '0', '-1', '1.5', '99999'])(
    'un especieId inválido (%s) responde 400',
    async (valor) => {
      const { db } = bd({ atiende: [1] });
      const app = await crearApp([ServiciosModule], db);
      const r = await request(app.getHttpServer())
        .get(`${SERVICIOS}?especieId=${valor}`)
        .expect(400);
      expect(r.body.errores).toHaveProperty('especieId');
      await app.close();
    },
  );
});
