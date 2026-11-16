import request from 'supertest';
import { AdopcionModule } from '../src/modules/adopcion/adopcion.module';
import { crearApp, crearBdFalsa, type Fila } from './utilidades';

const PUBLICACIONES: Fila[] = [
  {
    id: '88888888-8888-4888-8888-888888888801',
    nombre: 'Nube',
    especie_id: 1,
    especie: 'Perro',
    edad_meses: 8,
    sexo: 'HEMBRA',
    tamano: 'MEDIANO',
    ubicacion: 'Bogotá',
    descripcion: null,
    fotos: [],
    video_url: null,
  },
  {
    id: '88888888-8888-4888-8888-888888888802',
    nombre: 'Copo',
    especie_id: 2,
    especie: 'Gato',
    edad_meses: 5,
    sexo: 'MACHO',
    tamano: 'PEQUENO',
    ubicacion: 'Bogotá',
    descripcion: null,
    fotos: [],
    video_url: null,
  },
  {
    id: '88888888-8888-4888-8888-888888888803',
    nombre: 'Luna',
    especie_id: 1,
    especie: 'Perro',
    edad_meses: 18,
    sexo: 'HEMBRA',
    tamano: 'GRANDE',
    ubicacion: 'Bogotá norte',
    descripcion: null,
    fotos: [],
    video_url: null,
  },
  {
    id: '88888888-8888-4888-8888-888888888804',
    nombre: 'Tango',
    especie_id: 1,
    especie: 'Perro',
    edad_meses: 19,
    sexo: 'MACHO',
    tamano: 'MEDIANO',
    ubicacion: 'Medellín',
    descripcion: null,
    fotos: [],
    video_url: null,
  },
];

function respuestaCatalogo(sql: string, valores: unknown[]) {
  const parametro = (columna: string, operador: string) => {
    const match = new RegExp(`${columna} ${operador} \\$([0-9]+)`).exec(sql);
    return match ? valores[Number(match[1]) - 1] : undefined;
  };
  const especie = parametro('especie_id', '=');
  const edadMin = parametro('edad_meses', '>=');
  const edadMax = parametro('edad_meses', '<=');
  const tamano = parametro('tamano', '=');
  const ubicacion = parametro('ubicacion', '=');
  return PUBLICACIONES.filter(
    (p) =>
      (especie === undefined || p.especie_id === especie) &&
      (edadMin === undefined || Number(p.edad_meses) >= Number(edadMin)) &&
      (edadMax === undefined || Number(p.edad_meses) <= Number(edadMax)) &&
      (tamano === undefined || p.tamano === tamano) &&
      (ubicacion === undefined || p.ubicacion === ubicacion),
  );
}

function bd() {
  return crearBdFalsa(
    (sql, valores) =>
      sql.includes('FROM v_catalogo_adopcion')
        ? { rows: respuestaCatalogo(sql, valores) }
        : { rows: [] },
    null,
  );
}

describe('HU-088 · filtros del catálogo público de adopción', () => {
  it('conserva el catálogo sin filtros, su orden y la respuesta anónima', async () => {
    const escenario = bd();
    const app = await crearApp([AdopcionModule], escenario.db);
    const respuesta = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .expect(200);

    expect(respuesta.body).toHaveLength(4);
    expect(respuesta.body[0]).toMatchObject({ nombre: 'Nube', especieId: 1, ubicacion: 'Bogotá' });
    expect(respuesta.body[0]).not.toHaveProperty('fundacionId');
    const consulta = escenario.consultas.find((item) =>
      item.sql.includes('FROM v_catalogo_adopcion'),
    );
    expect(consulta?.sql).toContain('ORDER BY id');
    expect(consulta?.sql).not.toContain(' WHERE ');
    expect(consulta?.valores).toEqual([]);
    await app.close();
  });

  it('filtra por especie, tamaño y ubicación con igualdad textual exacta', async () => {
    const escenario = bd();
    const app = await crearApp([AdopcionModule], escenario.db);

    const especie = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?especieId=2')
      .expect(200);
    expect(especie.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Copo']);

    const tamano = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?tamano=MEDIANO')
      .expect(200);
    expect(tamano.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Nube', 'Tango']);

    const ubicacion = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .query({ ubicacion: 'Bogotá' })
      .expect(200);
    expect(ubicacion.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Nube', 'Copo']);

    const ubicacionParcial = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .query({ ubicacion: 'Bogot' })
      .expect(200, []);
    expect(ubicacionParcial.body).toEqual([]);
    const consultaUbicacion = escenario.consultas.find(
      (item) => item.sql.includes('FROM v_catalogo_adopcion') && item.valores[0] === 'Bogotá',
    );
    expect(consultaUbicacion?.sql).toContain('ubicacion = $1');
    expect(consultaUbicacion?.sql).not.toContain('LIKE');
    await app.close();
  });

  it('aplica límites de edad inclusivos y permite cualquiera de los dos límites', async () => {
    const app = await crearApp([AdopcionModule], bd().db);

    const minimo = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?edadMinMeses=18')
      .expect(200);
    expect(minimo.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Luna', 'Tango']);

    const maximo = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?edadMaxMeses=8')
      .expect(200);
    expect(maximo.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Nube', 'Copo']);

    const rango = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?edadMinMeses=8&edadMaxMeses=18')
      .expect(200);
    expect(rango.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Nube', 'Luna']);
    await app.close();
  });

  it('combina los filtros con AND y permite omitir criterios', async () => {
    const escenario = bd();
    const app = await crearApp([AdopcionModule], escenario.db);
    const filtrado = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .query({
        especieId: 1,
        edadMinMeses: 8,
        edadMaxMeses: 8,
        tamano: 'MEDIANO',
        ubicacion: 'Bogotá',
      })
      .expect(200);

    expect(filtrado.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Nube']);
    const consulta = escenario.consultas.find((item) =>
      item.sql.includes('FROM v_catalogo_adopcion'),
    );
    expect(consulta?.sql).toContain('especie_id = $1');
    expect(consulta?.sql).toContain('edad_meses >= $2');
    expect(consulta?.sql).toContain('edad_meses <= $3');
    expect(consulta?.sql).toContain('tamano = $4');
    expect(consulta?.sql).toContain('ubicacion = $5');
    expect(consulta?.sql.match(/ AND /g)).toHaveLength(4);
    expect(consulta?.valores).toEqual([1, 8, 8, 'MEDIANO', 'Bogotá']);

    const sinTamano = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?especieId=1&ubicacion=Bogot%C3%A1')
      .expect(200);
    expect(sinTamano.body.map((item: { nombre: string }) => item.nombre)).toEqual(['Nube']);
    await app.close();
  });

  it.each([
    ['especieId', 'abc'],
    ['especieId', '0'],
    ['especieId', '32768'],
    ['edadMinMeses', '-1'],
    ['edadMinMeses', '1.5'],
    ['edadMaxMeses', ''],
    ['edadMaxMeses', '32768'],
  ])('rechaza %s=%s con 400', async (parametro, valor) => {
    const app = await crearApp([AdopcionModule], bd().db);
    await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .query({ [parametro]: valor })
      .expect(400);
    await app.close();
  });

  it('rechaza tamaño, ubicación y rango inválidos con 400', async () => {
    const app = await crearApp([AdopcionModule], bd().db);
    await request(app.getHttpServer()).get('/api/adopciones/catalogo?tamano=GIGANTE').expect(400);
    await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?edadMinMeses=9&edadMaxMeses=8')
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .query({ ubicacion: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .query({ ubicacion: 'x'.repeat(161) })
      .expect(400);
    await app.close();
  });

  it('responde 200 [] sin coincidencias y 500 si falla la lectura del catálogo', async () => {
    const escenario = bd();
    const app = await crearApp([AdopcionModule], escenario.db);
    const respuesta = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo?especieId=2&tamano=GRANDE')
      .expect(200, []);
    expect(respuesta.body).toEqual([]);
    await app.close();

    const dbError = crearBdFalsa((sql) => {
      if (sql.includes('FROM v_catalogo_adopcion')) throw new Error('fallo de base de datos');
      return { rows: [] };
    }, null).db;
    const appError = await crearApp([AdopcionModule], dbError);
    await request(appError.getHttpServer())
      .get('/api/adopciones/catalogo?tamano=MEDIANO')
      .expect(500);
    await appError.close();
  });
});
