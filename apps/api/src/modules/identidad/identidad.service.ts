import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import type { PoolClient } from 'pg';
import type {
  ActualizarPerfil,
  EliminarCuenta,
  PerfilUsuario,
  RegistroUsuario,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { CitasService } from '../citas/citas.service';
import { hashSesion, verificarContrasena } from './seguridad';

const DURACION_SESION_MS = 1000 * 60 * 60 * 24 * 7;
const scrypt = promisify(scryptCallback);
export const NOMBRE_COOKIE_SESION = 'veto_session';

/** Valores con los que se reemplazan los datos personales de una cuenta eliminada (HU-006). */
export const ANONIMO = {
  nombre: 'Usuario eliminado',
  celular: '0000000000',
  passwordHash: 'ELIMINADA', // no tiene el formato scrypt$...: ninguna contraseña lo verifica
  correo: (id: string) => `eliminado+${id}@veto.invalid`,
};

export type UsuarioSesion = PerfilUsuario;
type UsuarioPublico = PerfilUsuario & { estado: string; creado_en: Date };

@Injectable()
export class IdentidadService {
  constructor(
    private readonly db: DatabaseService,
    private readonly citas?: CitasService,
  ) {}

  async createTutor(input: RegistroUsuario): Promise<UsuarioPublico> {
    const passwordHash = await this.hashPassword(input.contrasena);
    try {
      return await this.db.withUser(null, (client) =>
        this.insertUser(client, input, passwordHash, 'TUTOR'),
      );
    } catch (error) {
      if (esErrorPg(error, PG.UNICO)) {
        throw new ConflictException({
          code: 'ACCOUNT_EXISTS',
          message: 'Ya existe una cuenta con ese correo.',
        });
      }
      throw error;
    }
  }

  async iniciarSesion(
    correo: string,
    contrasena: string,
  ): Promise<{
    token: string;
    usuario: UsuarioSesion;
  } | null> {
    const resultado = await this.db.query<UsuarioSesion & { password_hash: string }>(
      `SELECT id, nombre, celular, correo, rol, password_hash
       FROM usuario
       WHERE correo = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [correo],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta || !(await verificarContrasena(contrasena, cuenta.password_hash))) return null;

    const token = randomBytes(32).toString('base64url');
    await this.db.query(
      `INSERT INTO sesion (token_hash, usuario_id, expira_en)
       VALUES ($1, $2, $3)`,
      [hashSesion(token), cuenta.id, new Date(Date.now() + DURACION_SESION_MS)],
    );
    const { password_hash: _hash, ...usuario } = cuenta;
    return { token, usuario };
  }

  async insertUser(
    client: PoolClient,
    input: Pick<RegistroUsuario, 'nombre' | 'celular' | 'correo'>,
    passwordHash: string,
    rol: 'TUTOR' | 'ALIADO',
  ): Promise<UsuarioPublico> {
    const resultado = await client.query<UsuarioPublico>(
      `INSERT INTO usuario (nombre, celular, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, celular, correo, rol, estado, creado_en`,
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
  async eliminarCuenta(usuarioId: string, datos: EliminarCuenta): Promise<void> {
    await this.db.withUser(usuarioId, async (client) => {
      const cuenta = await this.cuentaActiva(client, usuarioId, true);
      if (!(await verificarContrasena(datos.contrasena, cuenta.password_hash))) {
        throw new UnauthorizedException('La contraseña no es correcta');
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

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
  }
}
