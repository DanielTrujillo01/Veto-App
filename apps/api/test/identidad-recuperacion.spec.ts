import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import { DatabaseService } from '../src/database/database.service';
import { CorreoRecuperacionService } from '../src/modules/identidad/correo-recuperacion.service';
import type { INestApplication } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { generarCodigoTotp, verificarContrasena } from '../src/modules/identidad/seguridad';
import { IdentidadService } from '../src/modules/identidad/identidad.service';
import { ENV } from '../src/config/env';
import { ENV_PRUEBA } from './utilidades';

const USUARIO_ID = '11111111-1111-4111-8111-111111111111';
const CORREO = 'ana@mail.com';
const SECRETO = 'JBSWY3DPEHPK3PXP';
const TOKEN_ANTIGUO = 'token-sesion-antigua';
const USUARIO = {
  id: USUARIO_ID,
  nombre: 'Ana Tutor',
  celular: '3001112233',
  correo: CORREO,
  rol: 'TUTOR',
  estado: 'ACTIVA',
  eliminado_en: null,
};

type Proposito = 'VERIFICACION' | 'RESTABLECIMIENTO' | 'INTENTO' | 'TOTP' | 'LOGIN';
type Desafio = {
  usuario_id: string;
  token_hash: string;
  proposito: Proposito;
  expira_en: Date;
  creado_en: Date;
  usado_en: Date | null;
  intentos: number;
};

function crearEscenario(options: { totpActivado?: boolean; correo?: string } = {}) {
  let passwordHash = '';
  const desafios = new Map<string, Desafio>();
  const sesiones = new Set([TOKEN_ANTIGUO]);
  const auditoriaConsultas: { sql: string; valores: unknown[]; usuarioTx: string | null }[] = [];
  const prefijoVerificacion = 'hu004:verificacion:';
  const prefijoRestablecimiento = 'hu004:restablecimiento:';
  const prefijoIntento = 'hu004:intento:';
  const prefijoTotp = 'hu004:totp:';
  const cuenta = {
    ...USUARIO,
    correo: options.correo ?? CORREO,
    totp_secreto: options.totpActivado === false ? null : SECRETO,
    totp_activado_en: options.totpActivado === false ? null : new Date(),
  };

  const ejecutar = async (
    sql: string,
    valores: unknown[] = [],
    usuarioTx: string | null = null,
  ) => {
    auditoriaConsultas.push({ sql, valores, usuarioTx });

    if (sql.includes('SELECT id FROM usuario WHERE id = $1 FOR UPDATE')) {
      return { rows: [{ id: USUARIO_ID }] };
    }
    if (sql.includes('SELECT count(*)::int AS cantidad')) {
      const [usuarioId, patron] = valores as [string, string];
      const prefijo = patron.slice(0, -1);
      return {
        rows: [
          {
            cantidad: [...desafios.values()].filter(
              (desafio) =>
                desafio.usuario_id === usuarioId &&
                desafio.token_hash.startsWith(prefijo) &&
                desafio.creado_en > new Date(Date.now() - 60 * 60 * 1000),
            ).length,
          },
        ],
      };
    }
    if (sql.includes('DELETE FROM desafio_2fa') && sql.includes("token_hash LIKE 'hu004:%'")) {
      const [usuarioId] = valores as [string];
      for (const [hash, desafio] of desafios) {
        if (
          desafio.usuario_id === usuarioId &&
          hash.startsWith('hu004:') &&
          desafio.creado_en < new Date(Date.now() - 24 * 60 * 60 * 1000)
        ) {
          desafios.delete(hash);
        }
      }
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO desafio_2fa')) {
      const [tokenHash, usuarioId, expiraEn] = valores as [string, string, Date];
      const proposito: Proposito = tokenHash.startsWith(prefijoVerificacion)
        ? 'VERIFICACION'
        : tokenHash.startsWith(prefijoRestablecimiento)
          ? 'RESTABLECIMIENTO'
          : tokenHash.startsWith(prefijoIntento)
            ? 'INTENTO'
            : tokenHash.startsWith(prefijoTotp)
              ? 'TOTP'
              : 'LOGIN';
      if (desafios.has(tokenHash)) {
        return { rows: [], rowCount: 0 };
      }
      const desafio: Desafio = {
        usuario_id: usuarioId,
        token_hash: tokenHash,
        proposito,
        expira_en: expiraEn,
        creado_en: new Date(),
        usado_en: null,
        intentos: 0,
      };
      desafios.set(tokenHash, desafio);
      return {
        rows: sql.includes('RETURNING token_hash') ? [{ token_hash: tokenHash }] : [],
        rowCount: 1,
      };
    }
    if (sql.includes('SELECT u.totp_secreto')) {
      const [tokenHash, usuarioId] = valores as [string, string];
      const desafio = desafios.get(tokenHash);
      if (
        !desafio ||
        desafio.proposito !== 'VERIFICACION' ||
        desafio.usado_en ||
        desafio.expira_en <= new Date() ||
        desafio.usuario_id !== usuarioId ||
        cuenta.estado !== 'ACTIVA' ||
        cuenta.eliminado_en !== null ||
        !cuenta.totp_activado_en
      ) {
        return { rows: [] };
      }
      return { rows: [{ totp_secreto: cuenta.totp_secreto }] };
    }
    if (sql.includes('SELECT token_hash FROM desafio_2fa') && sql.includes('expira_en > now()')) {
      const [usuarioId, tokenHash] = valores as [string, string];
      const desafio = desafios.get(tokenHash);
      return {
        rows:
          desafio?.usuario_id === usuarioId && desafio.expira_en > new Date()
            ? [{ token_hash: tokenHash }]
            : [],
      };
    }
    if (
      sql.includes('UPDATE desafio_2fa SET expira_en = now()') &&
      sql.includes('WHERE token_hash = $1')
    ) {
      const [tokenHash] = valores as [string];
      const desafio = desafios.get(tokenHash);
      if (desafio) {
        desafio.expira_en = new Date();
        desafio.usado_en = new Date();
      }
      return { rows: [], rowCount: desafio ? 1 : 0 };
    }
    if (
      sql.includes('UPDATE desafio_2fa SET expira_en = now()') &&
      sql.includes('WHERE usuario_id = $1')
    ) {
      const [usuarioId, ...patterns] = valores as [string, ...string[]];
      const prefixes = patterns.map((pattern) => pattern.slice(0, -1));
      for (const desafio of desafios.values()) {
        if (
          desafio.usuario_id === usuarioId &&
          prefixes.some((prefix) => desafio.token_hash.startsWith(prefix)) &&
          desafio.expira_en > new Date()
        ) {
          desafio.expira_en = new Date();
        }
      }
      return { rows: [] };
    }
    if (sql.includes('SELECT d.token_hash') && sql.includes('JOIN usuario')) {
      const [tokenHash] = valores as [string];
      const desafio = desafios.get(tokenHash);
      if (
        !desafio ||
        desafio.proposito !== 'RESTABLECIMIENTO' ||
        desafio.expira_en <= new Date() ||
        cuenta.estado !== 'ACTIVA' ||
        cuenta.eliminado_en !== null
      ) {
        return { rows: [] };
      }
      return { rows: [{ token_hash: desafio.token_hash }] };
    }
    if (sql.includes('UPDATE usuario SET password_hash')) {
      passwordHash = valores[1] as string;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('DELETE FROM sesion')) {
      sesiones.clear();
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM desafio_2fa') && sql.includes("token_hash NOT LIKE 'hu004:%'")) {
      const [usuarioId] = valores as [string];
      for (const [hash, desafio] of desafios) {
        if (desafio.usuario_id === usuarioId && !hash.startsWith('hu004:')) desafios.delete(hash);
      }
      return { rows: [] };
    }
    throw new Error(`Consulta de transacción no contemplada: ${sql}`);
  };

  const db = {
    query: jest.fn(async (sql: string, valores: unknown[] = []) => {
      auditoriaConsultas.push({ sql, valores, usuarioTx: null });
      if (sql.includes('SELECT id, correo, totp_secreto, totp_activado_en')) {
        return {
          rows:
            valores[0] === cuenta.correo.toLowerCase() && cuenta.estado === 'ACTIVA'
              ? [cuenta]
              : [],
        };
      }
      if (sql.includes('SELECT usuario_id FROM desafio_2fa')) {
        const [tokenHash] = valores as [string];
        const desafio = desafios.get(tokenHash);
        return { rows: desafio ? [{ usuario_id: desafio.usuario_id }] : [] };
      }
      if (sql.includes('SELECT id, nombre, celular, correo, rol, password_hash')) {
        return passwordHash && valores[0] === cuenta.correo.toLowerCase()
          ? {
              rows: [
                {
                  ...USUARIO,
                  correo: cuenta.correo,
                  password_hash: passwordHash,
                  totp_secreto: cuenta.totp_secreto,
                  totp_activado_en: cuenta.totp_activado_en,
                },
              ],
            }
          : { rows: [] };
      }
      if (sql.includes('INSERT INTO desafio_2fa')) return { rows: [] };
      throw new Error(`Consulta externa no contemplada: ${sql}`);
    }),
    withUser: jest.fn(
      async (usuarioId: string | null, fn: (client: PoolClient) => Promise<unknown>) => {
        const client = {
          query: (sql: string, valores?: unknown[]) => ejecutar(sql, valores, usuarioId),
        };
        return fn(client as unknown as PoolClient);
      },
    ),
  };

  return {
    db,
    desafios,
    sesiones,
    auditoriaConsultas,
    obtenerPasswordHash: () => passwordHash,
    obtenerSolicitudes: () =>
      [...desafios.values()].filter((desafio) => desafio.proposito === 'VERIFICACION').length,
    cuenta,
  };
}

function crearCorreoFalso() {
  const enlaces: string[] = [];
  return {
    enlaces,
    servicio: {
      assertConfigured: jest.fn(),
      enviarEnlaceRecuperacion: jest.fn(async (_destinatario: string, url: string) => {
        enlaces.push(url);
      }),
    },
  };
}

function tokenDelEnlace(url: string): string {
  return new URL(url).searchParams.get('token') ?? '';
}

describe('HU-004 · recuperación segura de contraseña', () => {
  it('responde de forma genérica para correos desconocidos y cuentas sin TOTP', async () => {
    const desconocido = crearEscenario({ correo: 'otro@mail.com' });
    const correoDesconocido = crearCorreoFalso();
    const servicioDesconocido = new IdentidadService(
      desconocido.db as never,
      undefined,
      correoDesconocido.servicio as never,
    );
    const respuestaDesconocido = await servicioDesconocido.solicitarRecuperacion({
      correo: 'no-existe@mail.com',
    });

    const sinTotp = crearEscenario({ totpActivado: false });
    const correoSinTotp = crearCorreoFalso();
    const servicioSinTotp = new IdentidadService(
      sinTotp.db as never,
      undefined,
      correoSinTotp.servicio as never,
    );
    const respuestaSinTotp = await servicioSinTotp.solicitarRecuperacion({ correo: CORREO });

    expect(respuestaDesconocido).toEqual(respuestaSinTotp);
    expect(correoDesconocido.servicio.enviarEnlaceRecuperacion).not.toHaveBeenCalled();
    expect(correoSinTotp.servicio.enviarEnlaceRecuperacion).not.toHaveBeenCalled();
  });

  it('envía un enlace de 15 minutos a cuentas con TOTP, con respuesta no enumerable', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    const respuesta = await servicio.solicitarRecuperacion({ correo: CORREO });

    expect(respuesta.mensaje).toContain('Si la cuenta permite recuperación automática');
    expect(correo.servicio.enviarEnlaceRecuperacion).toHaveBeenCalledWith(
      CORREO,
      expect.stringContaining('/recuperar-contrasena?token='),
    );
    expect(
      escenario.auditoriaConsultas.some((q) => q.sql.includes('INSERT INTO desafio_2fa')),
    ).toBe(true);
    expect([...escenario.desafios.values()][0].expira_en.getTime()).toBeGreaterThan(Date.now());
  });

  it('limita solicitudes de correo y no envía más de tres enlaces por hora', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    for (let i = 0; i < 4; i++) await servicio.solicitarRecuperacion({ correo: CORREO });
    expect(correo.servicio.enviarEnlaceRecuperacion).toHaveBeenCalledTimes(3);
    expect(escenario.obtenerSolicitudes()).toBe(3);
  });

  it('si SMTP falla no deja un enlace válido ni responde como envío exitoso', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    correo.servicio.enviarEnlaceRecuperacion.mockRejectedValue(new Error('SMTP caído'));
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );

    await expect(servicio.solicitarRecuperacion({ correo: CORREO })).rejects.toThrow('SMTP caído');
    expect([...escenario.desafios.values()].some((desafio) => desafio.expira_en > new Date())).toBe(
      false,
    );
  });

  it('rechaza código TOTP incorrecto y deja el contador de intentos guardado', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    await servicio.solicitarRecuperacion({ correo: CORREO });
    const token = tokenDelEnlace(correo.enlaces[0]);
    const codigoValido = generarCodigoTotp(SECRETO);
    const codigoInvalido = codigoValido === '000000' ? '000001' : '000000';

    await expect(servicio.verificarRecuperacion({ token, codigo: codigoInvalido })).rejects.toThrow(
      'no es válido',
    );
    expect(
      [...escenario.desafios.values()].filter((desafio) => desafio.proposito === 'INTENTO'),
    ).toHaveLength(1);
  });

  it('bloquea un enlace tras cinco códigos incorrectos y rechaza el enlace vencido', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    await servicio.solicitarRecuperacion({ correo: CORREO });
    const token = tokenDelEnlace(correo.enlaces[0]);

    for (let i = 0; i < 5; i++) {
      const codigoValido = generarCodigoTotp(SECRETO);
      const codigoInvalido = codigoValido === '000000' ? '000001' : '000000';
      await expect(
        servicio.verificarRecuperacion({ token, codigo: codigoInvalido }),
      ).rejects.toThrow('no es válido');
    }
    expect([...escenario.desafios.values()][0].expira_en.getTime()).toBeLessThanOrEqual(Date.now());
    expect(
      [...escenario.desafios.values()].filter((desafio) => desafio.proposito === 'INTENTO'),
    ).toHaveLength(5);
    await expect(
      servicio.verificarRecuperacion({ token, codigo: generarCodigoTotp(SECRETO) }),
    ).rejects.toThrow('no es válido');

    const vencido = crearEscenario();
    const correoVencido = crearCorreoFalso();
    const servicioVencido = new IdentidadService(
      vencido.db as never,
      undefined,
      correoVencido.servicio as never,
    );
    await servicioVencido.solicitarRecuperacion({ correo: CORREO });
    const tokenVencido = tokenDelEnlace(correoVencido.enlaces[0]);
    const reto = [...vencido.desafios.values()][0];
    reto.expira_en = new Date(Date.now() - 1);
    await expect(
      servicioVencido.verificarRecuperacion({
        token: tokenVencido,
        codigo: generarCodigoTotp(SECRETO),
      }),
    ).rejects.toThrow('no es válido');
  });

  it('consume el enlace y no permite reutilizarlo para emitir otro token', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    await servicio.solicitarRecuperacion({ correo: CORREO });
    const token = tokenDelEnlace(correo.enlaces[0]);
    const verificado = await servicio.verificarRecuperacion({
      token,
      codigo: generarCodigoTotp(SECRETO),
    });

    expect(verificado.token).toHaveLength(43);
    await expect(
      servicio.verificarRecuperacion({ token, codigo: generarCodigoTotp(SECRETO) }),
    ).rejects.toThrow('no es válido');
  });

  it('rechaza reutilizar el mismo código TOTP en una solicitud nueva', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    const codigo = generarCodigoTotp(SECRETO);

    await servicio.solicitarRecuperacion({ correo: CORREO });
    await servicio.verificarRecuperacion({
      token: tokenDelEnlace(correo.enlaces[0]),
      codigo,
    });
    await servicio.solicitarRecuperacion({ correo: CORREO });

    await expect(
      servicio.verificarRecuperacion({
        token: tokenDelEnlace(correo.enlaces[1]),
        codigo,
      }),
    ).rejects.toThrow('no es válido');
    expect(
      [...escenario.desafios.values()].filter((desafio) => desafio.proposito === 'INTENTO'),
    ).toHaveLength(1);
  });

  it('rechaza un token de cambio de contraseña vencido', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    await servicio.solicitarRecuperacion({ correo: CORREO });
    const { token } = await servicio.verificarRecuperacion({
      token: tokenDelEnlace(correo.enlaces[0]),
      codigo: generarCodigoTotp(SECRETO),
    });
    const desafio = [...escenario.desafios.values()].find(
      (item) => item.proposito === 'RESTABLECIMIENTO',
    );
    if (!desafio) throw new Error('No se creó el token de restablecimiento');
    desafio.expira_en = new Date(Date.now() - 1);

    await expect(
      servicio.completarRecuperacion({ token, contrasena: 'nueva-clave-segura-2' }),
    ).rejects.toThrow('no es válido');
    expect(escenario.obtenerPasswordHash()).toBe('');
  });

  it('cambia la contraseña una sola vez, invalida sesiones y revoca desafíos', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    await servicio.solicitarRecuperacion({ correo: CORREO });
    const token = tokenDelEnlace(correo.enlaces[0]);
    const { token: tokenRestablecimiento } = await servicio.verificarRecuperacion({
      token,
      codigo: generarCodigoTotp(SECRETO),
    });

    await servicio.completarRecuperacion({
      token: tokenRestablecimiento,
      contrasena: 'nueva-clave-segura-2',
    });
    expect(escenario.obtenerPasswordHash()).not.toBe('');
    await expect(
      verificarContrasena('nueva-clave-segura-2', escenario.obtenerPasswordHash()),
    ).resolves.toBe(true);
    await expect(
      verificarContrasena('clave-anterior', escenario.obtenerPasswordHash()),
    ).resolves.toBe(false);
    expect(escenario.sesiones.size).toBe(0);

    await expect(
      servicio.completarRecuperacion({
        token: tokenRestablecimiento,
        contrasena: 'otra-clave-segura-3',
      }),
    ).rejects.toThrow('no es válido');
    await expect(servicio.iniciarSesion(CORREO, 'clave-anterior')).resolves.toBeNull();
    await expect(servicio.iniciarSesion(CORREO, 'nueva-clave-segura-2')).resolves.toMatchObject({
      requiere2fa: true,
    });
  });

  it('escribe el cambio a nombre de la cuenta dentro de una transacción', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const servicio = new IdentidadService(
      escenario.db as never,
      undefined,
      correo.servicio as never,
    );
    await servicio.solicitarRecuperacion({ correo: CORREO });
    const token = tokenDelEnlace(correo.enlaces[0]);
    const { token: tokenRestablecimiento } = await servicio.verificarRecuperacion({
      token,
      codigo: generarCodigoTotp(SECRETO),
    });
    await servicio.completarRecuperacion({
      token: tokenRestablecimiento,
      contrasena: 'nueva-clave-segura-2',
    });

    expect(
      escenario.auditoriaConsultas.some(
        (consulta) =>
          consulta.sql.includes('UPDATE usuario SET password_hash') &&
          consulta.usuarioTx === USUARIO_ID,
      ),
    ).toBe(true);
  });

  it('valida requests de recuperación en los endpoints HTTP', async () => {
    const escenario = crearEscenario();
    const correo = crearCorreoFalso();
    const modulo = await Test.createTestingModule({ imports: [IdentidadModule] })
      .useMocker((token) => {
        if (token === DatabaseService) return escenario.db;
        if (token === ENV) return ENV_PRUEBA;
      })
      .overrideProvider(CorreoRecuperacionService)
      .useValue(correo.servicio)
      .compile();
    const app: INestApplication = modulo.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    await request(app.getHttpServer())
      .post('/api/identidad/recuperar-contrasena')
      .send({ correo: 'no-es-correo' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/identidad/recuperar-contrasena/verificar')
      .send({ token: 'corto', codigo: 'abc' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/identidad/recuperar-contrasena/completar')
      .send({ token: 'a'.repeat(43), contrasena: 'corta' })
      .expect(400);
    await app.close();
  });
});
