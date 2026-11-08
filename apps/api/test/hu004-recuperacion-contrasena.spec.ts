import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ENV, type Env } from '../src/config/env';
import { DatabaseService } from '../src/database/database.service';
import { CorreoService } from '../src/modules/identidad/correo.service';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import { verificarContrasena } from '../src/modules/identidad/seguridad';
import { ENV_PRUEBA } from './utilidades';

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';

function crearBdRecuperacion() {
  let cuentaExiste = true;
  let codigoHash: string | null = null;
  let tokenHash: string | null = null;
  let intentos = 0;
  let passwordHash = '';
  const consultas: string[] = [];

  const ejecutar = async (sql: string, valores: unknown[] = []) => {
    consultas.push(sql);
    if (sql.includes('SELECT id, correo, nombre FROM usuario')) {
      return {
        rows: cuentaExiste ? [{ id: USUARIO_ID, correo: 'ana@mail.com', nombre: 'Ana Tutor' }] : [],
      };
    }
    if (sql.includes('INSERT INTO recuperacion_contrasena')) {
      codigoHash = valores[1] as string;
      tokenHash = null;
      intentos = 0;
      return { rows: [{ usuario_id: USUARIO_ID }] };
    }
    if (sql.includes('SELECT r.usuario_id')) {
      return codigoHash
        ? {
            rows: [{ usuario_id: USUARIO_ID, codigo_hash: codigoHash, token_hash: null, intentos }],
          }
        : { rows: [] };
    }
    if (sql.includes('SET intentos = intentos + 1')) {
      intentos += 1;
      return { rows: [] };
    }
    if (sql.includes('SET codigo_hash = NULL, token_hash = $2')) {
      codigoHash = null;
      tokenHash = valores[1] as string;
      return { rows: [] };
    }
    if (sql.includes('SELECT usuario_id FROM recuperacion_contrasena')) {
      return valores[0] === tokenHash ? { rows: [{ usuario_id: USUARIO_ID }] } : { rows: [] };
    }
    if (sql.includes('UPDATE usuario SET password_hash')) {
      passwordHash = valores[1] as string;
      return { rows: [{ id: USUARIO_ID }] };
    }
    if (sql.includes('DELETE FROM recuperacion_contrasena')) {
      codigoHash = null;
      tokenHash = null;
    }
    return { rows: [] };
  };

  const db = {
    query: jest.fn((sql: string, valores?: unknown[]) => ejecutar(sql, valores)),
    withUser: jest.fn(
      async (_usuarioId: string | null, fn: (client: unknown) => Promise<unknown>) =>
        fn({ query: ejecutar }),
    ),
    ping: jest.fn(async () => true),
  };

  return {
    db,
    consultas,
    leer: () => ({ cuentaExiste, passwordHash, intentos }),
    cambiarExistencia: (existe: boolean) => {
      cuentaExiste = existe;
    },
  };
}

async function crearApp(db: unknown, correo: unknown, env: Partial<Env> = {}) {
  const modulo = await Test.createTestingModule({ imports: [IdentidadModule] })
    .useMocker((token) => {
      if (token === DatabaseService) return db;
      if (token === ENV) return { ...ENV_PRUEBA, ...env };
    })
    .overrideProvider(CorreoService)
    .useValue(correo)
    .compile();
  const app = modulo.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

describe('HU-004 · recuperación de contraseña', () => {
  it('envía y verifica un código, cambia la contraseña y revoca las sesiones', async () => {
    const bd = crearBdRecuperacion();
    const enviarCorreo = jest.fn(
      async (_correo: string, _nombre: string, _codigo: string) => undefined,
    );
    const app = await crearApp(bd.db, {
      disponible: true,
      verificarConexion: jest.fn(async () => true),
      enviarCodigoRecuperacion: enviarCorreo,
    });

    await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/solicitar')
      .send({ correo: 'Ana@Mail.com' })
      .expect(202)
      .expect(({ body }) =>
        expect(body.mensaje).toBe(
          'Si existe una cuenta con ese correo, recibirás un código de verificación.',
        ),
      );
    expect(enviarCorreo).toHaveBeenCalledWith(
      'ana@mail.com',
      'Ana Tutor',
      expect.stringMatching(/^[0-9]{6}$/),
    );
    const codigo = enviarCorreo.mock.calls[0][2] as string;
    const codigoIncorrecto = String((Number(codigo) + 1) % 1_000_000).padStart(6, '0');

    await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/verificar')
      .send({ correo: 'ana@mail.com', codigo: codigoIncorrecto })
      .expect(400);
    expect(bd.leer().intentos).toBe(1);

    const verificacion = await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/verificar')
      .send({ correo: 'ana@mail.com', codigo })
      .expect(200);
    expect(verificacion.body.mensaje).toContain('Código verificado');
    const cookieRecuperacion = verificacion.headers['set-cookie'][0] as string;
    expect(cookieRecuperacion).toContain('HttpOnly');
    expect(cookieRecuperacion).toContain('veto_password_recovery=');

    await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/restablecer')
      .set('Cookie', cookieRecuperacion.split(';')[0])
      .send({ contrasena: 'NuevaClave123' })
      .expect(200);
    await expect(verificarContrasena('NuevaClave123', bd.leer().passwordHash)).resolves.toBe(true);
    expect(bd.consultas).toContain('DELETE FROM sesion WHERE usuario_id = $1');
    expect(bd.leer().passwordHash).not.toContain('NuevaClave123');
    await app.close();
  });

  it('responde de forma indistinguible cuando el correo no corresponde a una cuenta', async () => {
    const bd = crearBdRecuperacion();
    bd.cambiarExistencia(false);
    const enviarCorreo = jest.fn(
      async (_correo: string, _nombre: string, _codigo: string) => undefined,
    );
    const app = await crearApp(bd.db, {
      disponible: true,
      verificarConexion: jest.fn(async () => true),
      enviarCodigoRecuperacion: enviarCorreo,
    });

    const respuesta = await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/solicitar')
      .send({ correo: 'desconocido@mail.com' })
      .expect(202);
    expect(respuesta.body.mensaje).toBe(
      'Si existe una cuenta con ese correo, recibirás un código de verificación.',
    );
    expect(enviarCorreo).not.toHaveBeenCalled();
    await app.close();
  });

  it('informa el error SMTP y elimina el código que no pudo enviarse', async () => {
    const bd = crearBdRecuperacion();
    const app = await crearApp(bd.db, {
      disponible: true,
      verificarConexion: jest.fn(async () => true),
      enviarCodigoRecuperacion: jest.fn(
        async (_correo: string, _nombre: string, _codigo: string) => {
          throw Object.assign(new Error('SMTP authentication failed'), { code: 'EAUTH' });
        },
      ),
    });

    await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/solicitar')
      .send({ correo: 'ana@mail.com' })
      .expect(503)
      .expect(({ body }) =>
        expect(body.message).toContain('No pudimos enviar el código de recuperación'),
      );
    expect(bd.consultas).toContain(
      'DELETE FROM recuperacion_contrasena WHERE usuario_id = $1 AND codigo_hash = $2',
    );
    await app.close();
  });

  it('no expone la solicitud cuando el envío SMTP no está configurado', async () => {
    const bd = crearBdRecuperacion();
    const app = await crearApp(bd.db, {
      disponible: false,
      verificarConexion: jest.fn(async () => false),
      enviarCodigoRecuperacion: jest.fn(),
    });

    await request(app.getHttpServer())
      .post('/api/identidad/recuperacion/solicitar')
      .send({ correo: 'ana@mail.com' })
      .expect(503);
    await app.close();
  });
});
