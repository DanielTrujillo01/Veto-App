import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type {
  ActualizarPerfilVeterinario,
  CrearVeterinario,
  EstadoAliado,
  TipoAliado,
} from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { IdentidadService } from '../identidad/identidad.service';
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
  constructor(
    private readonly db: DatabaseService,
    private readonly identidad: IdentidadService,
  ) {}

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

  /**
   * HU-013: ficha pública de la clínica con la foto y descripción de cada veterinario.
   * Solo muestra veterinarios activos con cuenta activa (no los eliminados ni suspendidos).
   */
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
        WHERE v.aliado_id = $1 AND v.activo AND u.estado = 'ACTIVA'
        ORDER BY u.nombre, v.id`,
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

  /** HU-013: el administrador de la clínica cambia la foto o la descripción (ya validadas). */
  async actualizarPerfil(
    actorId: string,
    clinicaId: string,
    veterinarioId: string,
    entrada: ActualizarPerfilVeterinario,
  ) {
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
      const cambios = entrada;
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
    const datos = entrada;
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
        const usuario = await this.identidad.insertUser(client, datos, passwordHash, 'VETERINARIO');
        const veterinario = await client.query<VeterinarioRow>(
          `INSERT INTO veterinario
             (aliado_id, usuario_id, foto_url, descripcion)
           VALUES ($1, $2, $3, $4)
           RETURNING id, usuario_id, aliado_id, foto_url, descripcion`,
          [aliadoId, usuario.id, datos.fotoUrl ?? null, datos.descripcion ?? null],
        );
        return this.toResponse(veterinario.rows[0]);
      } catch (error) {
        if (esErrorPg(error, PG.UNICO)) {
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

  /** HU-022: true si el veterinario existe y pertenece a ese aliado. */
  async perteneceAlAliado(client: Consultor, aliadoId: string, veterinarioId: string) {
    const r = await client.query<{ ok: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM veterinario WHERE id = $1 AND aliado_id = $2) AS ok',
      [veterinarioId, aliadoId],
    );
    return Boolean(r.rows[0]?.ok);
  }

  /**
   * HU-022: veterinarios del aliado que pueden recibir reservas (perfil activo y cuenta activa).
   * Con `veterinarioId` devuelve solo ese, si cumple.
   */
  async paraReservar(client: Consultor, aliadoId: string, veterinarioId?: string) {
    const r = await client.query<{ id: string; nombre: string }>(
      `SELECT v.id, u.nombre
         FROM veterinario v JOIN usuario u ON u.id = v.usuario_id
        WHERE v.aliado_id = $1 AND v.activo AND u.estado = 'ACTIVA'
          AND ($2::uuid IS NULL OR v.id = $2)
        ORDER BY u.nombre, v.id`,
      [aliadoId, veterinarioId ?? null],
    );
    return r.rows;
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
