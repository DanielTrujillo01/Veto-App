import request from 'supertest';
import { AliadosModule } from '../src/modules/aliados/aliados.module';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import { ServiciosModule } from '../src/modules/servicios/servicios.module';
import { verificarContrasena } from '../src/modules/identidad/seguridad';
import { ALIADO, COOKIE, crearApp, crearBdFalsa, errorPg, type Manejador } from './utilidades';

const USUARIO_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ALIADO_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const VET = '44444444-4444-4444-8444-444444444444';

/** Simula los INSERT del registro; `repetido` hace fallar el correo con 23505. */
function registroEnBd(repetido = false): Manejador {
  return (sql, valores) => {
    if (sql.includes('INSERT INTO usuario')) {
      if (repetido) throw errorPg('23505');
      const [nombre, celular, correo, , rol] = valores as string[];
      return { rows: [{ id: USUARIO_ID, nombre, celular, correo, rol }] };
    }
    if (sql.includes('INSERT INTO aliado')) {
      const [, tipo, nombre, descripcion, contacto, , ciudad, ubicacion] = valores as (
        string | null
      )[];
      return {
        rows: [
          {
            id: ALIADO_ID,
            tipo,
            nombre,
            descripcion,
            contacto,
            estado: 'ACTIVO',
            creado_en: new Date('2026-11-05T00:00:00Z'),
            ciudad,
            ubicacion,
          },
        ],
      };
    }
    if (sql.includes('INSERT INTO veterinario')) {
      return {
        rows: [
          {
            id: VET,
            usuario_id: USUARIO_ID,
            aliado_id: ALIADO_ID,
            foto_url: null,
            descripcion: null,
          },
        ],
      };
    }
  };
}

const tutor = {
  nombre: 'Daniel Prueba',
  celular: '3000000000',
  correo: 'Daniel@Example.com',
  contrasena: 'password123',
};

describe('HU-001 · registro de tutor (POST /api/usuarios)', () => {
  it('crea la cuenta con la contraseña hasheada y responde { usuario } sin el hash', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer()).post('/api/usuarios').send(tutor).expect(201);

    expect(r.body).toEqual({
      usuario: {
        id: USUARIO_ID,
        nombre: 'Daniel Prueba',
        celular: '3000000000',
        correo: 'daniel@example.com',
        rol: 'TUTOR',
      },
    });
    const insert = consultas.find((c) => c.sql.includes('INSERT INTO usuario'));
    const hash = insert?.valores[3] as string;
    expect(hash).toMatch(/^scrypt\$/);
    await expect(verificarContrasena('password123', hash)).resolves.toBe(true);
    expect(JSON.stringify(r.body)).not.toContain('scrypt');
    await app.close();
  });

  it('responde 400 con el detalle por campo, como el resto de la API', async () => {
    const { db } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .post('/api/usuarios')
      .send({ nombre: '', celular: '123', correo: 'x', password: 'password123' })
      .expect(400);
    expect(r.body.message).toBe('Revisa los datos ingresados');
    expect(Object.keys(r.body.errores)).toEqual(
      expect.arrayContaining(['nombre', 'celular', 'correo', 'contrasena']),
    );
    await app.close();
  });

  it('un correo ya registrado responde 409', async () => {
    const { db } = crearBdFalsa(registroEnBd(true), null);
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer()).post('/api/usuarios').send(tutor).expect(409);
    expect(r.body.message).toBe('Ya existe una cuenta con ese correo');
    await app.close();
  });
});

describe('HU-007 · registro de aliado (POST /api/aliados)', () => {
  const clinica = {
    ...tutor,
    nombreAliado: 'Clínica Daniel',
    tipo: 'CLINICA',
    ciudad: 'Cali',
    ubicacion: 'Carrera 100 # 15-20',
  };

  it('crea cuenta y aliado en una transacción y responde en camelCase', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer()).post('/api/aliados').send(clinica).expect(201);

    expect(r.body).toEqual({
      usuario: expect.objectContaining({
        id: USUARIO_ID,
        rol: 'ALIADO',
      }),
      aliado: {
        id: ALIADO_ID,
        tipo: 'CLINICA',
        nombre: 'Clínica Daniel',
        descripcion: null,
        contacto: null,
        ciudad: 'Cali',
        ubicacion: 'Carrera 100 # 15-20',
        estado: 'ACTIVO',
        creadoEn: '2026-11-05T00:00:00.000Z',
      },
    });
    const insercionAliado = consultas.find((c) => c.sql.includes('INSERT INTO aliado'));
    expect(insercionAliado?.valores).toEqual([
      USUARIO_ID,
      'CLINICA',
      'Clínica Daniel',
      null,
      null,
      'ACTIVO',
      'Cali',
      'Carrera 100 # 15-20',
    ]);
    expect(consultas.some((c) => c.sql.includes('INSERT INTO veterinario'))).toBe(false);
    await app.close();
  });

  it('un veterinario independiente recibe también su perfil de veterinario', async () => {
    const { db, consultas } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .post('/api/aliados')
      .send({ ...clinica, tipo: 'VET_INDEPENDIENTE' })
      .expect(201);
    const vet = consultas.find((c) => c.sql.includes('INSERT INTO veterinario'));
    expect(vet?.valores).toEqual([ALIADO_ID, USUARIO_ID]);
    await app.close();
  });

  it('rechaza el alias password cuando falta contrasena', async () => {
    const { db } = crearBdFalsa(registroEnBd(), null);
    const app = await crearApp([AliadosModule], db);
    const { contrasena: _c, ...sinContrasena } = clinica;
    const r2 = await request(app.getHttpServer())
      .post('/api/aliados')
      .send({ ...sinContrasena, password: 'password123' })
      .expect(400);
    expect(r2.body.errores).toHaveProperty('contrasena');
    await app.close();
  });

  it('un correo ya registrado responde 409', async () => {
    const { db } = crearBdFalsa(registroEnBd(true), null);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer()).post('/api/aliados').send(clinica).expect(409);
    await app.close();
  });
});

describe('HU-012 · la clínica crea veterinarios con el módulo identidad', () => {
  const vet = { ...tutor, correo: 'vet@example.com' };
  const clinicaActiva: Manejador = (sql, valores) => {
    if (sql.includes('FROM aliado a') && sql.includes('JOIN usuario u')) {
      return {
        rows: [
          {
            tipo: 'CLINICA',
            usuario_id: ALIADO.id,
            estado: 'ACTIVO',
            rol: 'ALIADO',
            estado_cuenta: 'ACTIVA',
          },
        ],
      };
    }
    return registroEnBd()(sql, valores);
  };

  it('crea la cuenta con rol VETERINARIO en la misma transacción', async () => {
    const { db, consultas } = crearBdFalsa(clinicaActiva, ALIADO);
    const app = await crearApp([AliadosModule], db);
    await request(app.getHttpServer())
      .post(`/api/aliados/${ALIADO_ID}/veterinarios`)
      .set('Cookie', COOKIE)
      .send(vet)
      .expect(201);
    const insert = consultas.find((c) => c.sql.includes('INSERT INTO usuario'));
    expect(insert?.valores[4]).toBe('VETERINARIO');
    expect(insert?.usuarioTx).toBe(ALIADO.id);
    await app.close();
  });

  it('valida con el formato { errores }', async () => {
    const { db } = crearBdFalsa(clinicaActiva, ALIADO);
    const app = await crearApp([AliadosModule], db);
    const r = await request(app.getHttpServer())
      .post(`/api/aliados/${ALIADO_ID}/veterinarios`)
      .set('Cookie', COOKIE)
      .send({ ...vet, celular: '1' })
      .expect(400);
    expect(r.body.errores).toHaveProperty('celular');
    await app.close();
  });
});

describe('HU-016 · horarios validan con el formato { errores }', () => {
  it('una franja inválida responde 400 sin tocar la base', async () => {
    const { db, consultas } = crearBdFalsa(() => undefined, ALIADO);
    const app = await crearApp([ServiciosModule], db);
    const r = await request(app.getHttpServer())
      .put(`/api/aliados/${ALIADO_ID}/veterinarios/${VET}/horarios`)
      .set('Cookie', COOKIE)
      .send({ horarios: [{ diaSemana: 9, horaInicio: '10:00', horaFin: '08:00' }] })
      .expect(400);
    expect(r.body.errores).toBeDefined();
    expect(consultas.some((c) => c.sql.includes('horario'))).toBe(false);
    await app.close();
  });
});
