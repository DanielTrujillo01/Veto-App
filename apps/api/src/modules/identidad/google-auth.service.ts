import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type {
  CompletarGoogle,
  EstadoGoogle,
  MotivoErrorGoogle,
  PendienteGoogle,
  PerfilUsuario,
  VincularGoogle,
} from '@veto/shared';
import { esErrorPg, PG } from '../../common/validacion';
import { DatabaseService } from '../../database/database.service';
import { ErrorGoogle, GoogleOAuthClient, type PerfilGoogle } from './google-oauth.cliente';
import { CONTRASENA_GOOGLE, IdentidadService } from './identidad.service';
import { hashSesion, verificarCodigoTotp, verificarContrasena } from './seguridad';

export const COOKIE_GOOGLE_ESTADO = 'veto_google_estado';
export const COOKIE_GOOGLE_PENDIENTE = 'veto_google_pendiente';
export const VIGENCIA_GOOGLE_S = 10 * 60;

/** Cuánto vale la constancia de haber vuelto a pasar por Google (eliminar cuenta). */
export const VIGENCIA_REAUTENTICACION_S = 5 * 60;

const VIGENCIA_GOOGLE_MS = VIGENCIA_GOOGLE_S * 1000;
const MAX_INTENTOS = 5;

type CuentaPuntual = PerfilUsuario & {
  totp_secreto: string | null;
  totp_activado_en: Date | null;
};
type CuentaConEstado = CuentaPuntual & {
  estado: string;
  eliminado_en: Date | null;
  google_vinculada?: boolean;
};

const COLUMNAS_CUENTA = `u.id, u.nombre, u.celular, u.correo, u.rol, u.estado, u.eliminado_en,
                         u.totp_secreto, u.totp_activado_en`;

/** Cómo termina el regreso desde Google; el controlador lo traduce a cookies y a una redirección. */
export type ResultadoRetorno =
  | { resultado: 'ok'; token: string }
  | { resultado: '2fa'; desafio: string }
  | { resultado: 'vincular' | 'registro'; pendiente: string }
  | { resultado: 'reauth'; token: string }
  | { resultado: 'error'; motivo: MotivoErrorGoogle };

const error = (motivo: MotivoErrorGoogle): ResultadoRetorno => ({ resultado: 'error', motivo });
const aleatorio = (bytes: number) => randomBytes(bytes).toString('base64url');

function iguales(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * HU-003: inicio de sesión con Google.
 *
 * Reglas de seguridad:
 *  - El intento (state, nonce, PKCE) se guarda en la base, se amarra al navegador con una cookie
 *    y se consume una sola vez: no se puede repetir ni completar desde otro navegador.
 *  - Cancelar, rechazar o fallar en Google nunca abre una sesión.
 *  - La cuenta de Google se identifica por su `sub`, no por el correo.
 *  - Un correo que ya tiene cuenta en Veto NO se vincula solo por coincidir: quien llega con
 *    Google debe demostrar que la cuenta es suya con su contraseña (y su código 2FA si lo tiene).
 *    Así nadie se apropia de una cuenta ajena registrada antes con ese correo.
 *  - Si no hay cuenta, se crea una sola vez (celular incluido) y una cuenta de Google solo
 *    puede estar vinculada a una cuenta de Veto, y viceversa.
 *  - Si la cuenta tiene 2FA activa, Google no la salta.
 *  - Quien entra solo con Google no tiene contraseña: para acciones delicadas (eliminar la cuenta)
 *    vuelve a pasar por Google (`prompt=login`) y recibe una constancia de 5 minutos y de un
 *    solo uso. Solo se emite si es la misma cuenta de Google vinculada y la sesión sigue abierta.
 */
@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly identidad: IdentidadService,
    private readonly google: GoogleOAuthClient,
  ) {}

  /** Prepara el intento y devuelve la URL de Google y el `state` que va en la cookie. */
  async iniciar(): Promise<{ url: string; state: string }> {
    return this.prepararIntento(null);
  }

  /** Cómo debe confirmar una acción delicada esta cuenta: con contraseña o volviendo a Google. */
  async estadoDeCuenta(usuarioId: string): Promise<EstadoGoogle> {
    const r = await this.db.query<{ vinculada: boolean; sin_contrasena: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM cuenta_google g WHERE g.usuario_id = u.id) AS vinculada,
              (u.password_hash = $2) AS sin_contrasena
         FROM usuario u
        WHERE u.id = $1 AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL`,
      [usuarioId, CONTRASENA_GOOGLE],
    );
    const fila = r.rows[0];
    if (!fila) throw new NotFoundException('La cuenta no existe');
    return { vinculada: fila.vinculada, sinContrasena: fila.sin_contrasena };
  }

  /** Igual que `iniciar`, pero para volver a comprobar a una persona con la sesión abierta. */
  async iniciarReautenticacion(usuarioId: string): Promise<{ url: string; state: string }> {
    const r = await this.db.query<{ correo: string }>(
      `SELECT g.correo
         FROM cuenta_google g JOIN usuario u ON u.id = g.usuario_id
        WHERE g.usuario_id = $1 AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL`,
      [usuarioId],
    );
    if (!r.rows[0]) throw new ConflictException('Tu cuenta no está vinculada a Google');
    return this.prepararIntento(usuarioId, r.rows[0].correo);
  }

  private async prepararIntento(
    usuarioId: string | null,
    correoEsperado?: string,
  ): Promise<{ url: string; state: string }> {
    await this.db.query('DELETE FROM google_estado_oauth WHERE expira_en < now()');
    const state = aleatorio(32);
    const nonce = aleatorio(32);
    const codeVerifier = aleatorio(48);
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    await this.db.query(
      `INSERT INTO google_estado_oauth (state_hash, nonce, code_verifier, usuario_id, expira_en)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        hashSesion(state),
        nonce,
        codeVerifier,
        usuarioId,
        new Date(Date.now() + VIGENCIA_GOOGLE_MS),
      ],
    );
    const url = this.google.urlDeAutorizacion({
      state,
      nonce,
      codeChallenge,
      reautenticar: correoEsperado === undefined ? undefined : { correo: correoEsperado },
    });
    return { url, state };
  }

  /** Atiende el regreso desde Google (éxito, cancelación o error del proveedor). */
  async procesarRetorno(
    datos: { code?: string; state?: string; error?: string },
    estadoCookie: string | undefined,
    cookieDeSesion?: string,
  ): Promise<ResultadoRetorno> {
    if (!datos.state || !estadoCookie || !iguales(datos.state, estadoCookie))
      return error('estado');
    const intento = await this.db.query<{
      nonce: string;
      code_verifier: string;
      usuario_id: string | null;
    }>(
      `DELETE FROM google_estado_oauth
        WHERE state_hash = $1 AND expira_en > now()
        RETURNING nonce, code_verifier, usuario_id`,
      [hashSesion(datos.state)],
    );
    const guardado = intento.rows[0];
    if (!guardado) return error('estado');

    if (datos.error) return error(datos.error === 'access_denied' ? 'cancelado' : 'proveedor');
    if (!datos.code) return error('proveedor');

    let perfil: PerfilGoogle;
    try {
      perfil = await this.google.identificar(datos.code, guardado.code_verifier, guardado.nonce);
    } catch (fallo) {
      if (fallo instanceof ErrorGoogle) return error(fallo.motivo);
      throw fallo;
    }
    if (guardado.usuario_id) {
      return this.resolverReautenticacion(perfil, guardado.usuario_id, cookieDeSesion);
    }
    return this.resolverCuenta(perfil);
  }

  /**
   * La persona volvió de Google para confirmar una acción delicada. La constancia solo se emite
   * si la sesión que inició el intento sigue abierta (el encabezado `Cookie` trae esa sesión) y
   * la cuenta de Google es la que está vinculada a esa cuenta de Veto.
   */
  private async resolverReautenticacion(
    perfil: PerfilGoogle,
    usuarioId: string,
    cookieDeSesion: string | undefined,
  ): Promise<ResultadoRetorno> {
    const sesion = await this.identidad.usuarioDeSesion(cookieDeSesion);
    if (!sesion || sesion.id !== usuarioId) return error('estado');

    const vinculo = await this.db.query<{ usuario_id: string }>(
      'SELECT usuario_id FROM cuenta_google WHERE google_sub = $1',
      [perfil.sub],
    );
    if (vinculo.rows[0]?.usuario_id !== usuarioId) return error('cuenta_distinta');

    const token = aleatorio(32);
    await this.db.query(
      'DELETE FROM google_reautenticacion WHERE usuario_id = $1 OR expira_en < now()',
      [usuarioId],
    );
    await this.db.query(
      `INSERT INTO google_reautenticacion (token_hash, usuario_id, expira_en)
       VALUES ($1, $2, $3)`,
      [hashSesion(token), usuarioId, new Date(Date.now() + VIGENCIA_REAUTENTICACION_S * 1000)],
    );
    return { resultado: 'reauth', token };
  }

  private async resolverCuenta(perfil: PerfilGoogle): Promise<ResultadoRetorno> {
    const vinculada = await this.db.query<CuentaConEstado>(
      `SELECT ${COLUMNAS_CUENTA}
         FROM cuenta_google g JOIN usuario u ON u.id = g.usuario_id
        WHERE g.google_sub = $1`,
      [perfil.sub],
    );
    if (vinculada.rows[0]) {
      const cuenta = vinculada.rows[0];
      if (!this.estaActiva(cuenta)) return error('cuenta_inactiva');
      const sesion = await this.identidad.abrirSesionOExigir2fa(this.soloCuenta(cuenta));
      return 'requiere2fa' in sesion
        ? { resultado: '2fa', desafio: sesion.desafio }
        : { resultado: 'ok', token: sesion.token };
    }

    const existente = await this.db.query<CuentaConEstado>(
      `SELECT ${COLUMNAS_CUENTA},
              EXISTS (SELECT 1 FROM cuenta_google g WHERE g.usuario_id = u.id) AS google_vinculada
         FROM usuario u
        WHERE u.correo = $1`,
      [perfil.correo],
    );
    const cuenta = existente.rows[0];
    if (!cuenta) {
      return { resultado: 'registro', pendiente: await this.crearPendiente('REGISTRO', perfil) };
    }
    if (!this.estaActiva(cuenta)) return error('cuenta_inactiva');
    if (cuenta.google_vinculada) return error('cuenta_vinculada');
    return {
      resultado: 'vincular',
      pendiente: await this.crearPendiente('VINCULAR', perfil, cuenta.id),
    };
  }

  /** Qué le falta a la persona que volvió de Google (para que la web muestre el paso correcto). */
  async consultarPendiente(token: string | undefined): Promise<PendienteGoogle> {
    const r = await this.db.query<{
      tipo: 'VINCULAR' | 'REGISTRO';
      correo: string;
      nombre: string;
      requiere_codigo: boolean | null;
    }>(
      `SELECT p.tipo, p.correo, p.nombre, (u.totp_activado_en IS NOT NULL) AS requiere_codigo
         FROM google_pendiente p LEFT JOIN usuario u ON u.id = p.usuario_id
        WHERE p.token_hash = $1 AND p.expira_en > now()`,
      [hashSesion(token ?? '')],
    );
    const fila = r.rows[0];
    if (!token || !fila) throw new NotFoundException('No hay una solicitud de Google pendiente');
    return fila.tipo === 'VINCULAR'
      ? {
          tipo: 'VINCULAR',
          correo: fila.correo,
          nombre: fila.nombre,
          requiereCodigo: Boolean(fila.requiere_codigo),
        }
      : { tipo: 'REGISTRO', correo: fila.correo, nombre: fila.nombre };
  }

  async cancelarPendiente(token: string | undefined): Promise<void> {
    if (token)
      await this.db.query('DELETE FROM google_pendiente WHERE token_hash = $1', [
        hashSesion(token),
      ]);
  }

  /**
   * Vincula la cuenta de Google a la cuenta que ya existía con ese correo, después de comprobar
   * la contraseña (y el código 2FA si la cuenta lo tiene). Cinco fallos invalidan la solicitud.
   */
  async vincular(token: string | undefined, datos: VincularGoogle) {
    const hash = hashSesion(token ?? '');
    const r = await this.db.query<
      CuentaPuntual & { password_hash: string; intentos: number; google_sub: string }
    >(
      `SELECT u.id, u.nombre, u.celular, u.correo, u.rol, u.password_hash,
              u.totp_secreto, u.totp_activado_en, p.intentos, p.google_sub
         FROM google_pendiente p JOIN usuario u ON u.id = p.usuario_id
        WHERE p.token_hash = $1 AND p.tipo = 'VINCULAR' AND p.expira_en > now()
          AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL`,
      [hash],
    );
    const cuenta = r.rows[0];
    if (!token || !cuenta) throw this.solicitudVencida();
    if (cuenta.intentos >= MAX_INTENTOS) {
      await this.cancelarPendiente(token);
      throw this.solicitudVencida();
    }

    if (!(await verificarContrasena(datos.contrasena, cuenta.password_hash))) {
      await this.registrarFallo(hash);
      throw new UnauthorizedException('La contraseña no es correcta');
    }
    if (cuenta.totp_activado_en && cuenta.totp_secreto) {
      if (!datos.codigo) {
        throw new BadRequestException({
          message: 'Revisa los datos ingresados',
          errores: { codigo: 'Ingresa el código de Google Authenticator' },
        });
      }
      if (!verificarCodigoTotp(cuenta.totp_secreto, datos.codigo)) {
        await this.registrarFallo(hash);
        throw new UnauthorizedException('El código 2FA es inválido o ha vencido');
      }
    }

    try {
      await this.db.withUser(cuenta.id, async (client) => {
        const reclamada = await client.query<{ google_sub: string; correo: string }>(
          `DELETE FROM google_pendiente
            WHERE token_hash = $1 AND tipo = 'VINCULAR' AND expira_en > now()
            RETURNING google_sub, correo`,
          [hash],
        );
        const fila = reclamada.rows[0];
        if (!fila) throw this.solicitudVencida();
        await client.query(
          'INSERT INTO cuenta_google (google_sub, usuario_id, correo) VALUES ($1, $2, $3)',
          [fila.google_sub, cuenta.id, fila.correo],
        );
      });
    } catch (fallo) {
      if (esErrorPg(fallo, PG.UNICO)) {
        throw new ConflictException('Esa cuenta de Google ya está vinculada a otra cuenta de Veto');
      }
      throw fallo;
    }
    return this.identidad.crearSesion(this.soloCuenta(cuenta));
  }

  /**
   * Crea la cuenta de tutor de quien entró por primera vez con Google, con el celular que Google
   * no entrega. Todo ocurre en una transacción: o quedan cuenta y vínculo, o nada.
   */
  async completarRegistro(token: string | undefined, datos: CompletarGoogle) {
    try {
      const usuario = await this.db.withUser(null, async (client) => {
        const reclamada = await client.query<{
          google_sub: string;
          correo: string;
          nombre: string;
        }>(
          `DELETE FROM google_pendiente
            WHERE token_hash = $1 AND tipo = 'REGISTRO' AND expira_en > now()
            RETURNING google_sub, correo, nombre`,
          [hashSesion(token ?? '')],
        );
        const fila = reclamada.rows[0];
        if (!token || !fila) throw this.solicitudVencida();

        const nueva = await this.identidad.insertUser(
          client,
          { nombre: fila.nombre, celular: datos.celular, correo: fila.correo },
          CONTRASENA_GOOGLE,
          'TUTOR',
        );
        await client.query(
          'INSERT INTO cuenta_google (google_sub, usuario_id, correo) VALUES ($1, $2, $3)',
          [fila.google_sub, nueva.id, fila.correo],
        );
        return nueva;
      });
      return await this.identidad.crearSesion({ ...usuario });
    } catch (fallo) {
      if (esErrorPg(fallo, PG.UNICO)) {
        throw new ConflictException(
          'Ya existe una cuenta con ese correo: vuelve a entrar con Google para vincularla',
        );
      }
      throw fallo;
    }
  }

  private async crearPendiente(
    tipo: 'VINCULAR' | 'REGISTRO',
    perfil: PerfilGoogle,
    usuarioId: string | null = null,
  ): Promise<string> {
    // Una sola solicitud por cuenta de Google, y se limpian las vencidas.
    await this.db.query('DELETE FROM google_pendiente WHERE expira_en < now() OR google_sub = $1', [
      perfil.sub,
    ]);
    const token = aleatorio(32);
    await this.db.query(
      `INSERT INTO google_pendiente (token_hash, tipo, google_sub, correo, nombre, usuario_id, expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        hashSesion(token),
        tipo,
        perfil.sub,
        perfil.correo,
        perfil.nombre,
        usuarioId,
        new Date(Date.now() + VIGENCIA_GOOGLE_MS),
      ],
    );
    return token;
  }

  /** Cuenta un intento fallido; el quinto invalida la solicitud. Se guarda aunque la petición falle. */
  private async registrarFallo(hash: string): Promise<void> {
    await this.db.query(
      `UPDATE google_pendiente SET intentos = intentos + 1 WHERE token_hash = $1`,
      [hash],
    );
    await this.db.query('DELETE FROM google_pendiente WHERE token_hash = $1 AND intentos >= $2', [
      hash,
      MAX_INTENTOS,
    ]);
  }

  private estaActiva(cuenta: CuentaConEstado): boolean {
    return cuenta.estado === 'ACTIVA' && cuenta.eliminado_en === null;
  }

  /** Deja solo lo necesario para abrir sesión (sin estado ni indicadores internos). */
  private soloCuenta(cuenta: CuentaPuntual): CuentaPuntual {
    return {
      id: cuenta.id,
      nombre: cuenta.nombre,
      celular: cuenta.celular,
      correo: cuenta.correo,
      rol: cuenta.rol,
      totp_secreto: cuenta.totp_secreto,
      totp_activado_en: cuenta.totp_activado_en,
    };
  }

  private solicitudVencida(): UnauthorizedException {
    return new UnauthorizedException('La solicitud con Google venció: vuelve a empezar');
  }
}
