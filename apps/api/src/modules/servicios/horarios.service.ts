import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import { guardarHorariosSchema, type GuardarHorarios } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';

interface HorarioRow extends QueryResultRow {
  id: string;
  veterinario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  vigente_desde: string;
  vigente_hasta: string | null;
}

@Injectable()
export class HorariosService {
  constructor(private readonly db: DatabaseService) {}

  async guardar(
    administradorId: string,
    clinicaId: string,
    veterinarioId: string,
    entrada: GuardarHorarios,
  ) {
    const resultado = guardarHorariosSchema.safeParse(entrada);
    if (!resultado.success) {
      throw new BadRequestException({
        message: 'Los horarios no son válidos',
        errors: resultado.error.flatten().fieldErrors,
      });
    }

    return this.db.withUser(administradorId, async (client) => {
      await this.verificarAcceso(client, administradorId, clinicaId, veterinarioId);
      try {
        await client.query('DELETE FROM horario WHERE aliado_id = $1 AND veterinario_id = $2', [
          clinicaId,
          veterinarioId,
        ]);
        for (const horario of resultado.data.horarios) {
          await client.query(
            `INSERT INTO horario
               (aliado_id, veterinario_id, dia_semana, hora_inicio, hora_fin, vigente_desde, vigente_hasta)
             VALUES ($1, $2, $3, $4, $5, COALESCE($6, current_date), $7)`,
            [
              clinicaId,
              veterinarioId,
              horario.diaSemana,
              horario.horaInicio,
              horario.horaFin,
              horario.vigenteDesde ?? null,
              horario.vigenteHasta ?? null,
            ],
          );
        }
        return this.listarDesdeCliente(client, clinicaId, veterinarioId);
      } catch (error) {
        if (this.isConflict(error)) {
          throw new ConflictException('Los horarios del veterinario se solapan');
        }
        throw error;
      }
    });
  }

  async listar(administradorId: string, clinicaId: string, veterinarioId: string) {
    return this.db.withUser(administradorId, async (client) => {
      await this.verificarAcceso(client, administradorId, clinicaId, veterinarioId);
      return this.listarDesdeCliente(client, clinicaId, veterinarioId);
    });
  }

  private async verificarAcceso(
    client: PoolClient,
    administradorId: string,
    clinicaId: string,
    veterinarioId: string,
  ) {
    const resultado = await client.query<{
      tipo: string;
      estado: string;
      usuario_id: string;
      rol: string;
      estado_cuenta: string;
    }>(
      `SELECT a.tipo, a.estado, a.usuario_id, u.rol, u.estado AS estado_cuenta
         FROM aliado a
         JOIN usuario u ON u.id = a.usuario_id
         JOIN veterinario v ON v.aliado_id = a.id
        WHERE a.id = $1 AND v.id = $2`,
      [clinicaId, veterinarioId],
    );
    if (resultado.rowCount === 0) {
      throw new NotFoundException('La clínica o el veterinario no existe');
    }
    const acceso = resultado.rows[0];
    if (
      acceso.tipo !== 'CLINICA' ||
      acceso.estado !== 'ACTIVO' ||
      acceso.usuario_id !== administradorId ||
      acceso.rol !== 'ALIADO' ||
      acceso.estado_cuenta !== 'ACTIVA'
    ) {
      throw new ForbiddenException('Solo el administrador de la clínica puede gestionar horarios');
    }
  }

  private async listarDesdeCliente(client: PoolClient, clinicaId: string, veterinarioId: string) {
    const resultado = await client.query<HorarioRow>(
      `SELECT id, veterinario_id, dia_semana, hora_inicio, hora_fin, vigente_desde, vigente_hasta
         FROM horario
        WHERE aliado_id = $1 AND veterinario_id = $2
        ORDER BY dia_semana, hora_inicio`,
      [clinicaId, veterinarioId],
    );
    return resultado.rows.map((horario) => ({
      id: horario.id,
      veterinarioId: horario.veterinario_id,
      diaSemana: horario.dia_semana,
      horaInicio: horario.hora_inicio,
      horaFin: horario.hora_fin,
      vigenteDesde: horario.vigente_desde,
      vigenteHasta: horario.vigente_hasta,
    }));
  }

  private isConflict(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23P01';
  }
}
