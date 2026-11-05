import { ConflictException, Injectable } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import type { PoolClient } from 'pg';
import { DatabaseService } from '../../database/database.service';
import type { RegistroUsuario } from '@veto/shared';

const scrypt = promisify(scryptCallback);
type UserRole = 'TUTOR' | 'ALIADO';
type PublicUser = {
  id: string;
  nombre: string;
  celular: string;
  correo: string;
  rol: UserRole;
  estado: string;
  creado_en: Date;
};

@Injectable()
export class IdentidadService {
  constructor(private readonly database: DatabaseService) {}

  async createTutor(input: RegistroUsuario): Promise<PublicUser> {
    const passwordHash = await this.hashPassword(input.contrasena);
    try {
      return await this.database.withUser(null, async (client) =>
        this.insertUser(client, input, passwordHash, 'TUTOR'),
      );
    } catch (error) {
      this.translateDatabaseError(error);
    }
  }

  async insertUser(
    client: PoolClient,
    input: Pick<RegistroUsuario, 'nombre' | 'celular' | 'correo' | 'contrasena'>,
    passwordHash: string,
    role: UserRole,
  ): Promise<PublicUser> {
    const result = await client.query<PublicUser>(
      `INSERT INTO usuario (nombre, celular, correo, password_hash, rol)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,nombre,celular,correo,rol,estado,creado_en`,
      [input.nombre, input.celular, input.correo.toLowerCase(), passwordHash, role],
    );
    return result.rows[0];
  }

  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  translateDatabaseError(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      throw new ConflictException({
        code: 'ACCOUNT_EXISTS',
        message: 'Ya existe una cuenta con ese correo.',
      });
    }
    throw error;
  }
}
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
