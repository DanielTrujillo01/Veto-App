import request from 'supertest';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import { hashContrasena } from '../src/modules/identidad/seguridad';
import {
  ALIADO,
  COOKIE,
  TUTOR,
  crearApp,
  crearBdFalsa,
  errorPg,
  type Manejador,
} from './utilidades';

let hash: string;
beforeAll(async () => {
  hash = await hashContrasena('clave-segura-1');
});

/** Simula la tabla usuario con un único registro. */
function usuarioEnBd(usuario = TUTOR, extra: Manejador = () => undefined): Manejador {
  return (sql, valores) => {
    const r = extra(sql, valores);
    if (r) return r;
    if (sql.includes('SELECT correo, rol, password_hash')) {
      return { rows: [{ correo: usuario.correo, rol: usuario.rol, password_hash: hash }] };
    }
    if (sql.includes('SELECT id, nombre, celular, correo, rol FROM usuario')) {
      return { rows: [usuario] };
    }
    if (sql.includes('UPDATE usuario') && sql.includes('RETURNING')) {
      const [, nombre, celular, correo] = valores as (string | null)[];
      return {
        rows: [
          {
            ...usuario,
            nombre: nombre ?? usuario.nombre,
            celular: celular ?? usuario.celular,
            correo: correo ?? usuario.correo,
          },
        ],
      };
    }
  };
}

describe('HU-006 · perfil', () => {
  it('sin sesión responde 401', async () => {
    const { db } = crearBdFalsa(usuarioEnBd(), null);
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer()).get('/api/identidad/me').expect(401);
    await request(app.getHttpServer()).patch('/api/identidad/me').send({ nombre: 'X' }).expect(401);
    await request(app.getHttpServer()).delete('/api/identidad/me').expect(401);
    await app.close();
  });

  it('GET /me devuelve el perfil con el celular', async () => {
    const { db } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/me')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body.usuario).toEqual(TUTOR);
    await app.close();
  });

  it('guarda los cambios válidos del perfil a nombre del usuario', async () => {
    const { db, consultas } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ nombre: 'Ana María', celular: '3109998877' })
      .expect(200);
    expect(r.body.usuario).toMatchObject({ nombre: 'Ana María', celular: '3109998877' });
    const update = consultas.find((c) => c.sql.includes('UPDATE usuario'));
    expect(update?.usuarioTx).toBe(TUTOR.id);
    expect(update?.valores[0]).toBe(TUTOR.id);
    await app.close();
  });

  it('rechaza datos inválidos con el detalle por campo', async () => {
    const { db } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ celular: '123' })
      .expect(400);
    expect(r.body.errores).toHaveProperty('celular');
    await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ rol: 'EQUIPO_VETO' })
      .expect(400);
    await app.close();
  });

  it('cambiar el correo exige la contraseña actual', async () => {
    const { db } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ correo: 'nueva@mail.com' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ correo: 'nueva@mail.com', contrasenaActual: 'clave-segura-1' })
      .expect(200);
    await app.close();
  });

  it('un correo ya registrado responde 409', async () => {
    const { db } = crearBdFalsa(
      usuarioEnBd(TUTOR, (sql) => {
        if (sql.includes('UPDATE usuario')) throw errorPg('23505');
      }),
    );
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ correo: 'otro@mail.com', contrasenaActual: 'clave-segura-1' })
      .expect(409);
    await app.close();
  });
});

describe('HU-006 · eliminar cuenta', () => {
  const confirmado = { contrasena: 'clave-segura-1', confirmacion: 'ELIMINAR' };

  it('exige la confirmación explícita', async () => {
    const { db, consultas } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .delete('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ contrasena: 'clave-segura-1' })
      .expect(400);
    expect(consultas.some((c) => c.sql.includes("estado = 'ELIMINADA'"))).toBe(false);
    await app.close();
  });

  it('con contraseña incorrecta responde 401 y no elimina', async () => {
    const { db, consultas } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .delete('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ ...confirmado, contrasena: 'equivocada' })
      .expect(401);
    expect(consultas.some((c) => c.sql.includes("estado = 'ELIMINADA'"))).toBe(false);
    await app.close();
  });

  it('aplica la política: cancela citas, anonimiza, cierra sesiones e informa', async () => {
    const { db, consultas } = crearBdFalsa(usuarioEnBd());
    const app = await crearApp([IdentidadModule], db);
    const r = await request(app.getHttpServer())
      .delete('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send(confirmado)
      .expect(200);
    expect(r.body.mensaje).toMatch(/eliminada/);
    expect(r.headers['set-cookie']?.[0]).toContain('Max-Age=0');

    const enTx = consultas.filter((c) => c.usuarioTx === TUTOR.id).map((c) => c.sql);
    expect(enTx.some((s) => s.includes("SET estado = 'CANCELADA'"))).toBe(true);
    expect(enTx.some((s) => s.includes('DELETE FROM sesion'))).toBe(true);
    const baja = consultas.find((c) => c.sql.includes("estado = 'ELIMINADA'"));
    expect(baja?.valores).toEqual([
      TUTOR.id,
      'Usuario eliminado',
      '0000000000',
      `eliminado+${TUTOR.id}@veto.invalid`,
      'ELIMINADA',
    ]);
    await app.close();
  });

  it('las cuentas de aliado no se autoeliminan', async () => {
    const { db } = crearBdFalsa(usuarioEnBd(ALIADO), ALIADO);
    const app = await crearApp([IdentidadModule], db);
    await request(app.getHttpServer())
      .delete('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send(confirmado)
      .expect(403);
    await app.close();
  });
});
