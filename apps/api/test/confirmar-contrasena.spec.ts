import request from 'supertest';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import { hashContrasena, verificarContrasena } from '../src/modules/identidad/seguridad';
import { COOKIE, crearApp, crearBdFalsa, type Manejador } from './utilidades';

/**
 * Paso "Confirma tu contraseña" después de ingresar (pedido del cliente). Las cuentas creadas con
 * Google no tienen contraseña de Veto (`password_hash = 'GOOGLE'`) y la crean en ese paso.
 */
let hash: string;
beforeAll(async () => {
  hash = await hashContrasena('clave-segura-1');
});

function cuenta(passwordHash: () => string, actualizaciones: unknown[][] = []): Manejador {
  return (sql, valores) => {
    if (sql.includes('SELECT correo, rol, password_hash')) {
      return { rows: [{ correo: 'ana@mail.com', rol: 'TUTOR', password_hash: passwordHash() }] };
    }
    if (sql.includes('UPDATE usuario SET password_hash')) {
      actualizaciones.push(valores);
      return { rows: [], rowCount: 1 };
    }
  };
}

describe('confirmar la contraseña al ingresar', () => {
  it('sin sesión responde 401', async () => {
    const { db } = crearBdFalsa(
      cuenta(() => hash),
      null,
    );
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer()).get('/api/identidad/contrasena').expect(401);
    await request(app.getHttpServer())
      .post('/api/identidad/contrasena/confirmar')
      .send({ contrasena: 'x' })
      .expect(401);
    await request(app.getHttpServer())
      .put('/api/identidad/contrasena')
      .send({ contrasena: 'clave-nueva-1' })
      .expect(401);
    await app.close();
  });

  it('dice si la cuenta tiene contraseña', async () => {
    const conClave = crearBdFalsa(cuenta(() => hash));
    const app = await crearApp([IdentidadModule], conClave.db);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/contrasena')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toEqual({ tieneContrasena: true });
    await app.close();

    const google = crearBdFalsa(cuenta(() => 'GOOGLE'));
    const app2 = await crearApp([IdentidadModule], google.db);
    const r2 = await request(app2.getHttpServer())
      .get('/api/identidad/contrasena')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r2.body).toEqual({ tieneContrasena: false });
    await app2.close();
  });

  it('acepta la contraseña correcta y rechaza la incorrecta', async () => {
    const { db } = crearBdFalsa(cuenta(() => hash));
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .post('/api/identidad/contrasena/confirmar')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'clave-segura-1' })
      .expect(200, { ok: true });
    await request(app.getHttpServer())
      .post('/api/identidad/contrasena/confirmar')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'otra-clave' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/identidad/contrasena/confirmar')
      .set('Cookie', COOKIE)
      .send({})
      .expect(400);
    await app.close();
  });

  it('una cuenta de Google no puede confirmar: primero crea su contraseña', async () => {
    const { db } = crearBdFalsa(cuenta(() => 'GOOGLE'));
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .post('/api/identidad/contrasena/confirmar')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'cualquiera' })
      .expect(409);
    await app.close();
  });

  it('una cuenta de Google crea su contraseña (guardada cifrada)', async () => {
    let actual = 'GOOGLE';
    const actualizaciones: unknown[][] = [];
    const { db } = crearBdFalsa(cuenta(() => actual, actualizaciones));
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .put('/api/identidad/contrasena')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'clave-nueva-1' })
      .expect(200, { ok: true });

    expect(actualizaciones).toHaveLength(1);
    const guardado = actualizaciones[0][1] as string;
    expect(guardado).not.toBe('clave-nueva-1');
    expect(await verificarContrasena('clave-nueva-1', guardado)).toBe(true);

    // Ya con contraseña, no se puede volver a "crear"
    actual = guardado;
    await request(app.getHttpServer())
      .put('/api/identidad/contrasena')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'otra-clave-2' })
      .expect(409);
    await app.close();
  });

  it('la contraseña nueva debe tener al menos 8 caracteres', async () => {
    const { db } = crearBdFalsa(cuenta(() => 'GOOGLE'));
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .put('/api/identidad/contrasena')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'corta' })
      .expect(400);
    await app.close();
  });
});
