import { Inject, Injectable } from '@nestjs/common';
import type { MotivoErrorGoogle } from '@veto/shared';
import { ENV, type Env } from '../../config/env';

const URL_AUTORIZACION = 'https://accounts.google.com/o/oauth2/v2/auth';
const URL_TOKEN = 'https://oauth2.googleapis.com/token';
const EMISORES = ['https://accounts.google.com', 'accounts.google.com'];
const TIEMPO_MAXIMO_MS = 10_000;
const MARGEN_RELOJ_S = 60;

/** Lo que Veto necesita saber de la cuenta de Google que se autenticó. */
export type PerfilGoogle = { sub: string; correo: string; nombre: string };

/** Falla del proveedor o respuesta que no se puede aceptar: nunca abre una sesión. */
export class ErrorGoogle extends Error {
  constructor(
    readonly motivo: Extract<MotivoErrorGoogle, 'proveedor' | 'correo_no_verificado'>,
    detalle: string,
  ) {
    super(detalle);
  }
}

/**
 * Habla con Google (HU-003). Flujo de código de autorización con PKCE: la API manda a la
 * persona a Google, Google la devuelve con un `code` de un solo uso y la API lo cambia por un
 * `id_token` directamente con Google (servidor a servidor, con el secreto del cliente).
 */
@Injectable()
export class GoogleOAuthClient {
  constructor(@Inject(ENV) private readonly env: Env) {}

  get disponible(): boolean {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);
  }

  /** A dónde vuelve la persona a la web (siempre el origen configurado, nunca uno recibido). */
  get urlWeb(): string {
    return this.env.WEB_ORIGIN.replace(/\/+$/, '');
  }

  private get urlRetorno(): string {
    return (
      this.env.GOOGLE_REDIRECT_URI ??
      `http://localhost:${this.env.API_PORT}/api/identidad/google/callback`
    );
  }

  /**
   * `reautenticar` obliga a Google a pedir las credenciales de nuevo (aunque la sesión de Google
   * siga abierta) y sugiere la cuenta esperada con `login_hint`.
   */
  urlDeAutorizacion(datos: {
    state: string;
    nonce: string;
    codeChallenge: string;
    reautenticar?: { correo: string };
  }): string {
    const parametros = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID ?? '',
      redirect_uri: this.urlRetorno,
      response_type: 'code',
      scope: 'openid email profile',
      state: datos.state,
      nonce: datos.nonce,
      code_challenge: datos.codeChallenge,
      code_challenge_method: 'S256',
      prompt: datos.reautenticar ? 'login' : 'select_account',
    });
    if (datos.reautenticar) {
      parametros.set('max_age', '0');
      parametros.set('login_hint', datos.reautenticar.correo);
    }
    return `${URL_AUTORIZACION}?${parametros.toString()}`;
  }

  /**
   * Cambia el `code` por el `id_token` y valida sus datos. Lanza `ErrorGoogle` ante cualquier
   * problema: respuesta de error, token mal formado, otra audiencia, vencido, otro `nonce` o
   * correo sin verificar.
   *
   * La firma del `id_token` no se verifica porque llega directamente de Google por TLS desde
   * su endpoint de tokens, autenticado con el secreto del cliente (OpenID Connect Core §3.1.3.7).
   */
  async identificar(codigo: string, codeVerifier: string, nonce: string): Promise<PerfilGoogle> {
    let respuesta: Response;
    try {
      respuesta = await fetch(URL_TOKEN, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          code: codigo,
          client_id: this.env.GOOGLE_CLIENT_ID ?? '',
          client_secret: this.env.GOOGLE_CLIENT_SECRET ?? '',
          redirect_uri: this.urlRetorno,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
    } catch {
      throw new ErrorGoogle('proveedor', 'No se pudo contactar a Google');
    }
    if (!respuesta.ok) throw new ErrorGoogle('proveedor', `Google respondió ${respuesta.status}`);

    let idToken: unknown;
    try {
      idToken = ((await respuesta.json()) as { id_token?: unknown }).id_token;
    } catch {
      throw new ErrorGoogle('proveedor', 'Respuesta de Google ilegible');
    }
    return this.validarIdToken(idToken, nonce);
  }

  private validarIdToken(idToken: unknown, nonce: string): PerfilGoogle {
    if (typeof idToken !== 'string') throw new ErrorGoogle('proveedor', 'Falta el id_token');
    const partes = idToken.split('.');
    if (partes.length !== 3) throw new ErrorGoogle('proveedor', 'id_token mal formado');

    let datos: Record<string, unknown>;
    try {
      const decodificado: unknown = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
      if (typeof decodificado !== 'object' || decodificado === null) throw new Error();
      datos = decodificado as Record<string, unknown>;
    } catch {
      throw new ErrorGoogle('proveedor', 'id_token ilegible');
    }

    const audiencia = Array.isArray(datos.aud) ? datos.aud : [datos.aud];
    if (typeof datos.iss !== 'string' || !EMISORES.includes(datos.iss)) {
      throw new ErrorGoogle('proveedor', 'Emisor del id_token inválido');
    }
    if (!audiencia.includes(this.env.GOOGLE_CLIENT_ID)) {
      throw new ErrorGoogle('proveedor', 'El id_token es de otra aplicación');
    }
    if (typeof datos.exp !== 'number' || datos.exp + MARGEN_RELOJ_S < Date.now() / 1000) {
      throw new ErrorGoogle('proveedor', 'El id_token venció');
    }
    if (datos.nonce !== nonce) throw new ErrorGoogle('proveedor', 'El nonce no coincide');
    if (typeof datos.sub !== 'string' || datos.sub === '' || datos.sub.length > 255) {
      throw new ErrorGoogle('proveedor', 'El id_token no trae identificador');
    }
    if (typeof datos.email !== 'string' || !datos.email.includes('@')) {
      throw new ErrorGoogle('proveedor', 'El id_token no trae correo');
    }
    if (datos.email_verified !== true && datos.email_verified !== 'true') {
      throw new ErrorGoogle('correo_no_verificado', 'Google no verificó el correo');
    }

    const correo = datos.email.trim().toLowerCase();
    const nombre = typeof datos.name === 'string' ? datos.name.trim() : '';
    return { sub: datos.sub, correo, nombre: (nombre || correo.split('@')[0]).slice(0, 120) };
  }
}
