import { createHash } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IdentidadModule } from '../src/modules/identidad/identidad.module';
import {
  generarCodigoTotp,
  generarSecretoTotp,
  hashContrasena,
  hashSesion,
} from '../src/modules/identidad/seguridad';
import {
  COOKIE,
  crearApp,
  crearBdFalsa,
  errorPg,
  type Fila,
  type UsuarioPrueba,
} from './utilidades';

const ENV_GOOGLE = {
  GOOGLE_CLIENT_ID: 'cliente-veto.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'secreto-del-cliente',
};
const WEB = 'http://localhost:3000';
const SUB = 'google-sub-1234567890';
const SUB_OTRO = 'google-sub-otro-000';
const CONTRASENA = 'Contrasena123';

type Cuenta = {
  id: string;
  nombre: string;
  celular: string;
  correo: string;
  rol: string;
  estado: string;
  eliminado_en: Date | null;
  password_hash: string;
  totp_secreto: string | null;
  totp_activado_en: Date | null;
};
type Pendiente = {
  tipo: 'VINCULAR' | 'REGISTRO';
  google_sub: string;
  correo: string;
  nombre: string;
  usuario_id: string | null;
  intentos: number;
};

let hashDeContrasena: string;
beforeAll(async () => {
  hashDeContrasena = await hashContrasena(CONTRASENA);
});

function cuentaBase(extra: Partial<Cuenta> = {}): Cuenta {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    nombre: 'Ana Tutora',
    celular: '3001112233',
    correo: 'ana@mail.com',
    rol: 'TUTOR',
    estado: 'ACTIVA',
    eliminado_en: null,
    password_hash: hashDeContrasena,
    totp_secreto: null,
    totp_activado_en: null,
    ...extra,
  };
}

/** Base de datos en memoria con las tablas del flujo de Google. */
function crearEscenario(
  inicial: { cuentas?: Cuenta[]; vinculos?: Record<string, string>; sesion?: UsuarioPrueba } = {},
) {
  const cuentas = [...(inicial.cuentas ?? [])];
  const vinculos = new Map<string, string>(Object.entries(inicial.vinculos ?? {}));
  const estados = new Map<
    string,
    { nonce: string; code_verifier: string; usuario_id: string | null; expira: number }
  >();
  const reautenticaciones = new Map<string, { usuario_id: string; expira: number }>();
  const bajas: unknown[][] = [];
  const pendientes = new Map<string, Pendiente & { expira: number }>();
  const sesiones: string[] = [];
  const desafios: string[] = [];
  const usuariosCreados: unknown[][] = [];
  const registro = { ultimoNonce: '', ultimoVerificador: '', ultimoReto: '' };
  let siguienteId = 1;

  const aFila = (c: Cuenta, extra: Fila = {}): Fila => ({ ...c, ...extra });
  const conVinculo = (c: Cuenta) => [...vinculos.values()].includes(c.id);

  const { db, consultas } = crearBdFalsa((sql, valores) => {
    // --- estado del intento de OAuth ---
    if (sql.startsWith('DELETE FROM google_estado_oauth WHERE expira_en')) return { rows: [] };
    if (sql.includes('INSERT INTO google_estado_oauth')) {
      const [hash, nonce, verificador, usuarioId, expira] = valores as [
        string,
        string,
        string,
        string | null,
        Date,
      ];
      estados.set(hash, {
        nonce,
        code_verifier: verificador,
        usuario_id: usuarioId,
        expira: expira.getTime(),
      });
      registro.ultimoNonce = nonce;
      registro.ultimoVerificador = verificador;
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM google_estado_oauth')) {
      const e = estados.get(valores[0] as string);
      estados.delete(valores[0] as string);
      return { rows: e && e.expira > Date.now() ? [e] : [] };
    }
    // --- reautenticación (HU-003) ---
    if (sql.includes('g.usuario_id = $1') && sql.includes('SELECT g.correo')) {
      const sub = [...vinculos].find(([, id]) => id === valores[0])?.[0];
      return { rows: sub ? [{ correo: 'sofi@mail.com' }] : [] };
    }
    if (sql.includes('SELECT usuario_id FROM cuenta_google WHERE google_sub')) {
      const id = vinculos.get(valores[0] as string);
      return { rows: id ? [{ usuario_id: id }] : [] };
    }
    if (sql.includes('DELETE FROM google_reautenticacion WHERE usuario_id')) {
      for (const [hash, t] of reautenticaciones)
        if (t.usuario_id === valores[0]) reautenticaciones.delete(hash);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO google_reautenticacion')) {
      const [hash, usuarioId, expira] = valores as [string, string, Date];
      reautenticaciones.set(hash, { usuario_id: usuarioId, expira: expira.getTime() });
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM google_reautenticacion') && sql.includes('RETURNING')) {
      const t = reautenticaciones.get(valores[0] as string);
      if (!t || t.usuario_id !== valores[1] || t.expira <= Date.now()) return { rows: [] };
      reautenticaciones.delete(valores[0] as string);
      return { rows: [{ '?column?': 1 }] };
    }
    if (sql.includes('AS vinculada') && sql.includes('AS sin_contrasena')) {
      const c = cuentas.find((x) => x.id === valores[0]);
      return {
        rows: c
          ? [{ vinculada: conVinculo(c), sin_contrasena: c.password_hash === valores[1] }]
          : [],
      };
    }
    // --- eliminar cuenta / editar perfil (HU-006) ---
    if (sql.includes('SELECT correo, rol, password_hash FROM usuario')) {
      const c = cuentas.find((x) => x.id === valores[0] && x.estado === 'ACTIVA');
      return { rows: c ? [{ correo: c.correo, rol: c.rol, password_hash: c.password_hash }] : [] };
    }
    if (sql.includes("SET estado = 'ELIMINADA'")) {
      bajas.push(valores);
      const c = cuentas.find((x) => x.id === valores[0]);
      if (c) c.estado = 'ELIMINADA';
      return { rows: [] };
    }
    // --- cuentas ---
    if (sql.includes('FROM cuenta_google g JOIN usuario u')) {
      const id = vinculos.get(valores[0] as string);
      const c = cuentas.find((x) => x.id === id);
      return { rows: c ? [aFila(c)] : [] };
    }
    if (sql.includes('FROM usuario u') && sql.includes('u.correo = $1')) {
      const c = cuentas.find((x) => x.correo === valores[0]);
      return { rows: c ? [aFila(c, { google_vinculada: conVinculo(c) })] : [] };
    }
    if (sql.includes('INSERT INTO usuario')) {
      const [nombre, celular, correo, hash, rol] = valores as string[];
      if (cuentas.some((c) => c.correo === correo)) throw errorPg('23505');
      usuariosCreados.push(valores);
      const nueva = cuentaBase({
        id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(siguienteId++).padStart(12, '0')}`,
        nombre,
        celular,
        correo,
        rol,
        password_hash: hash,
      });
      cuentas.push(nueva);
      return { rows: [{ id: nueva.id, nombre, celular, correo, rol }] };
    }
    if (sql.includes('INSERT INTO cuenta_google')) {
      const [sub, usuarioId] = valores as string[];
      if (vinculos.has(sub) || [...vinculos.values()].includes(usuarioId)) throw errorPg('23505');
      vinculos.set(sub, usuarioId);
      return { rows: [] };
    }
    // --- solicitudes pendientes ---
    if (sql.includes('DELETE FROM google_pendiente WHERE expira_en < now() OR google_sub')) {
      for (const [hash, p] of pendientes) if (p.google_sub === valores[0]) pendientes.delete(hash);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO google_pendiente')) {
      const [hash, tipo, sub, correo, nombre, usuarioId, expira] = valores as [
        string,
        'VINCULAR' | 'REGISTRO',
        string,
        string,
        string,
        string | null,
        Date,
      ];
      pendientes.set(hash, {
        tipo,
        google_sub: sub,
        correo,
        nombre,
        usuario_id: usuarioId,
        intentos: 0,
        expira: expira.getTime(),
      });
      return { rows: [] };
    }
    if (sql.includes('FROM google_pendiente p LEFT JOIN usuario u')) {
      const p = pendientes.get(valores[0] as string);
      if (!p || p.expira <= Date.now()) return { rows: [] };
      const c = cuentas.find((x) => x.id === p.usuario_id);
      return {
        rows: [
          {
            tipo: p.tipo,
            correo: p.correo,
            nombre: p.nombre,
            requiere_codigo: c ? c.totp_activado_en !== null : null,
          },
        ],
      };
    }
    if (sql.includes('FROM google_pendiente p JOIN usuario u')) {
      const p = pendientes.get(valores[0] as string);
      const c = cuentas.find((x) => x.id === p?.usuario_id);
      if (!p || !c || p.tipo !== 'VINCULAR' || p.expira <= Date.now() || c.estado !== 'ACTIVA') {
        return { rows: [] };
      }
      return { rows: [aFila(c, { intentos: p.intentos, google_sub: p.google_sub })] };
    }
    if (sql.includes('UPDATE google_pendiente SET intentos')) {
      const p = pendientes.get(valores[0] as string);
      if (p) p.intentos += 1;
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM google_pendiente WHERE token_hash = $1 AND intentos >= $2')) {
      const p = pendientes.get(valores[0] as string);
      if (p && p.intentos >= (valores[1] as number)) pendientes.delete(valores[0] as string);
      return { rows: [] };
    }
    if (sql.includes('DELETE FROM google_pendiente') && sql.includes('RETURNING')) {
      const p = pendientes.get(valores[0] as string);
      const tipoEsperado = sql.includes("tipo = 'REGISTRO'") ? 'REGISTRO' : 'VINCULAR';
      if (!p || p.tipo !== tipoEsperado || p.expira <= Date.now()) return { rows: [] };
      pendientes.delete(valores[0] as string);
      return { rows: [{ google_sub: p.google_sub, correo: p.correo, nombre: p.nombre }] };
    }
    if (sql.includes('DELETE FROM google_pendiente WHERE token_hash = $1')) {
      pendientes.delete(valores[0] as string);
      return { rows: [] };
    }
    // --- sesiones ---
    if (sql.includes('INSERT INTO sesion')) {
      sesiones.push(valores[0] as string);
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO desafio_2fa')) {
      desafios.push(valores[0] as string);
      return { rows: [] };
    }
  }, inicial.sesion);
  return {
    db,
    consultas,
    cuentas,
    vinculos,
    reautenticaciones,
    bajas,
    estados,
    pendientes,
    sesiones,
    desafios,
    usuariosCreados,
    registro,
  };
}
type Escenario = ReturnType<typeof crearEscenario>;

// ---------- Google simulado (fetch) ----------

type Claims = Record<string, unknown>;
function idToken(claims: Claims): string {
  const parte = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${parte({ alg: 'RS256', typ: 'JWT' })}.${parte(claims)}.firma-de-prueba`;
}

/**
 * Reemplaza `fetch`: responde como el endpoint de tokens de Google. Comprueba los parámetros
 * del intercambio y que el verificador PKCE corresponda al `code_challenge` enviado a Google.
 */
function simularGoogle(
  e: Escenario,
  opciones: { claims?: Claims; estado?: number; cuerpo?: unknown; falla?: boolean } = {},
) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    if (opciones.falla) throw new Error('sin red');
    const cuerpo = new URLSearchParams(String((init as RequestInit).body));
    expect(String(_url)).toBe('https://oauth2.googleapis.com/token');
    expect(cuerpo.get('grant_type')).toBe('authorization_code');
    expect(cuerpo.get('client_id')).toBe(ENV_GOOGLE.GOOGLE_CLIENT_ID);
    expect(cuerpo.get('client_secret')).toBe(ENV_GOOGLE.GOOGLE_CLIENT_SECRET);
    expect(cuerpo.get('redirect_uri')).toBe('http://localhost:3001/api/identidad/google/callback');
    expect(cuerpo.get('code')).toBe('codigo-de-google');
    // PKCE: el verificador enviado ahora debe corresponder al reto enviado al inicio.
    const reto = createHash('sha256')
      .update(cuerpo.get('code_verifier') ?? '')
      .digest('base64url');
    expect(reto).toBe(e.registro.ultimoReto);

    const status = opciones.estado ?? 200;
    const json =
      opciones.cuerpo ??
      (status === 200
        ? {
            access_token: 'x',
            id_token: idToken({
              iss: 'https://accounts.google.com',
              aud: ENV_GOOGLE.GOOGLE_CLIENT_ID,
              sub: SUB,
              email: 'ana@mail.com',
              email_verified: true,
              name: 'Ana Google',
              nonce: e.registro.ultimoNonce,
              exp: Math.floor(Date.now() / 1000) + 3600,
              ...opciones.claims,
            }),
          }
        : { error: 'invalid_grant' });
    return new Response(JSON.stringify(json), { status });
  });
}

// ---------- Recorrido del navegador ----------

const cookiesDe = (r: request.Response): string[] =>
  (r.headers['set-cookie'] as unknown as string[]) ?? [];
const cookie = (r: request.Response, nombre: string) =>
  cookiesDe(r).find((c) => c.startsWith(`${nombre}=`));
const valorCookie = (r: request.Response, nombre: string) =>
  cookie(r, nombre)?.split(';')[0].split('=')[1];

/** Paso 1: el navegador va a /identidad/google y Google lo recibe con estos parámetros. */
async function iniciar(app: INestApplication, e: Escenario) {
  const r = await request(app.getHttpServer()).get('/api/identidad/google').expect(302);
  const destino = new URL(r.headers.location);
  e.registro.ultimoReto = destino.searchParams.get('code_challenge') ?? '';
  return {
    r,
    destino,
    state: destino.searchParams.get('state') ?? '',
    cookieEstado: valorCookie(r, 'veto_google_estado'),
  };
}

/** Pasos 1 y 2: la persona acepta en Google y vuelve a la API con `code` y `state`. */
async function ingresarConGoogle(app: INestApplication, e: Escenario) {
  const { state, cookieEstado } = await iniciar(app, e);
  return request(app.getHttpServer())
    .get('/api/identidad/google/callback')
    .query({ code: 'codigo-de-google', state })
    .set('Cookie', `veto_google_estado=${cookieEstado}`)
    .expect(302);
}

const destinoWeb = (r: request.Response) => new URL(r.headers.location);
const sinSesion = (r: request.Response) => expect(cookie(r, 'veto_session')).toBeUndefined();
const sesionesAbiertas = (e: Escenario) => e.sesiones.length;

async function nuevaApp(e: Escenario, conGoogle = true) {
  return crearApp([IdentidadModule], e.db, conGoogle ? ENV_GOOGLE : {});
}

afterEach(() => jest.restoreAllMocks());

describe('HU-003 · disponibilidad (es opcional)', () => {
  it('sin credenciales de Google informa que no está disponible y no hace nada', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e, false);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/disponible')
      .expect(200);
    expect(r.body).toEqual({ disponible: false });

    const inicio = await request(app.getHttpServer()).get('/api/identidad/google').expect(302);
    expect(destinoWeb(inicio).origin + destinoWeb(inicio).pathname).toBe(`${WEB}/login`);
    expect(destinoWeb(inicio).searchParams.get('google')).toBe('error');
    expect(destinoWeb(inicio).searchParams.get('motivo')).toBe('no_disponible');
    expect(cookie(inicio, 'veto_google_estado')).toBeUndefined();
    expect(e.estados.size).toBe(0);
    await app.close();
  });

  it('con credenciales informa que está disponible', async () => {
    const app = await nuevaApp(crearEscenario());
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/disponible')
      .expect(200);
    expect(r.body).toEqual({ disponible: true });
    await app.close();
  });
});

describe('HU-003 · salida hacia Google', () => {
  it('redirige a Google con state, nonce y PKCE, y amarra el intento al navegador', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const { r, destino, state, cookieEstado } = await iniciar(app, e);

    expect(`${destino.origin}${destino.pathname}`).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
    const p = destino.searchParams;
    expect(p.get('client_id')).toBe(ENV_GOOGLE.GOOGLE_CLIENT_ID);
    expect(p.get('redirect_uri')).toBe('http://localhost:3001/api/identidad/google/callback');
    expect(p.get('response_type')).toBe('code');
    expect(p.get('scope')).toBe('openid email profile');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(p.get('nonce')).toBeTruthy();
    expect(state.length).toBeGreaterThanOrEqual(32);
    expect(p.get('client_secret')).toBeNull();

    // La cookie lleva el state, solo para las rutas del flujo, y no la lee ningún script.
    expect(cookieEstado).toBe(state);
    const c = cookie(r, 'veto_google_estado') ?? '';
    expect(c).toContain('HttpOnly');
    expect(c).toContain('Path=/api/identidad/google');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Max-Age=600');
    expect(r.headers['cache-control']).toBe('no-store');

    // En la base solo queda el hash del state; el verificador PKCE nunca sale del servidor.
    expect(e.estados.has(state)).toBe(false);
    expect(e.estados.size).toBe(1);
    expect(destino.toString()).not.toContain(e.registro.ultimoVerificador);
    await app.close();
  });

  it('cada intento usa valores distintos', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const a = await iniciar(app, e);
    const b = await iniciar(app, e);
    expect(a.state).not.toBe(b.state);
    expect(a.destino.searchParams.get('nonce')).not.toBe(b.destino.searchParams.get('nonce'));
    await app.close();
  });
});

describe('HU-003 · el flujo autentica una cuenta válida y regresa a la aplicación', () => {
  it('cuenta ya vinculada: abre sesión y vuelve a la web', async () => {
    const ana = cuentaBase();
    const e = crearEscenario({ cuentas: [ana], vinculos: { [SUB]: ana.id } });
    const app = await nuevaApp(e);
    const google = simularGoogle(e);

    const r = await ingresarConGoogle(app, e);

    const web = destinoWeb(r);
    expect(`${web.origin}${web.pathname}`).toBe(`${WEB}/login`);
    expect(web.searchParams.get('google')).toBe('ok');
    expect(web.searchParams.has('motivo')).toBe(false);
    expect(web.toString()).not.toContain('codigo-de-google');

    const sesion = cookie(r, 'veto_session') ?? '';
    expect(sesion).toContain('HttpOnly');
    expect(sesion).toContain('Path=/');
    expect(sesionesAbiertas(e)).toBe(1);
    expect(google).toHaveBeenCalledTimes(1);
    expect(e.usuariosCreados).toHaveLength(0);
    // Se descartó la cookie del intento.
    expect(cookie(r, 'veto_google_estado')).toContain('Max-Age=0');
    await app.close();
  });

  it('la sesión se guarda solo como hash: el token del navegador no queda en la base', async () => {
    const ana = cuentaBase();
    const e = crearEscenario({ cuentas: [ana], vinculos: { [SUB]: ana.id } });
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await ingresarConGoogle(app, e);
    const token = valorCookie(r, 'veto_session') ?? '';
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(e.sesiones[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(e.sesiones[0]).not.toBe(token);
    await app.close();
  });

  it('el intento se consume: repetir el mismo regreso no abre otra sesión', async () => {
    const ana = cuentaBase();
    const e = crearEscenario({ cuentas: [ana], vinculos: { [SUB]: ana.id } });
    const app = await nuevaApp(e);
    const google = simularGoogle(e);
    const { state, cookieEstado } = await iniciar(app, e);
    const volver = () =>
      request(app.getHttpServer())
        .get('/api/identidad/google/callback')
        .query({ code: 'codigo-de-google', state })
        .set('Cookie', `veto_google_estado=${cookieEstado}`)
        .expect(302);

    expect(destinoWeb(await volver()).searchParams.get('google')).toBe('ok');
    const repetido = await volver();
    expect(destinoWeb(repetido).searchParams.get('motivo')).toBe('estado');
    sinSesion(repetido);
    expect(sesionesAbiertas(e)).toBe(1);
    expect(google).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('la cuenta con 2FA no salta la verificación: entrega un desafío y no abre sesión', async () => {
    const ana = cuentaBase({ totp_secreto: generarSecretoTotp(), totp_activado_en: new Date() });
    const e = crearEscenario({ cuentas: [ana], vinculos: { [SUB]: ana.id } });
    const app = await nuevaApp(e);
    simularGoogle(e);

    const r = await ingresarConGoogle(app, e);

    const web = destinoWeb(r);
    expect(web.searchParams.get('google')).toBe('2fa');
    expect(web.hash).toMatch(/^#desafio=[\w-]{40,}$/);
    expect(web.search).not.toContain('desafio');
    sinSesion(r);
    expect(sesionesAbiertas(e)).toBe(0);
    expect(e.desafios).toHaveLength(1);
    await app.close();
  });
});

describe('HU-003 · cancelación, rechazo o error del proveedor no crean sesión', () => {
  async function sinEfectos(r: request.Response, e: Escenario, motivo: string) {
    const web = destinoWeb(r);
    expect(web.searchParams.get('google')).toBe('error');
    expect(web.searchParams.get('motivo')).toBe(motivo);
    sinSesion(r);
    expect(cookie(r, 'veto_google_pendiente')).toBeUndefined();
    expect(sesionesAbiertas(e)).toBe(0);
    expect(e.usuariosCreados).toHaveLength(0);
    expect(e.vinculos.size).toBeLessThanOrEqual(1);
    expect(e.pendientes.size).toBe(0);
  }

  it('la persona cancela en Google (access_denied)', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const google = simularGoogle(e);
    const { state, cookieEstado } = await iniciar(app, e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ error: 'access_denied', state })
      .set('Cookie', `veto_google_estado=${cookieEstado}`)
      .expect(302);
    await sinEfectos(r, e, 'cancelado');
    expect(google).not.toHaveBeenCalled();
    expect(e.estados.size).toBe(0);
    await app.close();
  });

  it.each(['server_error', 'temporarily_unavailable', 'invalid_request'])(
    'Google informa el error %s',
    async (error) => {
      const e = crearEscenario();
      const app = await nuevaApp(e);
      const google = simularGoogle(e);
      const { state, cookieEstado } = await iniciar(app, e);
      const r = await request(app.getHttpServer())
        .get('/api/identidad/google/callback')
        .query({ error, state })
        .set('Cookie', `veto_google_estado=${cookieEstado}`)
        .expect(302);
      await sinEfectos(r, e, 'proveedor');
      expect(google).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it('regreso sin código ni error', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const { state, cookieEstado } = await iniciar(app, e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ state })
      .set('Cookie', `veto_google_estado=${cookieEstado}`)
      .expect(302);
    await sinEfectos(r, e, 'proveedor');
    await app.close();
  });

  it.each([
    ['Google responde 400 al cambiar el código', { estado: 400 }],
    ['Google responde 500', { estado: 500 }],
    ['no hay red hacia Google', { falla: true }],
    ['la respuesta no es JSON', { cuerpo: undefined, estado: 200, texto: true }],
    ['la respuesta no trae id_token', { cuerpo: { access_token: 'x' } }],
    ['el id_token está mal formado', { cuerpo: { id_token: 'no-es-un-jwt' } }],
  ])('%s', async (_nombre, opciones) => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    if ('texto' in opciones) {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>', { status: 200 }));
    } else {
      simularGoogle(e, opciones as never);
    }
    const r = await ingresarConGoogle(app, e);
    await sinEfectos(r, e, 'proveedor');
    await app.close();
  });

  it.each([
    ['otro emisor', { iss: 'https://evil.example.com' }],
    ['otra aplicación (aud)', { aud: 'otro-cliente.apps.googleusercontent.com' }],
    ['id_token vencido', { exp: Math.floor(Date.now() / 1000) - 3600 }],
    ['nonce distinto (repetición)', { nonce: 'nonce-de-otro-intento' }],
    ['sin identificador (sub)', { sub: undefined }],
    ['sin correo', { email: undefined }],
  ])('id_token inválido: %s', async (_nombre, claims) => {
    const e = crearEscenario({ cuentas: [cuentaBase()] });
    const app = await nuevaApp(e);
    simularGoogle(e, { claims });
    const r = await ingresarConGoogle(app, e);
    await sinEfectos(r, e, 'proveedor');
    await app.close();
  });

  it('el correo de Google sin verificar se rechaza', async () => {
    const e = crearEscenario({ cuentas: [cuentaBase()] });
    const app = await nuevaApp(e);
    simularGoogle(e, { claims: { email_verified: false } });
    const r = await ingresarConGoogle(app, e);
    await sinEfectos(r, e, 'correo_no_verificado');
    await app.close();
  });

  it('acepta una audiencia con varios valores si incluye a Veto', async () => {
    const ana = cuentaBase();
    const e = crearEscenario({ cuentas: [ana], vinculos: { [SUB]: ana.id } });
    const app = await nuevaApp(e);
    simularGoogle(e, { claims: { aud: ['otro', ENV_GOOGLE.GOOGLE_CLIENT_ID] } });
    const r = await ingresarConGoogle(app, e);
    expect(destinoWeb(r).searchParams.get('google')).toBe('ok');
    await app.close();
  });

  it('el regreso debe salir del mismo navegador: sin cookie no hay intercambio', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const google = simularGoogle(e);
    const { state } = await iniciar(app, e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state })
      .expect(302);
    await sinEfectos(r, e, 'estado');
    expect(google).not.toHaveBeenCalled();
    // El intento sigue disponible para el navegador legítimo.
    expect(e.estados.size).toBe(1);
    await app.close();
  });

  it('un state ajeno (cookie de otro intento) se rechaza', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const google = simularGoogle(e);
    const propio = await iniciar(app, e);
    const ajeno = await iniciar(app, e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state: ajeno.state })
      .set('Cookie', `veto_google_estado=${propio.cookieEstado}`)
      .expect(302);
    await sinEfectos(r, e, 'estado');
    expect(google).not.toHaveBeenCalled();
    await app.close();
  });

  it('un state inventado o vencido se rechaza', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const google = simularGoogle(e);
    const inventado = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state: 'inventado' })
      .set('Cookie', 'veto_google_estado=inventado')
      .expect(302);
    await sinEfectos(inventado, e, 'estado');

    const { state, cookieEstado } = await iniciar(app, e);
    for (const fila of e.estados.values()) fila.expira = Date.now() - 1;
    const vencido = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state })
      .set('Cookie', `veto_google_estado=${cookieEstado}`)
      .expect(302);
    await sinEfectos(vencido, e, 'estado');
    expect(google).not.toHaveBeenCalled();
    await app.close();
  });

  it('parámetros con forma inesperada (code[]=...) no rompen ni abren sesión', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback?code[]=a&code[]=b&state[x]=1')
      .expect(302);
    await sinEfectos(r, e, 'estado');
    await app.close();
  });

  it('un fallo interno (base de datos) no abre sesión y vuelve a la web con error', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    simularGoogle(e);
    const { state, cookieEstado } = await iniciar(app, e);
    jest.spyOn(e.db, 'query').mockRejectedValue(new Error('base de datos caída'));
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state })
      .set('Cookie', `veto_google_estado=${cookieEstado}`)
      .expect(302);
    expect(destinoWeb(r).searchParams.get('google')).toBe('error');
    sinSesion(r);
    await app.close();
  });
});

describe('HU-003 · la cuenta existente se vincula de forma segura, sin duplicar usuarios', () => {
  async function llegarAVincular(extra: Partial<Cuenta> = {}) {
    const ana = cuentaBase(extra);
    const e = crearEscenario({ cuentas: [ana] });
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await ingresarConGoogle(app, e);
    const pendiente = valorCookie(r, 'veto_google_pendiente') ?? '';
    return { ana, e, app, r, cookiePendiente: `veto_google_pendiente=${pendiente}` };
  }

  it('un correo que ya tiene cuenta NO se vincula solo: pide demostrar que es suya', async () => {
    const { e, app, r, cookiePendiente } = await llegarAVincular();

    expect(destinoWeb(r).searchParams.get('google')).toBe('vincular');
    sinSesion(r);
    expect(sesionesAbiertas(e)).toBe(0);
    expect(e.vinculos.size).toBe(0);
    expect(e.usuariosCreados).toHaveLength(0);
    expect(cookie(r, 'veto_google_pendiente')).toContain('HttpOnly');

    const info = await request(app.getHttpServer())
      .get('/api/identidad/google/pendiente')
      .set('Cookie', cookiePendiente)
      .expect(200);
    expect(info.body).toEqual({
      pendiente: {
        tipo: 'VINCULAR',
        correo: 'ana@mail.com',
        nombre: 'Ana Google',
        requiereCodigo: false,
      },
    });
    await app.close();
  });

  it('con la contraseña correcta vincula, abre sesión y no crea otro usuario', async () => {
    const { ana, e, app, cookiePendiente } = await llegarAVincular();

    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: CONTRASENA })
      .expect(200);

    expect(r.body.usuario).toMatchObject({ id: ana.id, correo: 'ana@mail.com' });
    expect(r.body.usuario).not.toHaveProperty('password_hash');
    expect(cookie(r, 'veto_session')).toContain('HttpOnly');
    expect(cookie(r, 'veto_google_pendiente')).toContain('Max-Age=0');
    expect(e.usuariosCreados).toHaveLength(0);
    expect(e.cuentas).toHaveLength(1);
    expect(e.vinculos.get(SUB)).toBe(ana.id);
    expect(e.pendientes.size).toBe(0);

    // La solicitud es de un solo uso.
    await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: CONTRASENA })
      .expect(401);
    expect(sesionesAbiertas(e)).toBe(1);

    // A partir de ahora Google entra directo, sin duplicar la cuenta.
    simularGoogle(e);
    const siguiente = await ingresarConGoogle(app, e);
    expect(destinoWeb(siguiente).searchParams.get('google')).toBe('ok');
    expect(e.cuentas).toHaveLength(1);
    await app.close();
  });

  it('con una contraseña incorrecta no vincula ni abre sesión', async () => {
    const { e, app, cookiePendiente } = await llegarAVincular();
    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: 'otra-contrasena' })
      .expect(401);
    sinSesion(r);
    expect(e.vinculos.size).toBe(0);
    expect(sesionesAbiertas(e)).toBe(0);
    await app.close();
  });

  it('cinco contraseñas incorrectas invalidan la solicitud, aunque la sexta sea correcta', async () => {
    const { e, app, cookiePendiente } = await llegarAVincular();
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/identidad/google/vincular')
        .set('Cookie', cookiePendiente)
        .send({ contrasena: `mal-${i}` })
        .expect(401);
    }
    expect(e.pendientes.size).toBe(0);
    await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: CONTRASENA })
      .expect(401);
    expect(e.vinculos.size).toBe(0);
    expect(sesionesAbiertas(e)).toBe(0);
    await app.close();
  });

  it('una solicitud que ya agotó sus intentos no acepta ni la contraseña correcta', async () => {
    const { e, app, cookiePendiente } = await llegarAVincular();
    for (const p of e.pendientes.values()) p.intentos = 5;
    await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: CONTRASENA })
      .expect(401);
    expect(e.vinculos.size).toBe(0);
    expect(e.pendientes.size).toBe(0);
    expect(sesionesAbiertas(e)).toBe(0);
    await app.close();
  });

  it('sin la solicitud (sin cookie, inventada o vencida) no se puede vincular', async () => {
    const { e, app, cookiePendiente } = await llegarAVincular();
    await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .send({ contrasena: CONTRASENA })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', 'veto_google_pendiente=inventada')
      .send({ contrasena: CONTRASENA })
      .expect(401);
    for (const p of e.pendientes.values()) p.expira = Date.now() - 1;
    await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: CONTRASENA })
      .expect(401);
    expect(e.vinculos.size).toBe(0);
    await app.close();
  });

  it('la contraseña es obligatoria (400 con el campo)', async () => {
    const { app, cookiePendiente } = await llegarAVincular();
    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({})
      .expect(400);
    expect(r.body.errores.contrasena).toBe('La contraseña es obligatoria');
    await app.close();
  });

  describe('cuenta con verificación en dos pasos', () => {
    const secreto = generarSecretoTotp();
    const con2fa = { totp_secreto: secreto, totp_activado_en: new Date() };

    it('avisa que hace falta el código y lo exige para vincular', async () => {
      const { e, app, cookiePendiente } = await llegarAVincular(con2fa);
      const info = await request(app.getHttpServer())
        .get('/api/identidad/google/pendiente')
        .set('Cookie', cookiePendiente)
        .expect(200);
      expect(info.body.pendiente.requiereCodigo).toBe(true);

      const sinCodigo = await request(app.getHttpServer())
        .post('/api/identidad/google/vincular')
        .set('Cookie', cookiePendiente)
        .send({ contrasena: CONTRASENA })
        .expect(400);
      expect(sinCodigo.body.errores.codigo).toBe('Ingresa el código de Google Authenticator');

      const codigoMalo = generarCodigoTotp(secreto) === '000000' ? '111111' : '000000';
      await request(app.getHttpServer())
        .post('/api/identidad/google/vincular')
        .set('Cookie', cookiePendiente)
        .send({ contrasena: CONTRASENA, codigo: codigoMalo })
        .expect(401);
      expect(e.vinculos.size).toBe(0);

      await request(app.getHttpServer())
        .post('/api/identidad/google/vincular')
        .set('Cookie', cookiePendiente)
        .send({ contrasena: CONTRASENA, codigo: generarCodigoTotp(secreto) })
        .expect(200);
      expect(e.vinculos.get(SUB)).toBeDefined();
      await app.close();
    });
  });

  it('la solicitud puede descartarse', async () => {
    const { e, app, cookiePendiente } = await llegarAVincular();
    const r = await request(app.getHttpServer())
      .delete('/api/identidad/google/pendiente')
      .set('Cookie', cookiePendiente)
      .expect(204);
    expect(cookie(r, 'veto_google_pendiente')).toContain('Max-Age=0');
    expect(e.pendientes.size).toBe(0);
    await request(app.getHttpServer())
      .get('/api/identidad/google/pendiente')
      .set('Cookie', cookiePendiente)
      .expect(404);
    await app.close();
  });

  it('dos cuentas de Google no pueden quedar vinculadas a la misma cuenta (carrera) → 409', async () => {
    const { e, app, cookiePendiente } = await llegarAVincular();
    // Entre la solicitud y la confirmación otra cuenta de Google tomó esa cuenta de Veto.
    e.vinculos.set(SUB_OTRO, [...e.cuentas][0].id);
    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/vincular')
      .set('Cookie', cookiePendiente)
      .send({ contrasena: CONTRASENA })
      .expect(409);
    expect(r.body.message).toContain('ya está vinculada');
    expect(sesionesAbiertas(e)).toBe(0);
    await app.close();
  });

  it('el correo de Google se compara sin importar mayúsculas', async () => {
    const e = crearEscenario({ cuentas: [cuentaBase()] });
    const app = await nuevaApp(e);
    simularGoogle(e, { claims: { email: 'ANA@Mail.COM' } });
    const r = await ingresarConGoogle(app, e);
    expect(destinoWeb(r).searchParams.get('google')).toBe('vincular');
    expect(e.usuariosCreados).toHaveLength(0);
    await app.close();
  });

  it('una cuenta de Veto ya vinculada a otra cuenta de Google no se puede tomar', async () => {
    const ana = cuentaBase();
    const e = crearEscenario({ cuentas: [ana], vinculos: { [SUB_OTRO]: ana.id } });
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await ingresarConGoogle(app, e);
    expect(destinoWeb(r).searchParams.get('motivo')).toBe('cuenta_vinculada');
    sinSesion(r);
    expect(e.pendientes.size).toBe(0);
    expect(e.vinculos.size).toBe(1);
    await app.close();
  });

  it.each([
    ['suspendida', { estado: 'SUSPENDIDA' }],
    ['eliminada', { estado: 'ELIMINADA', eliminado_en: new Date() }],
  ])('una cuenta %s no abre sesión ni se vincula', async (_nombre, extra) => {
    const ana = cuentaBase(extra);
    for (const vinculada of [true, false]) {
      const e = crearEscenario({ cuentas: [ana], vinculos: vinculada ? { [SUB]: ana.id } : {} });
      const app = await nuevaApp(e);
      simularGoogle(e);
      const r = await ingresarConGoogle(app, e);
      expect(destinoWeb(r).searchParams.get('motivo')).toBe('cuenta_inactiva');
      sinSesion(r);
      expect(sesionesAbiertas(e)).toBe(0);
      expect(e.pendientes.size).toBe(0);
      expect(e.usuariosCreados).toHaveLength(0);
      await app.close();
    }
  });
});

describe('HU-003 · primera vez con Google: se crea una sola cuenta', () => {
  async function llegarARegistro() {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    simularGoogle(e, { claims: { email: 'nuevo@mail.com', name: 'Nuevo Usuario' } });
    const r = await ingresarConGoogle(app, e);
    const pendiente = valorCookie(r, 'veto_google_pendiente') ?? '';
    return { e, app, r, cookiePendiente: `veto_google_pendiente=${pendiente}` };
  }

  it('sin cuenta previa pide el celular antes de crear nada', async () => {
    const { e, app, r, cookiePendiente } = await llegarARegistro();
    expect(destinoWeb(r).searchParams.get('google')).toBe('registro');
    sinSesion(r);
    expect(e.usuariosCreados).toHaveLength(0);
    const info = await request(app.getHttpServer())
      .get('/api/identidad/google/pendiente')
      .set('Cookie', cookiePendiente)
      .expect(200);
    expect(info.body.pendiente).toEqual({
      tipo: 'REGISTRO',
      correo: 'nuevo@mail.com',
      nombre: 'Nuevo Usuario',
    });
    await app.close();
  });

  it('crea la cuenta de tutor con el celular, la vincula y abre sesión', async () => {
    const { e, app, cookiePendiente } = await llegarARegistro();
    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', cookiePendiente)
      .send({ celular: '3109998877' })
      .expect(201);

    expect(r.body.usuario).toMatchObject({
      nombre: 'Nuevo Usuario',
      correo: 'nuevo@mail.com',
      celular: '3109998877',
      rol: 'TUTOR',
    });
    expect(cookie(r, 'veto_session')).toContain('HttpOnly');
    expect(e.cuentas).toHaveLength(1);
    expect(e.vinculos.get(SUB)).toBe(e.cuentas[0].id);
    expect(e.pendientes.size).toBe(0);
    // La contraseña de una cuenta de Google no sirve para iniciar sesión con correo.
    expect(e.cuentas[0].password_hash).toBe('GOOGLE');

    // Repetir la solicitud no duplica la cuenta.
    await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', cookiePendiente)
      .send({ celular: '3109998877' })
      .expect(401);
    expect(e.cuentas).toHaveLength(1);
    await app.close();
  });

  it('un celular inválido se rechaza sin gastar la solicitud', async () => {
    const { e, app, cookiePendiente } = await llegarARegistro();
    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', cookiePendiente)
      .send({ celular: '123' })
      .expect(400);
    expect(r.body.errores.celular).toBe('El celular debe tener 10 dígitos');
    expect(e.pendientes.size).toBe(1);
    expect(e.usuariosCreados).toHaveLength(0);
    await app.close();
  });

  it('sin solicitud no se crea ninguna cuenta', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .send({ celular: '3109998877' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', 'veto_google_pendiente=inventada')
      .send({ celular: '3109998877' })
      .expect(401);
    expect(e.usuariosCreados).toHaveLength(0);
    await app.close();
  });

  it('una solicitud de vincular no sirve para crear cuentas', async () => {
    const e = crearEscenario({ cuentas: [cuentaBase()] });
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await ingresarConGoogle(app, e);
    await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', `veto_google_pendiente=${valorCookie(r, 'veto_google_pendiente')}`)
      .send({ celular: '3109998877' })
      .expect(401);
    expect(e.usuariosCreados).toHaveLength(0);
    await app.close();
  });

  it('si el correo se registró mientras tanto responde 409 y no duplica', async () => {
    const { e, app, cookiePendiente } = await llegarARegistro();
    e.cuentas.push(
      cuentaBase({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', correo: 'nuevo@mail.com' }),
    );
    const r = await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', cookiePendiente)
      .send({ celular: '3109998877' })
      .expect(409);
    expect(r.body.message).toContain('Ya existe una cuenta');
    expect(e.cuentas).toHaveLength(1);
    expect(e.vinculos.size).toBe(0);
    await app.close();
  });

  it('el nombre falta en Google: se usa la parte local del correo', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    simularGoogle(e, { claims: { email: 'sin.nombre@mail.com', name: undefined } });
    const r = await ingresarConGoogle(app, e);
    const info = await request(app.getHttpServer())
      .get('/api/identidad/google/pendiente')
      .set('Cookie', `veto_google_pendiente=${valorCookie(r, 'veto_google_pendiente')}`)
      .expect(200);
    expect(info.body.pendiente.nombre).toBe('sin.nombre');
    await app.close();
  });

  it('quien se registró con Google no puede entrar con correo y contraseña', async () => {
    const { e, app, cookiePendiente } = await llegarARegistro();
    await request(app.getHttpServer())
      .post('/api/identidad/google/completar')
      .set('Cookie', cookiePendiente)
      .send({ celular: '3109998877' })
      .expect(201);
    const { db } = crearBdFalsa((sql) => {
      if (sql.includes('FROM usuario') && sql.includes('password_hash')) {
        return { rows: [{ ...e.cuentas[0] }] };
      }
    }, null);
    const app2 = await crearApp([IdentidadModule], db);
    for (const contrasena of ['GOOGLE', 'cualquiera123']) {
      await request(app2.getHttpServer())
        .post('/api/identidad/login')
        .send({ correo: 'nuevo@mail.com', contrasena })
        .expect(401);
    }
    await app2.close();
    await app.close();
  });

  it('GET /pendiente sin solicitud responde 404', async () => {
    const e = crearEscenario();
    const app = await nuevaApp(e);
    await request(app.getHttpServer()).get('/api/identidad/google/pendiente').expect(404);
    await app.close();
  });
});

// ---------- Reautenticación con Google para acciones delicadas ----------

describe('HU-003 · quien entra solo con Google confirma volviendo a Google', () => {
  const SOFI_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const sofi = (extra: Partial<Cuenta> = {}) =>
    cuentaBase({
      id: SOFI_ID,
      nombre: 'Sofía',
      correo: 'sofi@mail.com',
      password_hash: 'GOOGLE',
      ...extra,
    });
  const sesionDeSofi: UsuarioPrueba = {
    id: SOFI_ID,
    nombre: 'Sofía',
    correo: 'sofi@mail.com',
    celular: '3001112233',
    rol: 'TUTOR',
  };

  function conSofi(extra: Partial<Cuenta> = {}) {
    return crearEscenario({
      cuentas: [sofi(extra)],
      vinculos: { [SUB]: SOFI_ID },
      sesion: sesionDeSofi,
    });
  }

  /** Pasos 1 y 2 de la reautenticación: va a Google (con la sesión abierta) y vuelve. */
  async function reautenticar(
    app: INestApplication,
    e: Escenario,
    opciones: { cookieSesion?: string; callback?: Record<string, string> } = {},
  ) {
    const inicio = await request(app.getHttpServer())
      .get('/api/identidad/google/reautenticar')
      .set('Cookie', COOKIE)
      .expect(302);
    const destino = new URL(inicio.headers.location);
    e.registro.ultimoReto = destino.searchParams.get('code_challenge') ?? '';
    const state = destino.searchParams.get('state') ?? '';
    const cookies = [`veto_google_estado=${valorCookie(inicio, 'veto_google_estado')}`];
    if (opciones.cookieSesion !== '') cookies.push(opciones.cookieSesion ?? COOKIE);
    return request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state, ...opciones.callback })
      .set('Cookie', cookies.join('; '))
      .expect(302);
  }

  const eliminar = (app: INestApplication, cookies: string, cuerpo: object) =>
    request(app.getHttpServer()).delete('/api/identidad/me').set('Cookie', cookies).send(cuerpo);

  it('GET /google/estado indica cómo confirmar: sin contraseña o con contraseña', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/estado')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r.body).toEqual({ vinculada: true, sinContrasena: true });
    await app.close();

    const ana = cuentaBase({ id: SOFI_ID });
    const conPass = crearEscenario({
      cuentas: [ana],
      vinculos: { [SUB]: SOFI_ID },
      sesion: sesionDeSofi,
    });
    const app2 = await nuevaApp(conPass);
    const r2 = await request(app2.getHttpServer())
      .get('/api/identidad/google/estado')
      .set('Cookie', COOKIE)
      .expect(200);
    expect(r2.body).toEqual({ vinculada: true, sinContrasena: false });
    await app2.close();
  });

  it('las rutas de reautenticación exigen sesión', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    await request(app.getHttpServer()).get('/api/identidad/google/estado').expect(401);
    await request(app.getHttpServer()).get('/api/identidad/google/reautenticar').expect(401);
    expect(e.estados.size).toBe(0);
    await app.close();
  });

  it('manda a Google pidiendo las credenciales de nuevo y con la cuenta esperada', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/reautenticar')
      .set('Cookie', COOKIE)
      .expect(302);
    const p = new URL(r.headers.location).searchParams;
    expect(p.get('prompt')).toBe('login');
    expect(p.get('max_age')).toBe('0');
    expect(p.get('login_hint')).toBe('sofi@mail.com');
    expect(p.get('code_challenge_method')).toBe('S256');
    expect(cookie(r, 'veto_google_estado')).toContain('HttpOnly');
    // El intento queda amarrado al usuario que lo pidió.
    expect([...e.estados.values()][0].usuario_id).toBe(SOFI_ID);
    await app.close();
  });

  it('el inicio de sesión normal no queda asociado a ningún usuario', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    await iniciar(app, e);
    expect([...e.estados.values()][0].usuario_id).toBeNull();
    await app.close();
  });

  it('sin Google configurado vuelve a la web con no_disponible', async () => {
    const e = conSofi();
    const app = await nuevaApp(e, false);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/reautenticar')
      .set('Cookie', COOKIE)
      .expect(302);
    expect(destinoWeb(r).searchParams.get('motivo')).toBe('no_disponible');
    await app.close();
  });

  it('una cuenta que no está vinculada a Google no puede reautenticar', async () => {
    const e = crearEscenario({ cuentas: [sofi()], sesion: sesionDeSofi });
    const app = await nuevaApp(e);
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/reautenticar')
      .set('Cookie', COOKIE)
      .expect(302);
    expect(destinoWeb(r).searchParams.get('motivo')).toBe('cuenta_distinta');
    expect(e.estados.size).toBe(0);
    await app.close();
  });

  it('al volver de Google emite una constancia de 5 minutos, de un solo uso, sin abrir otra sesión', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    simularGoogle(e, { claims: { email: 'sofi@mail.com' } });

    const r = await reautenticar(app, e);

    expect(destinoWeb(r).searchParams.get('google')).toBe('reauth');
    const constancia = cookie(r, 'veto_reauth') ?? '';
    expect(constancia).toContain('HttpOnly');
    expect(constancia).toContain('Path=/api/identidad');
    expect(constancia).toContain('Max-Age=300');
    expect(destinoWeb(r).toString()).not.toContain(valorCookie(r, 'veto_reauth') ?? 'x');
    sinSesion(r);
    expect(sesionesAbiertas(e)).toBe(0);
    expect(e.reautenticaciones.size).toBe(1);
    expect([...e.reautenticaciones.keys()][0]).toMatch(/^[0-9a-f]{64}$/);
    await app.close();
  });

  it('con la constancia se elimina la cuenta sin contraseña, y la constancia se gasta', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await reautenticar(app, e);
    const cookies = `${COOKIE}; veto_reauth=${valorCookie(r, 'veto_reauth')}`;

    const baja = await eliminar(app, cookies, { confirmacion: 'ELIMINAR' }).expect(200);

    expect(baja.body.mensaje).toMatch(/eliminada/);
    const limpias = cookiesDe(baja);
    expect(limpias[0]).toContain('veto_session=');
    expect(limpias[0]).toContain('Max-Age=0');
    expect(limpias.find((c) => c.startsWith('veto_reauth='))).toContain('Max-Age=0');
    expect(e.bajas).toHaveLength(1);
    expect(e.reautenticaciones.size).toBe(0);

    // Repetir con la misma constancia ya no sirve (se reactiva la cuenta solo para esta comprobación).
    e.cuentas[0].estado = 'ACTIVA';
    const repetido = await eliminar(app, cookies, { confirmacion: 'ELIMINAR' }).expect(401);
    expect(repetido.body.requiereReautenticacion).toBe(true);
    expect(e.bajas).toHaveLength(1);
    await app.close();
  });

  it('sin constancia responde 401 con requiereReautenticacion y no elimina', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    const r = await eliminar(app, COOKIE, { confirmacion: 'ELIMINAR' }).expect(401);
    expect(r.body).toMatchObject({
      statusCode: 401,
      message: 'Confirma tu identidad con Google para eliminar la cuenta',
      requiereReautenticacion: true,
    });
    expect(e.bajas).toHaveLength(0);
    await app.close();
  });

  it('la contraseña "GOOGLE" no sirve para eliminar la cuenta', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    for (const contrasena of ['GOOGLE', 'cualquiera']) {
      await eliminar(app, COOKIE, { contrasena, confirmacion: 'ELIMINAR' }).expect(401);
    }
    expect(e.bajas).toHaveLength(0);
    await app.close();
  });

  it('una constancia inventada, vencida o de otra cuenta no sirve', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await reautenticar(app, e);
    const token = valorCookie(r, 'veto_reauth');

    await eliminar(app, `${COOKIE}; veto_reauth=inventada`, { confirmacion: 'ELIMINAR' }).expect(
      401,
    );

    for (const t of e.reautenticaciones.values()) t.expira = Date.now() - 1;
    await eliminar(app, `${COOKIE}; veto_reauth=${token}`, { confirmacion: 'ELIMINAR' }).expect(
      401,
    );

    for (const t of e.reautenticaciones.values()) {
      t.expira = Date.now() + 60_000;
      t.usuario_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    }
    await eliminar(app, `${COOKIE}; veto_reauth=${token}`, { confirmacion: 'ELIMINAR' }).expect(
      401,
    );
    expect(e.bajas).toHaveLength(0);
    await app.close();
  });

  it('además de la constancia sigue siendo obligatorio escribir ELIMINAR', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await reautenticar(app, e);
    await eliminar(app, `${COOKIE}; veto_reauth=${valorCookie(r, 'veto_reauth')}`, {}).expect(400);
    expect(e.bajas).toHaveLength(0);
    expect(e.reautenticaciones.size).toBe(1);
    await app.close();
  });

  it('otra cuenta de Google (o una no vinculada) no obtiene constancia', async () => {
    for (const sub of [SUB_OTRO, 'sub-desconocido']) {
      const e = crearEscenario({
        cuentas: [sofi(), cuentaBase()],
        vinculos: { [SUB]: SOFI_ID, [SUB_OTRO]: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        sesion: sesionDeSofi,
      });
      const app = await nuevaApp(e);
      simularGoogle(e, { claims: { sub } });
      const r = await reautenticar(app, e);
      expect(destinoWeb(r).searchParams.get('google')).toBe('error');
      expect(destinoWeb(r).searchParams.get('motivo')).toBe('cuenta_distinta');
      expect(cookie(r, 'veto_reauth')).toBeUndefined();
      expect(e.reautenticaciones.size).toBe(0);
      await app.close();
    }
  });

  it('si la sesión ya no está abierta al volver de Google, no hay constancia', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    simularGoogle(e);
    const r = await reautenticar(app, e, { cookieSesion: '' });
    expect(destinoWeb(r).searchParams.get('motivo')).toBe('estado');
    expect(cookie(r, 'veto_reauth')).toBeUndefined();
    expect(e.reautenticaciones.size).toBe(0);
    await app.close();
  });

  it('si al volver hay otra sesión distinta a la que inició el intento, no hay constancia', async () => {
    const e = crearEscenario({
      cuentas: [sofi()],
      vinculos: { [SUB]: SOFI_ID },
      sesion: { ...sesionDeSofi, id: 'ffffffff-ffff-4fff-8fff-ffffffffffff' },
    });
    const app = await nuevaApp(e);
    // Quien inició el intento era Sofía, pero la sesión del navegador al volver es de otra persona.
    simularGoogle(e);
    e.estados.set(hashSesion('manual'), {
      nonce: 'n',
      code_verifier: 'v',
      usuario_id: SOFI_ID,
      expira: Date.now() + 60_000,
    });
    const r = await request(app.getHttpServer())
      .get('/api/identidad/google/callback')
      .query({ code: 'codigo-de-google', state: 'manual' })
      .set('Cookie', 'veto_google_estado=manual; veto_session=token-de-prueba')
      .expect(302);
    expect(cookie(r, 'veto_reauth')).toBeUndefined();
    expect(e.reautenticaciones.size).toBe(0);
    await app.close();
  });

  it('cancelar o fallar en Google durante la reautenticación no emite constancia', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    const google = simularGoogle(e);
    const r = await reautenticar(app, e, { callback: { error: 'access_denied' } });
    expect(destinoWeb(r).searchParams.get('motivo')).toBe('cancelado');
    expect(cookie(r, 'veto_reauth')).toBeUndefined();
    expect(e.reautenticaciones.size).toBe(0);
    expect(google).not.toHaveBeenCalled();
    await app.close();
  });

  it('las cuentas con contraseña siguen eliminándose con la contraseña', async () => {
    const ana = cuentaBase({ id: SOFI_ID });
    const e = crearEscenario({ cuentas: [ana], sesion: sesionDeSofi });
    const app = await nuevaApp(e);
    const sinClave = await eliminar(app, COOKIE, { confirmacion: 'ELIMINAR' }).expect(400);
    expect(sinClave.body.errores.contrasena).toBe('La contraseña es obligatoria');
    await eliminar(app, COOKIE, { contrasena: 'incorrecta', confirmacion: 'ELIMINAR' }).expect(401);
    expect(e.bajas).toHaveLength(0);
    await eliminar(app, COOKIE, { contrasena: CONTRASENA, confirmacion: 'ELIMINAR' }).expect(200);
    expect(e.bajas).toHaveLength(1);
    await app.close();
  });

  it('el correo de una cuenta creada con Google no se cambia: responde 403 con el motivo', async () => {
    const e = conSofi();
    const app = await nuevaApp(e);
    const r = await request(app.getHttpServer())
      .patch('/api/identidad/me')
      .set('Cookie', COOKIE)
      .send({ correo: 'otro@mail.com', contrasenaActual: 'GOOGLE' })
      .expect(403);
    expect(r.body.message).toContain('entra con Google');
    await app.close();
  });
});
