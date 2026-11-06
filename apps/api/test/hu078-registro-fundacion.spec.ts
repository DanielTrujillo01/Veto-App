import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { verificarContrasena } from '../src/modules/identidad/seguridad';
import {
  ALIADO,
  COOKIE,
  TUTOR,
  crearApp,
  crearBdFalsa,
  errorPg,
  type Manejador,
  type UsuarioPrueba,
} from './utilidades';

const USUARIO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FUNDACION_ID = '77777777-7777-4777-8777-777777777779';
const RUTA = '/api/aliados/fundaciones';

const datos = {
  nombre: 'Fundación Huellas',
  ciudad: 'Cali',
  contacto: 'contacto@huellas.org',
  descripcion: 'Rescate y rehabilitación de animales abandonados',
  ubicacion: 'Calle 5 # 38-10',
  anioFundacion: 2015,
  celular: '3005556677',
  correo: 'Fundacion@Huellas.org',
  contrasena: 'password123',
};

type Fallo = 'correo' | 'check' | undefined;

/** Simula los INSERT del registro; `fallo` reproduce un correo repetido o un CHECK de la base. */
function registroEnBd(fallo?: Fallo): Manejador {
  return (sql, valores) => {
    if (sql.includes('INSERT INTO usuario')) {
      if (fallo === 'correo') throw errorPg('23505');
      const [nombre, celular, correo, , rol] = valores as string[];
      return { rows: [{ id: USUARIO_ID, nombre, celular, correo, rol }] };
    }
    if (sql.includes('INSERT INTO aliado')) {
      if (fallo === 'check') {
        throw Object.assign(new Error('El año de fundación (2999) no puede ser posterior'), {
          code: '23514',
        });
      }
      const [, nombre, ciudad, contacto, descripcion, ubicacion, anio, logo] = valores as [
        string,
        string,
        string,
        string,
        string,
        string,
        number,
        string | null,
      ];
      return {
        rows: [
          {
            id: FUNDACION_ID,
            nombre,
            ciudad,
            contacto,
            descripcion,
            ubicacion,
            anio_fundacion: anio,
            logo_url: logo,
            estado: 'PENDIENTE',
            creado_en: new Date('2026-11-05T00:00:00Z'),
          },
        ],
      };
    }
  };
}

describe('HU-078 · registro de fundación (POST /api/aliados/fundaciones)', () => {
  it('crea la cuenta y la fundación PENDIENTE en una sola transacción', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).post(RUTA).send(datos).expect(201);

    expect(r.body).toEqual({
      usuario: expect.objectContaining({ id: USUARIO_ID, rol: 'ALIADO' }),
      fundacion: {
        id: FUNDACION_ID,
        tipo: 'FUNDACION',
        nombre: 'Fundación Huellas',
        ciudad: 'Cali',
        contacto: 'contacto@huellas.org',
        descripcion: 'Rescate y rehabilitación de animales abandonados',
        ubicacion: 'Calle 5 # 38-10',
        anioFundacion: 2015,
        logoUrl: null,
        estado: 'PENDIENTE',
        creadoEn: '2026-11-05T00:00:00.000Z',
      },
    });
    expect(r.body.usuario).not.toHaveProperty('password_hash');
    const escrituras = consultas.filter((c) => c.sql.startsWith('INSERT'));
    expect(escrituras).toHaveLength(2);
    // Cuenta y fundación comparten la misma transacción (un solo withUser).
    expect(db.withUser).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('el tipo queda FUNDACION aunque el cliente mande otro tipo o estado', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .post(RUTA)
      .send({ ...datos, tipo: 'CLINICA', estado: 'ACTIVO' })
      .expect(201);
    const insert = consultas.find((c) => c.sql.includes('INSERT INTO aliado'));
    expect(insert?.sql).toContain("'FUNDACION'");
    expect(insert?.valores).not.toContain('CLINICA');
    expect(insert?.valores).not.toContain('ACTIVO');
    await app.close();
  });

  it('guarda el logo cuando viene y la contraseña solo como hash', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .post(RUTA)
      .send({ ...datos, logoUrl: 'https://cdn.veto.co/huellas.png' })
      .expect(201);
    expect(r.body.fundacion.logoUrl).toBe('https://cdn.veto.co/huellas.png');

    const usuario = consultas.find((c) => c.sql.includes('INSERT INTO usuario'));
    const [, , correo, hash] = usuario?.valores as string[];
    expect(correo).toBe('fundacion@huellas.org');
    expect(hash).not.toContain('password123');
    expect(await verificarContrasena('password123', hash)).toBe(true);
    await app.close();
  });

  it('el nombre del representante es opcional: si no viene, se usa el de la fundación', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).post(RUTA).send(datos).expect(201);
    await request(app.getHttpServer())
      .post(RUTA)
      .send({ ...datos, correo: 'otro@huellas.org', representante: 'Ana Pérez' })
      .expect(201);
    const cuentas = consultas.filter((c) => c.sql.includes('INSERT INTO usuario'));
    expect(cuentas.map((c) => (c.valores as string[])[0])).toEqual([
      'Fundación Huellas',
      'Ana Pérez',
    ]);
    await app.close();
  });

  it('informa todos los campos con error a la vez, sin tocar la base', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .post(RUTA)
      .send({ ...datos, nombre: '', ciudad: ' ', anioFundacion: 1800, logoUrl: 'javascript:x' })
      .expect(400);
    expect(r.body.message).toBe('Revisa los datos ingresados');
    expect(r.body.errores).toEqual({
      nombre: 'El nombre de la fundación es obligatorio',
      ciudad: 'La ciudad es obligatoria',
      anioFundacion: 'El año de fundación no puede ser anterior a 1900',
      logoUrl: 'La foto debe ser una URL http o https válida',
    });
    expect(consultas.filter((c) => c.sql.startsWith('INSERT'))).toHaveLength(0);
    await app.close();
  });

  it('pide cada campo obligatorio con un mensaje comprensible', async () => {
    const { db } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).post(RUTA).send({}).expect(400);
    expect(r.body.errores).toMatchObject({
      nombre: 'El nombre de la fundación es obligatorio',
      ciudad: 'La ciudad es obligatoria',
      contacto: 'El contacto es obligatorio',
      descripcion: 'La descripción es obligatoria',
      ubicacion: 'La ubicación es obligatoria',
      anioFundacion: 'El año de fundación es obligatorio',
      celular: 'El celular es obligatorio',
      correo: 'El correo es obligatorio',
      contrasena: 'La contraseña es obligatoria',
    });
    expect(r.body.errores).not.toHaveProperty('logoUrl');
    await app.close();
  });

  it('un correo ya registrado responde 409', async () => {
    const { db } = crearBdFalsa(registroEnBd('correo'), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).post(RUTA).send(datos).expect(409);
    expect(r.body.message).toBe('Ya existe una cuenta con ese correo');
    await app.close();
  });

  it('si la base rechaza un dato (CHECK) responde 400 con el motivo', async () => {
    const { db } = crearBdFalsa(registroEnBd('check'), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).post(RUTA).send(datos).expect(400);
    expect(r.body.errores._).toContain('año de fundación');
    await app.close();
  });

  it('no se puede registrar una fundación por el registro general', async () => {
    const { db } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .post('/api/aliados')
      .send({ ...datos, nombre: 'Fundación', tipo: 'FUNDACION' })
      .expect(400);
    await app.close();
  });
});

describe('HU-078 · consulta de los datos guardados (GET /api/aliados/me/fundacion/datos)', () => {
  const FUNDACION: UsuarioPrueba = { ...ALIADO, id: USUARIO_ID, nombre: 'Ana Pérez' };

  function consultaEnBd(usuario: UsuarioPrueba) {
    return crearBdFalsa((sql, valores) => {
      if (sql.includes('FROM aliado a JOIN usuario u') && sql.includes("a.tipo = 'FUNDACION'")) {
        if (valores[0] !== USUARIO_ID) return { rows: [] };
        return {
          rows: [
            {
              id: FUNDACION_ID,
              nombre: 'Fundación Huellas',
              ciudad: 'Cali',
              contacto: 'contacto@huellas.org',
              descripcion: 'Rescate',
              ubicacion: 'Calle 5 # 38-10',
              anio_fundacion: 2015,
              logo_url: null,
              estado: 'PENDIENTE',
              creado_en: new Date('2026-11-05T00:00:00Z'),
              representante: 'Ana Pérez',
              correo: 'fundacion@huellas.org',
              celular: '3005556677',
            },
          ],
        };
      }
    }, usuario);
  }

  it('la fundación ve lo que registró aunque siga pendiente de aprobación', async () => {
    const { db } = consultaEnBd(FUNDACION);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/aliados/me/fundacion/datos')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toEqual({
      fundacion: {
        id: FUNDACION_ID,
        tipo: 'FUNDACION',
        nombre: 'Fundación Huellas',
        ciudad: 'Cali',
        contacto: 'contacto@huellas.org',
        descripcion: 'Rescate',
        ubicacion: 'Calle 5 # 38-10',
        anioFundacion: 2015,
        logoUrl: null,
        estado: 'PENDIENTE',
        creadoEn: '2026-11-05T00:00:00.000Z',
        representante: 'Ana Pérez',
        correo: 'fundacion@huellas.org',
        celular: '3005556677',
      },
    });
    await app.close();
  });

  it('un aliado que no es fundación recibe 404', async () => {
    const { db } = consultaEnBd(ALIADO);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .get('/api/aliados/me/fundacion/datos')
      .set('Cookie', COOKIE)
      .expect(404);
    await app.close();
  });

  it('un tutor recibe 403 y sin sesión 401', async () => {
    const tutor = consultaEnBd(TUTOR);
    const app = await crearApp([AliadosModule], tutor.db);
    await request(app.getHttpServer())
      .get('/api/aliados/me/fundacion/datos')
      .set('Cookie', COOKIE)
      .expect(403);
    await app.close();

    const app2 = await crearApp([AliadosModule], crearBdFalsa(() => undefined, null).db);
    await request(app2.getHttpServer()).get('/api/aliados/me/fundacion/datos').expect(401);
    await app2.close();
  });
});
