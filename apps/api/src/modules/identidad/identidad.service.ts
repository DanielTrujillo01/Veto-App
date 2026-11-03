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
