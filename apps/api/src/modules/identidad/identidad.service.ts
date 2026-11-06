import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import type {
  ActualizarPerfil,
  EliminarCuenta,
  PerfilUsuario,
  RegistroUsuario,
  CompletarRecuperacion,
  SolicitarRecuperacion,
  VerificarRecuperacion,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { CitasService } from '../citas/citas.service';
import {
  generarSecretoTotp,
  hashContrasena,
  hashSesion,
  uriTotp,
  contadorCodigoTotp,
  verificarCodigoTotp,
  verificarContrasena,
} from './seguridad';
import { CorreoRecuperacionService } from './correo-recuperacion.service';

const DURACION_SESION_MS = 1000 * 60 * 60 * 24 * 7;
const DURACION_DESAFIO_2FA_MS = 1000 * 60 * 5;
const DURACION_ENLACE_RECUPERACION_MS = 1000 * 60 * 15;
const DURACION_TOKEN_RESTABLECIMIENTO_MS = 1000 * 60 * 10;
const MAX_SOLICITUDES_RECUPERACION_POR_HORA = 3;
const MAX_INTENTOS_CODIGO_RECUPERACION = 5;
const PREFIJO_DESAFIO_VERIFICACION = 'hu004:verificacion:';
const PREFIJO_DESAFIO_RESTABLECIMIENTO = 'hu004:restablecimiento:';
const PREFIJO_DESAFIO_INTENTO = 'hu004:intento:';
const PREFIJO_DESAFIO_TOTP = 'hu004:totp:';
export const NOMBRE_COOKIE_SESION = 'veto_session';
const MENSAJE_SOLICITUD_RECUPERACION =
  'Si la cuenta permite recuperación automática, recibirás instrucciones en el correo registrado. ' +
  'Si no activaste la verificación en dos pasos o perdiste acceso a Google Authenticator, contacta al equipo de soporte.';

/** Valores con los que se reemplazan los datos personales de una cuenta eliminada (HU-006). */
export const ANONIMO = {
  nombre: 'Usuario eliminado',
  celular: '0000000000',
  passwordHash: 'ELIMINADA', // no tiene el formato scrypt$...: ninguna contraseña lo verifica
  correo: (id: string) => `eliminado+${id}@veto.invalid`,
};

/** Contraseña de las cuentas creadas con Google (HU-003): no tiene el formato scrypt, nadie la acierta. */
export const CONTRASENA_GOOGLE = 'GOOGLE';

export type UsuarioSesion = PerfilUsuario;

@Injectable()
export class IdentidadService {
  constructor(
    private readonly db: DatabaseService,
    private readonly citas?: CitasService,
    @Optional() private readonly correoRecuperacion?: CorreoRecuperacionService,
  ) {}

  /** HU-001: registra una cuenta de tutor. */
  async createTutor(input: RegistroUsuario): Promise<PerfilUsuario> {
    const passwordHash = await hashContrasena(input.contrasena);
    try {
      return await this.db.withUser(null, (client) =>
        this.insertUser(client, input, passwordHash, 'TUTOR'),
      );
    } catch (error) {
      if (esErrorPg(error, PG.UNICO)) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw error;
    }
  }

  async iniciarSesion(
    correo: string,
    contrasena: string,
  ): Promise<
    | {
        token: string;
        usuario: UsuarioSesion;
      }
    | { requiere2fa: true; desafio: string; expiraEn: Date }
    | null
  > {
    const resultado = await this.db.query<
      UsuarioSesion & {
        password_hash: string;
        totp_secreto: string | null;
        totp_activado_en: Date | null;
      }
    >(
      `SELECT id, nombre, celular, correo, rol, password_hash, totp_secreto, totp_activado_en
       FROM usuario
       WHERE correo = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [correo.toLowerCase()],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta || !(await verificarContrasena(contrasena, cuenta.password_hash))) return null;

    return this.abrirSesionOExigir2fa(cuenta);
  }

  /**
   * Con la identidad ya comprobada (contraseña, o Google en HU-003): si la cuenta tiene la
   * verificación en dos pasos activa devuelve un desafío para completarla; si no, abre la sesión.
   */
  async abrirSesionOExigir2fa(
    cuenta: UsuarioSesion & { totp_secreto: string | null; totp_activado_en: Date | null },
  ): Promise<
    | { token: string; usuario: UsuarioSesion }
    | { requiere2fa: true; desafio: string; expiraEn: Date }
  > {
    if (cuenta.totp_activado_en && cuenta.totp_secreto) {
      const desafio = randomBytes(32).toString('base64url');
      const expiraEn = new Date(Date.now() + DURACION_DESAFIO_2FA_MS);
      await this.db.query(
        `INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
         VALUES ($1, $2, $3)`,
        [hashSesion(desafio), cuenta.id, expiraEn],
      );
      return { requiere2fa: true, desafio, expiraEn };
    }

    return this.crearSesion(cuenta);
  }

  async completarLogin2fa(desafio: string, codigo: string) {
    const resultado = await this.db.query<UsuarioSesion & { totp_secreto: string | null }>(
      `SELECT u.id, u.nombre, u.celular, u.correo, u.rol, u.totp_secreto
       FROM desafio_2fa d
       JOIN usuario u ON u.id = d.usuario_id
       WHERE d.token_hash = $1 AND d.expira_en > now()
         AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL
         AND u.totp_activado_en IS NOT NULL`,
      [hashSesion(desafio)],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta || !cuenta.totp_secreto || !verificarCodigoTotp(cuenta.totp_secreto, codigo)) {
      throw new UnauthorizedException('El código 2FA es inválido o ha vencido');
    }

    await this.db.query('DELETE FROM desafio_2fa WHERE token_hash = $1', [hashSesion(desafio)]);
    return this.crearSesion(cuenta);
  }

  /** HU-004: inicia recuperación solo para cuentas con TOTP; no revela si el correo existe. */
  async solicitarRecuperacion(datos: SolicitarRecuperacion): Promise<{ mensaje: string }> {
    const correo = this.exigirCorreoRecuperacion();
    correo.assertConfigured();

    const resultado = await this.db.query<{
      id: string;
      correo: string;
      totp_secreto: string | null;
      totp_activado_en: Date | null;
    }>(
      `SELECT id, correo, totp_secreto, totp_activado_en
         FROM usuario
        WHERE correo = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [datos.correo.toLowerCase()],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta?.totp_secreto || !cuenta.totp_activado_en) {
      return { mensaje: MENSAJE_SOLICITUD_RECUPERACION };
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = `${PREFIJO_DESAFIO_VERIFICACION}${hashSesion(token)}`;
    const creado = await this.db.withUser(cuenta.id, async (client) => {
      await client.query('SELECT id FROM usuario WHERE id = $1 FOR UPDATE', [cuenta.id]);
      await client.query(
        `DELETE FROM desafio_2fa
          WHERE usuario_id = $1 AND token_hash LIKE 'hu004:%'
            AND creado_en < now() - interval '1 day'`,
        [cuenta.id],
      );
      const limite = await client.query<{ cantidad: number }>(
        `SELECT count(*)::int AS cantidad
           FROM desafio_2fa
          WHERE usuario_id = $1 AND token_hash LIKE $2
            AND creado_en > now() - interval '1 hour'`,
        [cuenta.id, `${PREFIJO_DESAFIO_VERIFICACION}%`],
      );
      if (limite.rows[0]?.cantidad >= MAX_SOLICITUDES_RECUPERACION_POR_HORA) return false;

      await client.query(
        `INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
         VALUES ($1, $2, $3)`,
        [tokenHash, cuenta.id, new Date(Date.now() + DURACION_ENLACE_RECUPERACION_MS)],
      );
      return true;
    });
    if (!creado) return { mensaje: MENSAJE_SOLICITUD_RECUPERACION };

    const origen = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').replace(/\/+$/, '');
    const url = `${origen}/recuperar-contrasena?token=${encodeURIComponent(token)}`;
    try {
      await correo.enviarEnlaceRecuperacion(cuenta.correo, url);
    } catch (error) {
      await this.db.withUser(cuenta.id, (client) =>
        client.query('UPDATE desafio_2fa SET expira_en = now() WHERE token_hash = $1', [tokenHash]),
      );
      throw error;
    }
    return { mensaje: MENSAJE_SOLICITUD_RECUPERACION };
  }

  /** HU-004: consume el enlace y valida TOTP; devuelve un token de cambio de un solo uso. */
  async verificarRecuperacion(datos: VerificarRecuperacion): Promise<{ token: string }> {
    const tokenHash = `${PREFIJO_DESAFIO_VERIFICACION}${hashSesion(datos.token)}`;
    const referencia = await this.db.query<{ usuario_id: string }>(
      `SELECT usuario_id FROM desafio_2fa
        WHERE token_hash = $1 AND token_hash LIKE 'hu004:verificacion:%'`,
      [tokenHash],
    );
    const usuarioId = referencia.rows[0]?.usuario_id;
    if (!usuarioId) throw this.errorRecuperacionInvalida();

    const tokenRestablecimiento = randomBytes(32).toString('base64url');
    const resultado = await this.db.withUser(usuarioId, async (client) => {
      const desafio = await client.query<{
        totp_secreto: string | null;
      }>(
        `SELECT u.totp_secreto
           FROM desafio_2fa d
           JOIN usuario u ON u.id = d.usuario_id
          WHERE d.token_hash = $1 AND d.usuario_id = $2
            AND d.expira_en > now()
            AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL
            AND u.totp_activado_en IS NOT NULL
          FOR UPDATE OF d, u`,
        [tokenHash, usuarioId],
      );
      const fila = desafio.rows[0];
      if (!fila?.totp_secreto) return false;

      const contador = contadorCodigoTotp(fila.totp_secreto, datos.codigo);
      const prefijoIntentos = `${PREFIJO_DESAFIO_INTENTO}${hashSesion(tokenHash)}:`;
      const intentos = await client.query<{ cantidad: number }>(
        `SELECT count(*)::int AS cantidad
           FROM desafio_2fa
          WHERE usuario_id = $1 AND token_hash LIKE $2
            AND creado_en > now() - interval '15 minutes'`,
        [usuarioId, `${prefijoIntentos}%`],
      );
      const intentosPrevios = Number(intentos.rows[0]?.cantidad ?? 0);
      const marcadorIntento = `${prefijoIntentos}${intentosPrevios + 1}`;
      const registrarIntentoFallido = async () => {
        await client.query(
          `INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
           VALUES ($1, $2, now() + interval '15 minutes')
           ON CONFLICT (token_hash) DO NOTHING`,
          [marcadorIntento, usuarioId],
        );
        if (intentosPrevios + 1 >= MAX_INTENTOS_CODIGO_RECUPERACION) {
          await client.query('UPDATE desafio_2fa SET expira_en = now() WHERE token_hash = $1', [
            tokenHash,
          ]);
        }
      };
      if (contador === null) {
        await registrarIntentoFallido();
        return false;
      }

      const marcadorTotp = `${PREFIJO_DESAFIO_TOTP}${hashSesion(`${usuarioId}:${contador}`)}`;
      const codigoUsado = await client.query<{ token_hash: string }>(
        `SELECT token_hash FROM desafio_2fa
          WHERE usuario_id = $1 AND token_hash = $2 AND expira_en > now()`,
        [usuarioId, marcadorTotp],
      );
      if (codigoUsado.rows.length > 0) {
        await registrarIntentoFallido();
        return false;
      }

      const marcadorGuardado = await client.query<{ token_hash: string }>(
        `INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
         VALUES ($1, $2, $3)
         ON CONFLICT (token_hash) DO NOTHING
         RETURNING token_hash`,
        [marcadorTotp, usuarioId, new Date((contador + 1) * 30_000)],
      );
      if (marcadorGuardado.rows.length !== 1) {
        await registrarIntentoFallido();
        return false;
      }

      await client.query(
        `UPDATE desafio_2fa SET expira_en = now()
          WHERE token_hash = $1 AND expira_en > now()`,
        [tokenHash],
      );
      await client.query(
        `UPDATE desafio_2fa SET expira_en = now()
          WHERE usuario_id = $1 AND token_hash LIKE $2 AND expira_en > now()`,
        [usuarioId, `${PREFIJO_DESAFIO_VERIFICACION}%`],
      );
      await client.query(
        `INSERT INTO desafio_2fa (token_hash, usuario_id, expira_en)
         VALUES ($1, $2, $3)`,
        [
          `${PREFIJO_DESAFIO_RESTABLECIMIENTO}${hashSesion(tokenRestablecimiento)}`,
          usuarioId,
          new Date(Date.now() + DURACION_TOKEN_RESTABLECIMIENTO_MS),
        ],
      );
      return true;
    });

    if (!resultado) throw this.errorRecuperacionInvalida();
    return { token: tokenRestablecimiento };
  }

  /** HU-004: reemplaza la contraseña y revoca credenciales anteriores atómicamente. */
  async completarRecuperacion(datos: CompletarRecuperacion): Promise<{ mensaje: string }> {
    const tokenHash = `${PREFIJO_DESAFIO_RESTABLECIMIENTO}${hashSesion(datos.token)}`;
    const referencia = await this.db.query<{ usuario_id: string }>(
      `SELECT usuario_id FROM desafio_2fa
        WHERE token_hash = $1 AND token_hash LIKE 'hu004:restablecimiento:%'`,
      [tokenHash],
    );
    const usuarioId = referencia.rows[0]?.usuario_id;
    if (!usuarioId) throw this.errorRecuperacionInvalida();

    const passwordHash = await hashContrasena(datos.contrasena);
    const cambiado = await this.db.withUser(usuarioId, async (client) => {
      const desafio = await client.query<{ token_hash: string }>(
        `SELECT d.token_hash
           FROM desafio_2fa d
           JOIN usuario u ON u.id = d.usuario_id
          WHERE d.token_hash = $1 AND d.usuario_id = $2
            AND d.expira_en > now()
            AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL
          FOR UPDATE OF d, u`,
        [tokenHash, usuarioId],
      );
      const fila = desafio.rows[0];
      if (!fila) return false;

      const actualizacion = await client.query(
        `UPDATE usuario SET password_hash = $2
          WHERE id = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
        [usuarioId, passwordHash],
      );
      if (actualizacion.rowCount !== 1) return false;
      await client.query(
        `UPDATE desafio_2fa SET expira_en = now()
          WHERE token_hash = $1 AND expira_en > now()`,
        [tokenHash],
      );
      await client.query(
        `UPDATE desafio_2fa SET expira_en = now()
          WHERE usuario_id = $1 AND (token_hash LIKE $2 OR token_hash LIKE $3)
            AND expira_en > now()`,
        [usuarioId, `${PREFIJO_DESAFIO_RESTABLECIMIENTO}%`, `${PREFIJO_DESAFIO_VERIFICACION}%`],
      );
      await client.query('DELETE FROM sesion WHERE usuario_id = $1', [usuarioId]);
      await client.query(
        `DELETE FROM desafio_2fa
          WHERE usuario_id = $1 AND token_hash NOT LIKE 'hu004:%'`,
        [usuarioId],
      );
      return true;
    });
    if (!cambiado) throw this.errorRecuperacionInvalida();
    return { mensaje: 'La contraseña se actualizó. Ya puedes iniciar sesión con la nueva clave.' };
  }

  private exigirCorreoRecuperacion(): CorreoRecuperacionService {
    if (!this.correoRecuperacion) {
      throw new ServiceUnavailableException(
        'El servicio de correo de recuperación no está disponible',
      );
    }
    return this.correoRecuperacion;
  }

  private errorRecuperacionInvalida(): UnauthorizedException {
    return new UnauthorizedException(
      'El enlace, código o sesión de recuperación no es válido, venció o ya fue utilizado',
    );
  }

  async estado2fa(usuarioId: string): Promise<{ activado: boolean; activadoEn: Date | null }> {
    const resultado = await this.db.query<{ totp_activado_en: Date | null }>(
      `SELECT totp_activado_en FROM usuario WHERE id = $1 AND estado = 'ACTIVA'`,
      [usuarioId],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta) throw new NotFoundException('La cuenta no existe');
    return { activado: cuenta.totp_activado_en !== null, activadoEn: cuenta.totp_activado_en };
  }

  async iniciarActivacion2fa(usuarioId: string) {
    const resultado = await this.db.query<{
      correo: string;
      totp_secreto: string | null;
      totp_activado_en: Date | null;
    }>(
      `SELECT correo, totp_secreto, totp_activado_en FROM usuario
       WHERE id = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [usuarioId],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta) throw new NotFoundException('La cuenta no existe');
    if (cuenta.totp_activado_en) {
      throw new ConflictException('La verificación en dos pasos ya está activa');
    }

    const secreto = cuenta.totp_secreto ?? generarSecretoTotp();
    if (!cuenta.totp_secreto) {
      await this.db.query('UPDATE usuario SET totp_secreto = $2 WHERE id = $1', [
        usuarioId,
        secreto,
      ]);
    }
    return { activado: false, secreto, uri: uriTotp(secreto, cuenta.correo) };
  }

  async confirmarActivacion2fa(usuarioId: string, codigo: string) {
    const resultado = await this.db.query<{
      correo: string;
      totp_secreto: string | null;
      totp_activado_en: Date | null;
    }>(
      `SELECT correo, totp_secreto, totp_activado_en FROM usuario
       WHERE id = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [usuarioId],
    );
    const cuenta = resultado.rows[0];
    if (
      !cuenta?.totp_secreto ||
      cuenta.totp_activado_en ||
      !verificarCodigoTotp(cuenta.totp_secreto, codigo)
    ) {
      throw new UnauthorizedException('El código 2FA es inválido o ha vencido');
    }

    const actualizado = await this.db.query<{ totp_activado_en: Date }>(
      `UPDATE usuario SET totp_activado_en = now() WHERE id = $1
       RETURNING totp_activado_en`,
      [usuarioId],
    );
    return { activado: true, activadoEn: actualizado.rows[0].totp_activado_en };
  }

  async crearSesion(
    cuenta: UsuarioSesion & {
      password_hash?: string;
      totp_secreto?: string | null;
      totp_activado_en?: Date | null;
    },
  ) {
    const token = randomBytes(32).toString('base64url');

    await this.db.query(
      `INSERT INTO sesion (token_hash, usuario_id, expira_en)
       VALUES ($1, $2, $3)`,
      [hashSesion(token), cuenta.id, new Date(Date.now() + DURACION_SESION_MS)],
    );
    const {
      password_hash: _hash,
      totp_secreto: _secreto,
      totp_activado_en: _activado,
      ...usuario
    } = cuenta;
    return { token, usuario };
  }

  /**
   * Crea la fila de usuario dentro de la transacción de quien llama. Es la única forma de crear
   * cuentas desde otros módulos (registro de aliados, veterinarios de una clínica): solo este
   * módulo escribe en `usuario`. Un correo repetido lanza el error 23505 de PostgreSQL.
   */
  async insertUser(
    client: PoolClient,
    input: Pick<RegistroUsuario, 'nombre' | 'celular' | 'correo'>,
    passwordHash: string,
    rol: 'TUTOR' | 'ALIADO' | 'VETERINARIO',
  ): Promise<PerfilUsuario> {
    const resultado = await client.query<PerfilUsuario>(
      `INSERT INTO usuario (nombre, celular, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, celular, correo, rol`,
      [input.nombre, input.celular, input.correo.toLowerCase(), passwordHash, rol],
    );
    return resultado.rows[0];
  }

  async usuarioDeSesion(cookieHeader?: string): Promise<UsuarioSesion | null> {
    const token = cookieHeader
      ?.split(';')
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith(`${NOMBRE_COOKIE_SESION}=`))
      ?.slice(NOMBRE_COOKIE_SESION.length + 1);
    if (!token) return null;

    const resultado = await this.db.query<UsuarioSesion>(
      `SELECT u.id, u.nombre, u.celular, u.correo, u.rol
       FROM sesion s
       JOIN usuario u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.expira_en > now()
         AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL`,
      [hashSesion(token)],
    );
    return resultado.rows[0] ?? null;
  }

  /** HU-006: perfil del usuario autenticado, leído siempre de la base (no de la sesión en caché). */
  async obtenerPerfil(usuarioId: string): Promise<PerfilUsuario> {
    const resultado = await this.db.query<PerfilUsuario>(
      `SELECT id, nombre, celular, correo, rol FROM usuario
        WHERE id = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [usuarioId],
    );
    const perfil = resultado.rows[0];
    if (!perfil) throw new NotFoundException('La cuenta no existe');
    return perfil;
  }

  /** HU-006: guarda los cambios válidos del perfil. */
  async actualizarPerfil(usuarioId: string, datos: ActualizarPerfil): Promise<PerfilUsuario> {
    return this.db.withUser(usuarioId, async (client) => {
      const actual = await this.cuentaActiva(client, usuarioId);
      const cambiaCorreo =
        datos.correo !== undefined && datos.correo.toLowerCase() !== actual.correo.toLowerCase();
      if (cambiaCorreo) {
        if (actual.password_hash === CONTRASENA_GOOGLE) {
          throw new ForbiddenException(
            'Esta cuenta entra con Google: su correo es el de esa cuenta y no se cambia aquí',
          );
        }
        if (
          !datos.contrasenaActual ||
          !(await verificarContrasena(datos.contrasenaActual, actual.password_hash))
        ) {
          throw new UnauthorizedException('Para cambiar el correo confirma tu contraseña actual');
        }
      }
      try {
        const resultado = await client.query<PerfilUsuario>(
          `UPDATE usuario
              SET nombre  = COALESCE($2, nombre),
                  celular = COALESCE($3, celular),
                  correo  = COALESCE($4, correo)
            WHERE id = $1
        RETURNING id, nombre, celular, correo, rol`,
          [usuarioId, datos.nombre ?? null, datos.celular ?? null, datos.correo ?? null],
        );
        return resultado.rows[0];
      } catch (error) {
        if (esErrorPg(error, PG.UNICO)) {
          throw new ConflictException('Ya existe una cuenta con ese correo');
        }
        throw error;
      }
    });
  }

  /**
   * HU-006: elimina la cuenta aplicando la política de conservación de datos
   * (docs/modelo-de-datos.md, decisión 8): baja lógica + anonimización de los datos personales,
   * cierre de todas las sesiones y cancelación de las citas futuras. Se conservan mascotas,
   * citas pasadas y consultas para la trazabilidad clínica.
   */
  async eliminarCuenta(
    usuarioId: string,
    datos: EliminarCuenta,
    reautenticacion?: string,
  ): Promise<void> {
    await this.db.withUser(usuarioId, async (client) => {
      const cuenta = await this.cuentaActiva(client, usuarioId, true);
      if (cuenta.password_hash === CONTRASENA_GOOGLE) {
        // Entra solo con Google: no hay contraseña, se confirma volviendo a pasar por Google.
        // La constancia es de un solo uso y se consume en esta misma transacción.
        const vigente =
          reautenticacion !== undefined &&
          (await this.consumirReautenticacion(client, usuarioId, reautenticacion));
        if (!vigente) {
          throw new UnauthorizedException({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Confirma tu identidad con Google para eliminar la cuenta',
            requiereReautenticacion: true,
          });
        }
      } else {
        if (!datos.contrasena) {
          throw new BadRequestException({
            message: 'Revisa los datos ingresados',
            errores: { contrasena: 'La contraseña es obligatoria' },
          });
        }
        if (!(await verificarContrasena(datos.contrasena, cuenta.password_hash))) {
          throw new UnauthorizedException('La contraseña no es correcta');
        }
      }
      if (cuenta.rol !== 'TUTOR') {
        throw new ForbiddenException(
          'Las cuentas de aliados y veterinarios se eliminan con el Equipo Veto. Contáctanos.',
        );
      }

      await this.citas?.cancelarFuturasDelTutor(client, usuarioId);
      await client.query(
        `UPDATE usuario
            SET estado = 'ELIMINADA', eliminado_en = now(),
                nombre = $2, celular = $3, correo = $4, password_hash = $5
          WHERE id = $1`,
        [
          usuarioId,
          ANONIMO.nombre,
          ANONIMO.celular,
          ANONIMO.correo(usuarioId),
          ANONIMO.passwordHash,
        ],
      );
      await client.query('DELETE FROM sesion WHERE usuario_id = $1', [usuarioId]);
    });
  }

  /** true si `token` es una constancia de reautenticación vigente de ese usuario; la gasta. */
  private async consumirReautenticacion(client: PoolClient, usuarioId: string, token: string) {
    const r = await client.query(
      `DELETE FROM google_reautenticacion
        WHERE token_hash = $1 AND usuario_id = $2 AND expira_en > now()
        RETURNING 1`,
      [hashSesion(token), usuarioId],
    );
    return r.rows.length > 0;
  }

  private async cuentaActiva(client: PoolClient, usuarioId: string, bloquear = false) {
    const resultado = await client.query<{ correo: string; rol: string; password_hash: string }>(
      `SELECT correo, rol, password_hash FROM usuario
        WHERE id = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL
        ${bloquear ? 'FOR UPDATE' : ''}`,
      [usuarioId],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta) throw new NotFoundException('La cuenta no existe');
    return cuenta;
  }
}
