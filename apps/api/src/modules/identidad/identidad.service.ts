import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { DatabaseService } from '../../database/database.service';
import { hashSesion, verificarContrasena } from './seguridad';

const DURACION_SESION_MS = 1000 * 60 * 60 * 24 * 7;
export const NOMBRE_COOKIE_SESION = 'veto_session';

export type UsuarioSesion = {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
};

@Injectable()
export class IdentidadService {
  constructor(private readonly db: DatabaseService) {}

  async iniciarSesion(
    correo: string,
    contrasena: string,
  ): Promise<{
    token: string;
    usuario: UsuarioSesion;
  } | null> {
    const resultado = await this.db.query<{
      id: string;
      nombre: string;
      correo: string;
      rol: string;
      password_hash: string;
    }>(
      `SELECT id, nombre, correo, rol, password_hash
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
    return {
      token,
      usuario: { id: cuenta.id, nombre: cuenta.nombre, correo: cuenta.correo, rol: cuenta.rol },
    };
  }

  async usuarioDeSesion(cookieHeader?: string): Promise<UsuarioSesion | null> {
    const token = cookieHeader
      ?.split(';')
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith(`${NOMBRE_COOKIE_SESION}=`))
      ?.slice(NOMBRE_COOKIE_SESION.length + 1);
    if (!token) return null;

    const resultado = await this.db.query<UsuarioSesion>(
      `SELECT u.id, u.nombre, u.correo, u.rol
       FROM sesion s
       JOIN usuario u ON u.id = s.usuario_id
       WHERE s.token_hash = $1 AND s.expira_en > now()
         AND u.estado = 'ACTIVA' AND u.eliminado_en IS NULL`,
      [hashSesion(token)],
    );
    return resultado.rows[0] ?? null;
  }
}
