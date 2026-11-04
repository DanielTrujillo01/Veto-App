import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { TipoAliado } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

/** Consultas sobre aliados y sedes que necesitan otros módulos (p. ej. servicios, HU-018). */
@Injectable()
export class AliadosService {
  /**
   * Comprueba que `usuarioId` administra el aliado, que la cuenta está activa, que el aliado
   * está ACTIVO y que es de uno de los `tipos` permitidos. Lanza 404 / 403 si no.
   */
  async verificarAdministrador(
    client: PoolClient,
    usuarioId: string,
    aliadoId: string,
    tipos: TipoAliado[],
  ): Promise<void> {
    const r = await client.query<{
      tipo: TipoAliado;
      estado: string;
      usuario_id: string;
      rol: string;
      estado_cuenta: string;
    }>(
      `SELECT a.tipo, a.estado, a.usuario_id, u.rol, u.estado AS estado_cuenta
         FROM aliado a JOIN usuario u ON u.id = a.usuario_id
        WHERE a.id = $1`,
      [aliadoId],
    );
    const aliado = r.rows[0];
    if (!aliado) throw new NotFoundException('El aliado no existe');
    if (
      aliado.usuario_id !== usuarioId ||
      aliado.rol !== 'ALIADO' ||
      aliado.estado_cuenta !== 'ACTIVA'
    ) {
      throw new ForbiddenException('Solo el administrador del aliado puede gestionar sus datos');
    }
    if (!tipos.includes(aliado.tipo)) {
      throw new ForbiddenException(
        `Un aliado de tipo ${aliado.tipo} no puede realizar esta acción`,
      );
    }
    if (aliado.estado !== 'ACTIVO') {
      throw new ForbiddenException('El aliado debe estar activo para realizar esta acción');
    }
  }

  /** true si la sede existe, pertenece al aliado y está activa. */
  async sedeActivaDelAliado(client: Consultor, sedeId: string, aliadoId: string) {
    const r = await client.query<{ ok: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM sede WHERE id = $1 AND aliado_id = $2 AND activa) AS ok',
      [sedeId, aliadoId],
    );
    return Boolean(r.rows[0]?.ok);
  }

  /** true si el aliado existe y está ACTIVO (visible para los tutores). */
  async estaActivo(client: Consultor, aliadoId: string) {
    const r = await client.query<{ ok: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM aliado WHERE id = $1 AND estado = 'ACTIVO') AS ok",
      [aliadoId],
    );
    return Boolean(r.rows[0]?.ok);
  }
}
