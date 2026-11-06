import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MascotasModule } from '../src/modules/mascotas/mascotas.module';
import {
  COOKIE,
  TUTOR,
  crearApp,
  crearBdFalsa,
  errorPg,
  type Manejador,
  type UsuarioPrueba,
} from './utilidades';

const OTRO_TUTOR: UsuarioPrueba = {
  ...TUTOR,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  nombre: 'Otro Tutor',
  correo: 'otro@mail.com',
};

type MascotaGuardada = {
  id: string;
  tutor_id: string;
  nombre: string;
  especie_id: number;
  sexo: string;
  raza: string | null;
  fecha_nacimiento: string | null;
  edad_meses: number | null;
  color: string | null;
  peso_kg: number | null;
  chip: string | null;
  creado_en: Date;
};

/**
 * Tablas mascota y mascota_foto en memoria: interpreta las consultas del MascotasRepository
 * para comprobar el comportamiento de punta a punta (varios registros, filtros por tutor).
 */
function tablasEnMemoria() {
  const mascotas: MascotaGuardada[] = [];
  const fotos: { mascota_id: string; url: string }[] = [];
  let reloj = Date.parse('2026-01-01T00:00:00Z');

  const aFila = (m: MascotaGuardada) => ({
    ...m,
    especie: m.especie_id === 1 ? 'Perro' : 'Gato',
    fotos: fotos
      .filter((f) => f.mascota_id === m.id)
      .map((f) => f.url)
      .sort(),
  });

  const manejador: Manejador = (sql, v) => {
    if (sql.includes('INSERT INTO mascota\n')) {
      const [tutor, nombre, especie, sexo, raza, fecha, edad, color, peso, chip] = v as never[];
      if (chip && mascotas.some((m) => m.chip === chip)) throw errorPg('23505');
      const fila: MascotaGuardada = {
        id: randomUUID(),
        tutor_id: tutor,
        nombre,
        especie_id: especie,
        sexo,
        raza,
        fecha_nacimiento: fecha,
        edad_meses: edad,
        color,
        peso_kg: peso,
        chip,
        creado_en: new Date((reloj += 1000)),
      };
      mascotas.push(fila);
      return { rows: [{ id: fila.id }] };
    }
    if (sql.includes('UPDATE mascota')) {
      const [id, tutor, nombre, especie, sexo, raza, fecha, edad, color, peso, chip] = v as never[];
      const fila = mascotas.find((m) => m.id === id && m.tutor_id === tutor);
      if (!fila) return { rows: [], rowCount: 0 };
      if (chip && mascotas.some((m) => m.chip === chip && m.id !== id)) throw errorPg('23505');
      Object.assign(fila, {
        nombre,
        especie_id: especie,
        sexo,
        raza,
        fecha_nacimiento: fecha,
        edad_meses: edad,
        color,
        peso_kg: peso,
        chip,
      });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('DELETE FROM mascota_foto')) {
      for (let i = fotos.length - 1; i >= 0; i--)
        if (fotos[i].mascota_id === v[0]) fotos.splice(i, 1);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO mascota_foto')) {
      fotos.push({ mascota_id: v[0] as string, url: v[1] as string });
      return { rows: [] };
    }
    if (sql.includes('FROM mascota m')) {
      if (sql.includes('m.id = $1')) {
        return { rows: mascotas.filter((m) => m.id === v[0] && m.tutor_id === v[1]).map(aFila) };
      }
      return { rows: mascotas.filter((m) => m.tutor_id === v[0]).map(aFila) };
    }
  };
  return { manejador, mascotas, fotos };
}

describe('HU-009 · un tutor registra varias mascotas', () => {
  let tablas: ReturnType<typeof tablasEnMemoria>;
  let app: INestApplication;
  let appOtro: INestApplication;

  beforeEach(async () => {
    tablas = tablasEnMemoria();
    app = await crearApp([MascotasModule], crearBdFalsa(tablas.manejador, TUTOR).db);
    appOtro = await crearApp([MascotasModule], crearBdFalsa(tablas.manejador, OTRO_TUTOR).db);
  });

  afterEach(async () => {
    await app.close();
    await appOtro.close();
  });

  const crear = (body: object, servidor = app) =>
    request(servidor.getHttpServer()).post('/api/mascotas').set('Cookie', COOKIE).send(body);
  const listar = (servidor = app) =>
    request(servidor.getHttpServer()).get('/api/mascotas').set('Cookie', COOKIE).expect(200);

  it('crea varias mascotas como registros independientes y las lista todas', async () => {
    const a = await crear({ nombre: 'Firulais', especieId: 1, sexo: 'MACHO' }).expect(201);
    const b = await crear({ nombre: 'Misu', especieId: 2, sexo: 'HEMBRA', chip: 'CHIP-2' }).expect(
      201,
    );
    // El mismo nombre en otra mascota también es un registro aparte.
    const c = await crear({ nombre: 'Firulais', especieId: 1, sexo: 'HEMBRA' }).expect(201);

    expect(new Set([a.body.id, b.body.id, c.body.id]).size).toBe(3);
    const lista = await listar();
    expect(lista.body.map((m: { id: string }) => m.id)).toEqual([a.body.id, b.body.id, c.body.id]);
    expect(tablas.mascotas.every((m) => m.tutor_id === TUTOR.id)).toBe(true);
  });

  it('editar una mascota no sobrescribe los datos ni las fotos de las demás', async () => {
    const a = await crear({
      nombre: 'Firulais',
      especieId: 1,
      sexo: 'MACHO',
      pesoKg: 20,
      fotos: ['https://fotos.veto.co/a.jpg'],
    }).expect(201);
    const b = await crear({
      nombre: 'Misu',
      especieId: 2,
      sexo: 'HEMBRA',
      color: 'Gris',
      fotos: ['https://fotos.veto.co/b.jpg'],
    }).expect(201);
    const antesB = (await listar()).body[1];

    await request(app.getHttpServer())
      .put(`/api/mascotas/${a.body.id}`)
      .set('Cookie', COOKIE)
      .send({
        nombre: 'Firu',
        especieId: 1,
        sexo: 'MACHO',
        pesoKg: 22,
        fotos: ['https://fotos.veto.co/a2.jpg'],
      })
      .expect(200);

    const [despuesA, despuesB] = (await listar()).body;
    expect(despuesA).toMatchObject({
      nombre: 'Firu',
      pesoKg: 22,
      fotos: ['https://fotos.veto.co/a2.jpg'],
    });
    expect(despuesB).toEqual(antesB);
    expect(despuesB.id).toBe(b.body.id);
  });

  it('crear una mascota nueva no modifica las existentes', async () => {
    const a = await crear({
      nombre: 'Firulais',
      especieId: 1,
      sexo: 'MACHO',
      raza: 'Criollo',
    }).expect(201);
    const antes = (await listar()).body[0];
    await crear({ nombre: 'Luna', especieId: 1, sexo: 'HEMBRA', raza: 'Labrador' }).expect(201);
    const lista = (await listar()).body;
    expect(lista).toHaveLength(2);
    expect(lista.find((m: { id: string }) => m.id === a.body.id)).toEqual(antes);
  });

  it('el listado de cada tutor solo contiene sus mascotas', async () => {
    await crear({ nombre: 'Firulais', especieId: 1, sexo: 'MACHO' }).expect(201);
    await crear({ nombre: 'Misu', especieId: 2, sexo: 'HEMBRA' }).expect(201);
    const ajena = await crear({ nombre: 'Rocky', especieId: 1, sexo: 'MACHO' }, appOtro).expect(
      201,
    );

    expect((await listar()).body.map((m: { nombre: string }) => m.nombre)).toEqual([
      'Firulais',
      'Misu',
    ]);
    expect((await listar(appOtro)).body).toHaveLength(1);
    await request(app.getHttpServer())
      .put(`/api/mascotas/${ajena.body.id}`)
      .set('Cookie', COOKIE)
      .send({ nombre: 'Robado', especieId: 1, sexo: 'MACHO' })
      .expect(404);
    expect(tablas.mascotas.find((m) => m.id === ajena.body.id)?.nombre).toBe('Rocky');
  });

  it('un error al crear una mascota no afecta a las ya registradas', async () => {
    await crear({ nombre: 'Firulais', especieId: 1, sexo: 'MACHO', chip: 'CHIP-1' }).expect(201);
    await crear({ nombre: 'Copia', especieId: 1, sexo: 'MACHO', chip: 'CHIP-1' }).expect(409);
    const lista = (await listar()).body;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ nombre: 'Firulais', chip: 'CHIP-1' });
  });
});
