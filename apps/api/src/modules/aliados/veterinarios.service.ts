import { promisify } from 'node:util';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import { crearVeterinarioSchema, type CrearVeterinario } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';

const scrypt = promisify(scryptCallback);

interface VeterinarioRow extends QueryResultRow {
  id: string;
  usuario_id: string;
  aliado_id: string;
  foto_url: string | null;
  descripcion: string | null;
}

@Injectable()
export class VeterinariosService {
  constructor(private readonly db: DatabaseService) {}

  async crear(actorId: string, aliadoId: string, entrada: CrearVeterinario) {
    const resultado = crearVeterinarioSchema.safeParse(entrada);
    if (!resultado.success) {
      throw new BadRequestException({
        message: 'Los datos del veterinario no son válidos',
        errors: resultado.error.flatten().fieldErrors,
      });
    }
    const datos = resultado.data;
    const passwordHash = await this.hashPassword(datos.contrasena);

    return this.db.withUser(actorId, async (client) => {
      const aliado = await client.query<{
        tipo: string;
        usuario_id: string;
        estado: string;
        rol: string;
        estado_cuenta: string;
      }>(
        `SELECT a.tipo, a.usuario_id, a.estado, u.rol, u.estado AS estado_cuenta
           FROM aliado a
           JOIN usuario u ON u.id = a.usuario_id
          WHERE a.id = $1`,
        [aliadoId],
      );
      if (aliado.rowCount === 0) {
        throw new NotFoundException('La clínica no existe');
      }
      const clinic = aliado.rows[0];
      if (clinic.tipo !== 'CLINICA' || clinic.estado !== 'ACTIVO') {
        throw new ForbiddenException('El aliado no es una clínica activa');
      }
      if (
        clinic.usuario_id !== actorId ||
        clinic.rol !== 'ALIADO' ||
        clinic.estado_cuenta !== 'ACTIVA'
      ) {
        throw new ForbiddenException(
          'Solo el administrador de la clínica puede crear veterinarios',
        );
      }

      try {
        const usuario = await client.query<{ id: string }>(
          `INSERT INTO usuario (nombre, celular, correo, password_hash, rol)
           VALUES ($1, $2, $3, $4, 'VETERINARIO')
           RETURNING id`,
          [datos.nombre, datos.celular, datos.correo, passwordHash],
        );
        const veterinario = await client.query<VeterinarioRow>(
          `INSERT INTO veterinario
             (aliado_id, usuario_id, foto_url, descripcion)
           VALUES ($1, $2, $3, $4)
           RETURNING id, usuario_id, aliado_id, foto_url, descripcion`,
          [aliadoId, usuario.rows[0].id, datos.fotoUrl ?? null, datos.descripcion ?? null],
        );
        return this.toResponse(veterinario.rows[0]);
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException('Ya existe un usuario con ese correo');
        }
        throw error;
      }
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `scrypt:${salt}:${key.toString('hex')}`;
  }

  private isUniqueViolation(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }

  private toResponse(row: VeterinarioRow) {
    return {
      id: row.id,
      usuarioId: row.usuario_id,
      aliadoId: row.aliado_id,
      fotoUrl: row.foto_url,
      descripcion: row.descripcion,
    };
  }
}
