import request from 'supertest';
import { MascotasModule } from '../src/modules/mascotas/mascotas.module';
import {
  ALIADO,
  COOKIE,
  TUTOR,
  crearApp,
  crearBdFalsa,
  errorPg,
  type Manejador,
} from './utilidades';

const MASCOTA_ID = '55555555-5555-4555-8555-555555555555';
const AJENA_ID = '66666666-6666-4666-8666-666666666666';

const fila = {
  id: MASCOTA_ID,
  nombre: 'Firulais',
  especie_id: 1,
  especie: 'Perro',
  sexo: 'MACHO',
  raza: null,
  fecha_nacimiento: null,
  edad_meses: null,
  color: null,
  peso_kg: null,
  chip: null,
  fotos: [],
  creado_en: new Date('2026-01-01T00:00:00Z'),
};

/** Simula la tabla mascota: MASCOTA_ID pertenece a TUTOR; AJENA_ID es de otro tutor. */
function mascotasEnBd(extra: Manejador = () => undefined): Manejador {
  return (sql, valores) => {
    const r = extra(sql, valores);
    if (r) return r;
    if (sql.includes('INSERT INTO mascota\n')) return { rows: [{ id: MASCOTA_ID }] };
    if (sql.includes('UPDATE mascota')) {
      return { rows: [], rowCount: valores[0] === MASCOTA_ID && valores[1] === TUTOR.id ? 1 : 0 };
    }
    if (sql.includes('FROM mascota m')) {
      if (sql.includes('m.id = $1')) {
        return { rows: valores[0] === MASCOTA_ID && valores[1] === TUTOR.id ? [fila] : [] };
      }
      return { rows: valores[0] === TUTOR.id ? [fila] : [] };
    }
  };
}

const minimos = { nombre: 'Firulais', especieId: 1, sexo: 'MACHO' };

describe('HU-008 · crear perfil de mascota', () => {
  it('crea la mascota solo con los obligatorios, asociada al tutor de la sesión', async () => {
    const { db, consultas } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    const r = await request(app.getHttpServer())
      .post('/api/mascotas')
      .set('Cookie', COOKIE)
      .send({ ...minimos, tutorId: 'otro-tutor' })
      .expect(201);
    expect(r.body).toMatchObject({
      id: MASCOTA_ID,
      nombre: 'Firulais',
      especie: 'Perro',
      fotos: [],
    });
    const insert = consultas.find((c) => c.sql.includes('INSERT INTO mascota\n'));
    expect(insert?.valores[0]).toBe(TUTOR.id);
    expect(insert?.usuarioTx).toBe(TUTOR.id);
    expect(insert?.valores.slice(4)).toEqual([null, null, null, null, null, null]);
    await app.close();
  });

  it('guarda las fotos opcionales', async () => {
    const { db, consultas } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    await request(app.getHttpServer())
      .post('/api/mascotas')
      .set('Cookie', COOKIE)
      .send({ ...minimos, fotos: ['https://fotos.veto.co/a.jpg', 'https://fotos.veto.co/b.jpg'] })
      .expect(201);
    expect(consultas.filter((c) => c.sql.includes('INSERT INTO mascota_foto'))).toHaveLength(2);
    await app.close();
  });

  it.each([
    ['sin sexo', { nombre: 'X', especieId: 1 }, 'sexo'],
    ['sin nombre', { especieId: 1, sexo: 'HEMBRA' }, 'nombre'],
    ['sin especie', { nombre: 'X', sexo: 'HEMBRA' }, 'especieId'],
    ['peso negativo', { ...minimos, pesoKg: -2 }, 'pesoKg'],
  ])('rechaza datos inválidos: %s', async (_caso, body, campo) => {
    const { db, consultas } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    const r = await request(app.getHttpServer())
      .post('/api/mascotas')
      .set('Cookie', COOKIE)
      .send(body)
      .expect(400);
    expect(r.body.errores).toHaveProperty(campo);
    expect(consultas.some((c) => c.sql.includes('INSERT'))).toBe(false);
    await app.close();
  });

  it('una especie inexistente responde 400 y un chip repetido 409', async () => {
    let codigo = '23503';
    const { db } = crearBdFalsa(
      mascotasEnBd((sql) => {
        if (sql.includes('INSERT INTO mascota\n')) throw errorPg(codigo);
      }),
    );
    const app = await crearApp([MascotasModule], db);
    const r = await request(app.getHttpServer())
      .post('/api/mascotas')
      .set('Cookie', COOKIE)
      .send({ ...minimos, especieId: 99 })
      .expect(400);
    expect(r.body.errores).toHaveProperty('especieId');
    codigo = '23505';
    await request(app.getHttpServer())
      .post('/api/mascotas')
      .set('Cookie', COOKIE)
      .send({ ...minimos, chip: 'ABC123' })
      .expect(409);
    await app.close();
  });

  it('exige sesión y rol de tutor', async () => {
    const sinSesion = await crearApp([MascotasModule], crearBdFalsa(mascotasEnBd(), null).db);
    await request(sinSesion.getHttpServer()).post('/api/mascotas').send(minimos).expect(401);
    await sinSesion.close();

    const aliado = await crearApp([MascotasModule], crearBdFalsa(mascotasEnBd(), ALIADO).db);
    await request(aliado.getHttpServer())
      .post('/api/mascotas')
      .set('Cookie', COOKIE)
      .send(minimos)
      .expect(403);
    await request(aliado.getHttpServer())
      .get(`/api/mascotas/${MASCOTA_ID}`)
      .set('Cookie', COOKIE)
      .expect(403);
    await aliado.close();
  });

  it('el tutor consulta sus mascotas, pero no las de otro tutor', async () => {
    const { db } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    const lista = await request(app.getHttpServer())
      .get('/api/mascotas')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(lista.body).toHaveLength(1);
    await request(app.getHttpServer())
      .get(`/api/mascotas/${MASCOTA_ID}`)
      .set('Cookie', COOKIE)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/mascotas/${AJENA_ID}`)
      .set('Cookie', COOKIE)
      .expect(404);
    await app.close();
  });

  it('el catálogo de especies es público', async () => {
    const { db } = crearBdFalsa(() => ({ rows: [{ id: 1, nombre: 'Perro' }] }), null);
    const app = await crearApp([MascotasModule], db);
    const r = await request(app.getHttpServer()).get('/api/mascotas/especies').expect(200);
    expect(r.body).toEqual([{ id: 1, nombre: 'Perro' }]);
    await app.close();
  });
});

describe('HU-010 · editar mascota', () => {
  it('el tutor dueño guarda los cambios y los ve en la respuesta', async () => {
    const { db, consultas } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    await request(app.getHttpServer())
      .put(`/api/mascotas/${MASCOTA_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...minimos, nombre: 'Firu', pesoKg: 30, fotos: ['https://fotos.veto.co/n.jpg'] })
      .expect(200);
    const update = consultas.find((c) => c.sql.includes('UPDATE mascota'));
    expect(update?.valores.slice(0, 3)).toEqual([MASCOTA_ID, TUTOR.id, 'Firu']);
    expect(update?.usuarioTx).toBe(TUTOR.id);
    expect(consultas.some((c) => c.sql.includes('DELETE FROM mascota_foto'))).toBe(true);
    await app.close();
  });

  it('aplica las mismas validaciones de la creación', async () => {
    const { db, consultas } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    const r = await request(app.getHttpServer())
      .put(`/api/mascotas/${MASCOTA_ID}`)
      .set('Cookie', COOKIE)
      .send({ nombre: 'Firu', especieId: 1, sexo: 'OTRO', fechaNacimiento: '2999-01-01' })
      .expect(400);
    expect(Object.keys(r.body.errores)).toEqual(expect.arrayContaining(['sexo']));
    expect(consultas.some((c) => c.sql.includes('UPDATE mascota'))).toBe(false);
    await app.close();
  });

  it('no permite editar la mascota de otro tutor', async () => {
    const { db, consultas } = crearBdFalsa(mascotasEnBd());
    const app = await crearApp([MascotasModule], db);
    await request(app.getHttpServer())
      .put(`/api/mascotas/${AJENA_ID}`)
      .set('Cookie', COOKIE)
      .send(minimos)
      .expect(404);
    expect(consultas.some((c) => c.sql.includes('mascota_foto'))).toBe(false);
    await app.close();
  });

  it('un chip ya usado por otra mascota responde 409', async () => {
    const { db } = crearBdFalsa(
      mascotasEnBd((sql) => {
        if (sql.includes('UPDATE mascota')) throw errorPg('23505');
      }),
    );
    const app = await crearApp([MascotasModule], db);
    await request(app.getHttpServer())
      .put(`/api/mascotas/${MASCOTA_ID}`)
      .set('Cookie', COOKIE)
      .send({ ...minimos, chip: 'REPETIDO' })
      .expect(409);
    await app.close();
  });
});
