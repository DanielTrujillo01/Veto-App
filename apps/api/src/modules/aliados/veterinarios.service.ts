import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import {
  type actualizarPerfilVeterinarioSchema,
  type ActualizarPerfilVeterinario,
  type CrearVeterinario,
  crearVeterinarioSchema,
  type CrearVeterinario,
  type EstadoAliado,
  type TipoAliado,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { hashContrasena } from '../identidad/seguridad';

/** Perfil de veterinario de la cuenta autenticada, con el estado de su aliado (HU-014). */
export interface VeterinarioSesion {
  id: string;
  aliadoId: string;
  aliadoNombre: string;
  aliadoTipo: TipoAliado;
  estadoAliado: EstadoAliado;
  fotoUrl: string | null;
  descripcion: string | null;
  activo: boolean;
}

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

  async listarClinicas() {
    const resultado = await this.db.query<{
      id: string;
      nombre: string;
      descripcion: string | null;
    }>(
      `SELECT id, nombre, descripcion FROM aliado
        WHERE tipo = 'CLINICA' AND estado = 'ACTIVO' ORDER BY nombre`,
    );
    return resultado.rows;
  }

  async listarPublicos(clinicaId: string) {
    const clinica = await this.db.query<{ id: string; nombre: string; descripcion: string | null }>(
      `SELECT id, nombre, descripcion FROM aliado
        WHERE id = $1 AND tipo = 'CLINICA' AND estado = 'ACTIVO'`,
      [clinicaId],
    );
    if (clinica.rowCount === 0) throw new NotFoundException('La clínica no existe');
    const veterinarios = await this.db.query<VeterinarioRow & { nombre: string }>(
      `SELECT v.id, v.usuario_id, v.aliado_id, v.foto_url, v.descripcion, u.nombre
         FROM veterinario v JOIN usuario u ON u.id = v.usuario_id
        WHERE v.aliado_id = $1 AND v.activo ORDER BY u.nombre`,
      [clinicaId],
    );
    return {
      id: clinica.rows[0].id,
      nombre: clinica.rows[0].nombre,
      descripcion: clinica.rows[0].descripcion,
      veterinarios: veterinarios.rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        fotoUrl: row.foto_url,
        descripcion: row.descripcion,
      })),
    };
  }

  async actualizarPerfil(
    actorId: string,
    clinicaId: string,
    veterinarioId: string,
    entrada: ActualizarPerfilVeterinario,
  ) {
    const resultado = actualizarPerfilVeterinarioSchema.safeParse(entrada);
    if (!resultado.success) {
      throw new BadRequestException({
        message: 'Los datos del perfil no son válidos',
        errors: resultado.error.flatten().fieldErrors,
      });
    }
    return this.db.withUser(actorId, async (client) => {
      const admin = await client.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM aliado a JOIN usuario u ON u.id = a.usuario_id
            WHERE a.id = $1 AND a.tipo = 'CLINICA' AND a.estado = 'ACTIVO'
              AND a.usuario_id = $2 AND u.rol = 'ALIADO' AND u.estado = 'ACTIVA'
         ) AS ok`,
        [clinicaId, actorId],
      );
      if (!admin.rows[0]?.ok) throw new ForbiddenException('No puedes gestionar esta clínica');
      const cambios = resultado.data;
      const campos = Object.keys(cambios);
      const valores: unknown[] = [veterinarioId, clinicaId];
      const asignaciones = campos.map((campo) => {
        valores.push(cambios[campo as keyof typeof cambios]);
        return `${campo === 'fotoUrl' ? 'foto_url' : 'descripcion'} = $${valores.length}`;
      });
      const actualizado = await client.query<VeterinarioRow>(
        `UPDATE veterinario SET ${asignaciones.join(', ')}
          WHERE id = $1 AND aliado_id = $2 AND activo
          RETURNING id, usuario_id, aliado_id, foto_url, descripcion`,
        valores,
      );
      if (actualizado.rowCount === 0) throw new NotFoundException('El veterinario no existe');
      return this.toResponse(actualizado.rows[0]);
    });
  }

  async crear(actorId: string, aliadoId: string, entrada: CrearVeterinario) {
    const resultado = crearVeterinarioSchema.safeParse(entrada);
    if (!resultado.success) {
      throw new BadRequestException({
        message: 'Los datos del veterinario no son válidos',
        errors: resultado.error.flatten().fieldErrors,
      });
    }
    const datos = resultado.data;
    const passwordHash = await hashContrasena(datos.contrasena);

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

  /**
   * HU-014: perfil de veterinario de una cuenta, o null si la cuenta no tiene uno.
   * Se busca por la cuenta autenticada (nunca por un id que mande el cliente).
   */
  async sesionDe(usuarioId: string): Promise<VeterinarioSesion | null> {
    const r = await this.db.query<{
      id: string;
      aliado_id: string;
      aliado_nombre: string;
      aliado_tipo: TipoAliado;
      estado_aliado: EstadoAliado;
      foto_url: string | null;
      descripcion: string | null;
      activo: boolean;
    }>(
      `SELECT v.id, v.aliado_id, a.nombre AS aliado_nombre, a.tipo AS aliado_tipo,
              a.estado AS estado_aliado, v.foto_url, v.descripcion, v.activo
         FROM veterinario v
         JOIN aliado a ON a.id = v.aliado_id
        WHERE v.usuario_id = $1`,
      [usuarioId],
    );
    const fila = r.rows[0];
    if (!fila) return null;
    return {
      id: fila.id,
      aliadoId: fila.aliado_id,
      aliadoNombre: fila.aliado_nombre,
      aliadoTipo: fila.aliado_tipo,
      estadoAliado: fila.estado_aliado,
      fotoUrl: fila.foto_url,
      descripcion: fila.descripcion,
      activo: fila.activo,
    };
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
