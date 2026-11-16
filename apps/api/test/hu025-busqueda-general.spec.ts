import request from 'supertest';
import { BusquedaModule } from '../src/modules/busqueda/busqueda.module';
import { ALIADO, COOKIE, TUTOR, crearApp, crearBdFalsa } from './utilidades';

const RUTA = '/api/busqueda';
const FILAS = [
  { categoria: 'CLINICA', id: '11111111-1111-4111-8111-111111111111', nombre: 'Clínica Norte' },
  { categoria: 'PRODUCTO', id: '22222222-2222-4222-8222-222222222222', nombre: 'Croquetas Norte' },
  { categoria: 'SERVICIO', id: '33333333-3333-4333-8333-333333333333', nombre: 'Consulta Norte' },
];

function escenario(rows = FILAS, usuario = TUTOR) {
  const { db, consultas } = crearBdFalsa((sql) => {
    if (sql.includes('WITH coincidencias AS')) return { rows };
  }, usuario);
  return { db, consultas };
}

describe('HU-025 · búsqueda general por nombre', () => {
  it('agrupa los resultados por categoría y expone solo id y nombre', async () => {
    const { db } = escenario();
    const app = await crearApp([BusquedaModule], db);
    const respuesta = await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre: 'CLINICA' })
      .set('Cookie', COOKIE)
      .expect(200);

    expect(respuesta.body).toEqual({
      resultadosPorCategoria: [
        { categoria: 'CLINICA', resultados: [{ id: FILAS[0].id, nombre: FILAS[0].nombre }] },
        { categoria: 'PRODUCTO', resultados: [{ id: FILAS[1].id, nombre: FILAS[1].nombre }] },
        { categoria: 'SERVICIO', resultados: [{ id: FILAS[2].id, nombre: FILAS[2].nombre }] },
      ],
    });
    await app.close();
  });

  it('devuelve resultadosPorCategoria vacío si no hay coincidencias', async () => {
    const { db } = escenario([]);
    const app = await crearApp([BusquedaModule], db);
    await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre: 'inexistente' })
      .set('Cookie', COOKIE)
      .expect(200, { resultadosPorCategoria: [] });
    await app.close();
  });

  it.each([undefined, '', '   '])('rechaza una búsqueda ausente o vacía (%s)', async (nombre) => {
    const { db, consultas } = escenario();
    const app = await crearApp([BusquedaModule], db);
    const solicitud = request(app.getHttpServer()).get(RUTA).set('Cookie', COOKIE);
    const respuesta =
      nombre === undefined
        ? await solicitud.expect(400)
        : await solicitud.query({ nombre }).expect(400);

    expect(respuesta.body.errores).toHaveProperty('nombre');
    expect(consultas.some((c) => c.sql.includes('WITH coincidencias AS'))).toBe(false);
    await app.close();
  });

  it('requiere sesión y rol TUTOR', async () => {
    const sinSesion = escenario([], null as never);
    const appSinSesion = await crearApp([BusquedaModule], sinSesion.db);
    await request(appSinSesion.getHttpServer()).get(RUTA).query({ nombre: 'norte' }).expect(401);
    await appSinSesion.close();

    const otroRol = escenario([], ALIADO);
    const appOtroRol = await crearApp([BusquedaModule], otroRol.db);
    await request(appOtroRol.getHttpServer())
      .get(RUTA)
      .query({ nombre: 'norte' })
      .set('Cookie', COOKIE)
      .expect(403);
    await appOtroRol.close();
  });

  it('normaliza la búsqueda en SQL, filtra recursos publicables y limita cada categoría a 10', async () => {
    const { db, consultas } = escenario();
    const app = await crearApp([BusquedaModule], db);
    await request(app.getHttpServer())
      .get(RUTA)
      .query({ nombre: '  Clinica   Norte  ' })
      .set('Cookie', COOKIE)
      .expect(200);

    const consulta = consultas.find((c) => c.sql.includes('WITH coincidencias AS'));
    expect(consulta?.valores).toEqual(['Clinica   Norte', 10]);
    expect(consulta?.sql).toContain('public.unaccent');
    expect(consulta?.sql).toContain("'[[:space:]]+'");
    expect(consulta?.sql).toContain('row_number() OVER (PARTITION BY categoria');
    expect(consulta?.sql).toContain('WHERE posicion <= $2');
    expect(consulta?.sql).toContain("p.moderacion = 'PUBLICADO'");
    expect(consulta?.sql).toContain("s.moderacion = 'PUBLICADO'");
    expect(consulta?.sql).toContain("u.estado = 'ACTIVA'");
    expect(consulta?.sql).not.toContain('mascota_adopcion');
    expect(consulta?.sql).not.toContain('DROP TABLE');
    await app.close();
  });
});
