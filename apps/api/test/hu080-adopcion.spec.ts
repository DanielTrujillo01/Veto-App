import request from 'supertest';
import { AdopcionModule } from '../src/modules/adopcion/adopcion.module';
import { COOKIE, crearApp, crearBdFalsa, type Fila, type UsuarioPrueba } from './utilidades';

const FUNDACION: UsuarioPrueba = {
  id: 'e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5',
  nombre: 'Fundación Huellas',
  correo: 'fundacion@huellas.org',
  celular: '3005556677',
  rol: 'ALIADO',
};

const PUBLICACION = {
  nombre: 'Nube',
  especieId: 1,
  edadMeses: 18,
  sexo: 'HEMBRA',
  tamano: 'MEDIANO',
  ubicacion: 'Bogotá norte',
  descripcion: 'Cariñosa y tranquila',
} as const;

function baseDeDatos(usuario: UsuarioPrueba = FUNDACION, autorizada = true) {
  const { db, consultas } = crearBdFalsa((sql, valores) => {
    if (sql.includes('FROM aliado') && sql.includes("tipo = 'FUNDACION'")) {
      return autorizada ? { rows: [{ id: '77777777-7777-4777-8777-777777777779' }] } : { rows: [] };
    }
    if (sql.includes('INSERT INTO mascota_adopcion')) {
      return {
        rows: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            nombre: 'Nube',
            ...valores,
            especie_id: 1,
            estado: 'DISPONIBLE',
            creado_en: new Date('2026-01-03T12:00:00Z'),
            descripcion: PUBLICACION.descripcion,
          } as Fila,
        ],
      };
    }
    if (sql.includes('FROM v_catalogo_adopcion')) {
      return {
        rows: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            nombre: 'Nube',
            especie_id: 1,
            especie: 'Perro',
            edad_meses: 18,
            sexo: 'HEMBRA',
            tamano: 'MEDIANO',
            ubicacion: 'Bogotá norte',
            descripcion: null,
          },
        ],
      };
    }
  }, usuario);
  return { db, consultas };
}

describe('HU-080 · publicación de mascotas en adopción', () => {
  it('valida campos, publica como DISPONIBLE y no recibe la fundación del body', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdopcionModule], escenario.db);

    const respuesta = await request(app.getHttpServer())
      .post('/api/adopciones')
      .set('Cookie', COOKIE)
      .send(PUBLICACION)
      .expect(201);

    expect(respuesta.body).toMatchObject({ nombre: 'Nube', estado: 'DISPONIBLE' });
    expect(
      escenario.consultas.find((consulta) => consulta.sql.includes('INSERT INTO mascota_adopcion'))
        ?.valores,
    ).not.toContain('fundacionId');
    await app.close();
  });

  it('rechaza una publicación sin autorización de fundación activa', async () => {
    const escenario = baseDeDatos(FUNDACION, false);
    const app = await crearApp([AdopcionModule], escenario.db);

    await request(app.getHttpServer())
      .post('/api/adopciones')
      .set('Cookie', COOKIE)
      .send(PUBLICACION)
      .expect(403);
    await app.close();
  });

  it('expone el catálogo sin la identidad de la fundación', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdopcionModule], escenario.db);

    const respuesta = await request(app.getHttpServer())
      .get('/api/adopciones/catalogo')
      .expect(200);

    expect(respuesta.body[0]).toEqual(
      expect.objectContaining({ nombre: 'Nube', especie: 'Perro' }),
    );
    expect(respuesta.body[0]).not.toHaveProperty('fundacionId');
    await app.close();
  });
});
