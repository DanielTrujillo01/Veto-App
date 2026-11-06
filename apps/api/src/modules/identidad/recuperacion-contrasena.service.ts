import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomInt, randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { hashSesion, hashContrasena, verificarContrasena } from './seguridad';
import { CorreoService } from './correo.service';

const DURACION_CODIGO_MS = 10 * 60 * 1000;
const ESPERA_REENVIO_MS = 60 * 1000;
const MAX_INTENTOS_CODIGO = 5;

type CuentaRecuperable = { id: string; correo: string; nombre: string };
type Recuperacion = {
  usuario_id: string;
  codigo_hash: string | null;
  token_hash: string | null;
  intentos: number;
};

@Injectable()
export class RecuperacionContrasenaService {
  private readonly logger = new Logger(RecuperacionContrasenaService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly correo: CorreoService,
  ) {}

  async disponibilidad(): Promise<boolean> {
    return this.correo.verificarConexion();
  }

  async solicitar(correoIngresado: string): Promise<void> {
    if (!(await this.correo.verificarConexion())) {
      throw new ServiceUnavailableException(
        'El correo de recuperación no está disponible. Revisa la configuración SMTP e inténtalo más tarde.',
      );
    }

    const correo = correoIngresado.trim().toLowerCase();
    const resultado = await this.db.query<CuentaRecuperable>(
      `SELECT id, correo, nombre FROM usuario
       WHERE correo = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL`,
      [correo],
    );
    const cuenta = resultado.rows[0];
    if (!cuenta) return;

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codigoHash = await hashContrasena(codigo);
    const guardado = await this.db.query<{ usuario_id: string }>(
      `INSERT INTO recuperacion_contrasena (usuario_id, codigo_hash, expira_en, intentos)
       VALUES ($1, $2, now() + interval '10 minutes', 0)
       ON CONFLICT (usuario_id) DO UPDATE
         SET codigo_hash = EXCLUDED.codigo_hash,
             token_hash = NULL,
             expira_en = EXCLUDED.expira_en,
             intentos = 0,
             creado_en = now()
         WHERE recuperacion_contrasena.creado_en < now() - interval '60 seconds'
       RETURNING usuario_id`,
      [cuenta.id, codigoHash],
    );
    if (guardado.rows.length === 0) return;

    try {
      await this.correo.enviarCodigoRecuperacion(cuenta.correo, cuenta.nombre, codigo);
    } catch (error) {
      await this.db.query(
        'DELETE FROM recuperacion_contrasena WHERE usuario_id = $1 AND codigo_hash = $2',
        [cuenta.id, codigoHash],
      );
      const codigoError =
        typeof error === 'object' && error !== null && 'code' in error
          ? String(error.code)
          : 'sin código';
      this.logger.error(`No se pudo enviar el código de recuperación por SMTP (${codigoError})`);
      throw new ServiceUnavailableException(
        'No pudimos enviar el código de recuperación. Revisa la configuración del correo e inténtalo más tarde.',
      );
    }
  }

  async verificar(correoIngresado: string, codigo: string): Promise<{ token: string }> {
    const correo = correoIngresado.trim().toLowerCase();
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashSesion(token);

    const valido = await this.db.withUser(null, async (client) => {
      const resultado = await client.query<Recuperacion>(
        `SELECT r.usuario_id, r.codigo_hash, r.token_hash, r.intentos
         FROM recuperacion_contrasena r
         JOIN usuario u ON u.id = r.usuario_id
         WHERE u.correo = $1 AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL
           AND r.expira_en > now()
         FOR UPDATE OF r`,
        [correo],
      );
      const recuperacion = resultado.rows[0];
      if (!recuperacion?.codigo_hash || recuperacion.intentos >= MAX_INTENTOS_CODIGO) {
        return false;
      }

      if (!(await verificarContrasena(codigo, recuperacion.codigo_hash))) {
        await client.query(
          `UPDATE recuperacion_contrasena
           SET intentos = intentos + 1
           WHERE usuario_id = $1`,
          [recuperacion.usuario_id],
        );
        return false;
      }

      await client.query(
        `UPDATE recuperacion_contrasena
         SET codigo_hash = NULL, token_hash = $2, expira_en = now() + interval '10 minutes'
         WHERE usuario_id = $1`,
        [recuperacion.usuario_id, tokenHash],
      );
      return true;
    });

    if (!valido) throw new BadRequestException('El código es inválido o ha vencido');
    return { token };
  }

  async restablecer(token: string, contrasena: string): Promise<void> {
    const tokenHash = hashSesion(token);
    const vigente = await this.db.query<{ usuario_id: string }>(
      `SELECT usuario_id FROM recuperacion_contrasena
       WHERE token_hash = $1 AND expira_en > now()`,
      [tokenHash],
    );
    if (!vigente.rows[0]) {
      throw new BadRequestException('La solicitud de recuperación no es válida');
    }

    const passwordHash = await hashContrasena(contrasena);
    const actualizado = await this.db.withUser(null, async (client) => {
      const resultado = await client.query<{ usuario_id: string }>(
        `SELECT usuario_id FROM recuperacion_contrasena
         WHERE token_hash = $1 AND expira_en > now()
         FOR UPDATE`,
        [tokenHash],
      );
      const usuarioId = resultado.rows[0]?.usuario_id;
      if (!usuarioId) return false;

      const usuario = await client.query<{ id: string }>(
        `UPDATE usuario SET password_hash = $2
         WHERE id = $1 AND estado = 'ACTIVA' AND eliminado_en IS NULL
         RETURNING id`,
        [usuarioId, passwordHash],
      );
      if (!usuario.rows[0]) return false;

      await client.query('DELETE FROM sesion WHERE usuario_id = $1', [usuarioId]);
      await client.query('DELETE FROM recuperacion_contrasena WHERE usuario_id = $1', [usuarioId]);
      return true;
    });

    if (!actualizado) throw new BadRequestException('La solicitud de recuperación no es válida');
  }
}
