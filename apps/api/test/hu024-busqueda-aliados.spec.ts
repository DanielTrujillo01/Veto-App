import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa } from './utilidades';

const RUTA = '/api/aliados/busqueda/nombre';
const RESULTADOS = [
  { id: '11111111-1111-4111-8111-111111111111', nombre: 'Clínica Veto', tipo: 'CLINICA' },
  {
    id: '22222222-2222-4222-8222-222222222222',
    nombre: 'Vet Independiente',
    tipo: 'VET_INDEPENDIENTE',
  },
  { id: '33333333-3333-4333-8333-333333333333', nombre: 'Tienda Veto', tipo: 'TIENDA' },
];

function bd(rows = RESULTADOS, usuario = TUTOR) {
  const { db, consultas } = crearBdFalsa((sql) => {
    if (sql.includes('FROM aliado') && sql.includes('COLLATE "C"')) return { rows };
  }, usuario);
  return { db, consultas };
}

describe('HU-024 · búsqueda de aliados por nombre', () => {
  it('devuelve coincidencias exactas de aliados activos y pasa el límite de 10 a la consulta', async () => {
    const { db, consultas } = bd();
    const app = await crearApp([AliadosModule], db);
    const respuesta = await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre: 'Clínica Veto' })
      .set('Cookie', COOKIE)
      .expect(200);

    expect(respuesta.body).toEqual(RESULTADOS);
    const consulta = consultas.find((c) => c.sql.includes('FROM aliado'));
    expect(consulta?.sql).toContain('nombre COLLATE "C" = ($1::text) COLLATE "C"');
    expect(consulta?.sql).toContain('tipo IN ($3, $4, $5)');
    expect(consulta?.sql).toContain('LIMIT $6');
    expect(consulta?.valores).toEqual([
      'Clínica Veto',
      'ACTIVO',
      'CLINICA',
      'VET_INDEPENDIENTE',
      'TIENDA',
      10,
    ]);
    await app.close();
  });

  it('devuelve una lista vacía cuando no hay coincidencias', async () => {
    const { db } = bd([]);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre: 'Nombre inexistente' })
      .set('Cookie', COOKIE)
      .expect(200, []);
    await app.close();
  });

  it.each([undefined, '', '   '])('rechaza nombre ausente o vacío (%s) con 400', async (nombre) => {
    const { db, consultas } = bd();
    const app = await crearApp([AliadosModule], db);
    const solicitud = request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE);
    const respuesta =
      nombre === undefined
        ? await solicitud.expect(400)
        : await solicitud.query({ nombre }).expect(400);

    expect(respuesta.body.errores).toHaveProperty('nombre');
    expect(consultas.some((c) => c.sql.includes('FROM aliado'))).toBe(false);
    await app.close();
  });

  it('requiere una sesión autenticada', async () => {
    const { db } = bd([], null as never);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).get(RUTA).query({ nombre: 'Clínica Veto' }).expect(401);
    await app.close();
  });

  it('solo permite la búsqueda a tutores', async () => {
    const { db } = bd([], ALIADO);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre: 'Clínica Veto' })
      .set('Cookie', COOKIE)
      .expect(403);
    await app.close();
  });
});

describe('HU-024 · parametrización y filtros SQL', () => {
  it('mantiene el texto de búsqueda como parámetro y aplica los filtros del contrato', async () => {
    const nombre = "%' OR TRUE; DROP TABLE aliado; --";
    const { db, consultas } = bd([]);
    const app = await crearApp([AliadosModule], db);

    await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre })
      .set('Cookie', COOKIE)
      .expect(200, []);

    const consulta = consultas.find((c) => c.sql.includes('FROM aliado'));
    expect(consulta?.sql).not.toContain(nombre);
    expect(consulta?.valores[0]).toBe(nombre);
    expect(consulta?.sql).toContain('SELECT id, nombre, tipo');
    expect(consulta?.sql).toContain('AND estado = $2');
    expect(consulta?.sql).toContain('tipo IN ($3, $4, $5)');
    expect(consulta?.sql).toContain('LIMIT $6');
    expect(consulta?.sql).not.toMatch(/\b(ILIKE|OFFSET)\b/i);
    await app.close();
  });
});
