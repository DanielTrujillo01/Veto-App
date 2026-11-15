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
  let estado = 'DISPONIBLE';
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
    if (sql.includes('SELECT estado FROM mascota_adopcion')) {
      return { rows: [{ estado }] };
    }
    if (sql.includes('UPDATE mascota_adopcion') && sql.includes('SET estado = $3')) {
      estado = valores[2] as string;
      return {
        rows: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            nombre: 'Nube',
            especie_id: 1,
            edad_meses: 18,
            sexo: 'HEMBRA',
            tamano: 'MEDIANO',
            ubicacion: 'Bogotá norte',
            descripcion: null,
            estado,
            creado_en: new Date('2026-01-03T12:00:00Z'),
          },
        ],
      };
    }
    if (sql.includes('UPDATE mascota_adopcion') && sql.includes('SET nombre = $3')) {
      return {
        rows: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            nombre: valores[2],
            especie_id: valores[3],
            edad_meses: valores[4],
            sexo: valores[5],
            tamano: valores[6],
            ubicacion: valores[7],
            descripcion: valores[8],
            estado,
            creado_en: new Date('2026-01-03T12:00:00Z'),
          },
        ],
      };
    }
    if (sql.includes('FROM mascota_adopcion') && sql.includes('ORDER BY m.creado_en')) {
      return {
        rows: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            nombre: 'Nube',
            especie_id: 1,
            edad_meses: 18,
            sexo: 'HEMBRA',
            tamano: 'MEDIANO',
            ubicacion: 'Bogotá norte',
            descripcion: null,
            estado,
            creado_en: new Date('2026-01-03T12:00:00Z'),
          },
        ],
      };
    }
    if (sql.includes('FROM v_catalogo_adopcion')) {
      if (estado !== 'DISPONIBLE') return { rows: [] };
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

  it('valida el límite de fotos y conserva el orden de las URLs', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdopcionModule], escenario.db);
    const fotos = ['https://cdn.veto.co/nube-1.jpg', 'https://cdn.veto.co/nube-2.jpg'];

    const respuesta = await request(app.getHttpServer())
      .post('/api/adopciones')
      .set('Cookie', COOKIE)
      .send({ ...PUBLICACION, fotos, videoUrl: 'https://cdn.veto.co/nube.mp4' })
      .expect(201);

    expect(respuesta.body.fotos).toEqual(fotos);
    expect(respuesta.body.videoUrl).toBe('https://cdn.veto.co/nube.mp4');

    await request(app.getHttpServer())
      .post('/api/adopciones')
      .set('Cookie', COOKIE)
      .send({
        ...PUBLICACION,
        fotos: Array.from({ length: 11 }, (_, i) => `https://cdn.veto.co/${i}.jpg`),
      })
      .expect(400);
    await app.close();
  });

  it('edita una publicación propia y conserva su estado', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdopcionModule], escenario.db);

    const respuesta = await request(app.getHttpServer())
      .put('/api/adopciones/88888888-8888-4888-8888-888888888888')
      .set('Cookie', COOKIE)
      .send({ ...PUBLICACION, nombre: 'Nube renovada' })
      .expect(200);

    expect(respuesta.body).toMatchObject({ nombre: 'Nube renovada', estado: 'DISPONIBLE' });
    await app.close();
  });

  it('lista las publicaciones propias con su estado actual', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdopcionModule], escenario.db);

    const respuesta = await request(app.getHttpServer())
      .get('/api/adopciones/mis-publicaciones')
      .set('Cookie', COOKIE)
      .expect(200);

    expect(respuesta.body[0]).toMatchObject({ nombre: 'Nube', estado: 'DISPONIBLE' });
    await app.close();
  });

  it.each(['PAUSADA', 'RETIRADA'] as const)(
    'cambia a %s y deja de aparecer en el catálogo',
    async (estado) => {
      const escenario = baseDeDatos();
      const app = await crearApp([AdopcionModule], escenario.db);

      const cambio = await request(app.getHttpServer())
        .patch('/api/adopciones/88888888-8888-4888-8888-888888888888/estado')
        .set('Cookie', COOKIE)
        .send({ estado })
        .expect(200);
      expect(cambio.body.estado).toBe(estado);

      await request(app.getHttpServer()).get('/api/adopciones/catalogo').expect(200);
      expect(
        escenario.consultas.some((consulta) => consulta.sql.includes('FROM v_catalogo_adopcion')),
      ).toBe(true);
      await app.close();
    },
  );

  it('rechaza una transición que rompe el flujo', async () => {
    const escenario = baseDeDatos();
    const app = await crearApp([AdopcionModule], escenario.db);

    await request(app.getHttpServer())
      .patch('/api/adopciones/88888888-8888-4888-8888-888888888888/estado')
      .set('Cookie', COOKIE)
      .send({ estado: 'ADOPTADA' })
      .expect(409);
    await app.close();
  });
});
