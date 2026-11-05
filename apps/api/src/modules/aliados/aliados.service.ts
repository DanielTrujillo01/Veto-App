import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { IdentidadService } from '../identidad/identidad.service';
import type { RegistroAliado, SedeInput } from '@veto/shared';
import type { PoolClient } from 'pg';
import type { TipoAliado } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

type UserRegistration = { nombre: string; celular: string; correo: string; contrasena: string };
type Branch = {
  id: string;
  aliado_id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  activa: boolean;
};

@Injectable()
export class AliadosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly identidad: IdentidadService,
  ) {}

  async register(input: RegistroAliado) {
    const userInput: UserRegistration = {
      nombre: input.nombre,
      celular: input.celular,
      correo: input.correo,
      contrasena: input.contrasena,
    };
    const passwordHash = await this.identidad.hashPassword(userInput.contrasena);
    try {
      return await this.database.withUser(null, async (client) => {
        const user = await this.identidad.insertUser(client, userInput, passwordHash, 'ALIADO');
        const result = await client.query(
          `INSERT INTO aliado (usuario_id,tipo,nombre,descripcion,contacto)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id,usuario_id,tipo,nombre,descripcion,contacto,estado,creado_en`,
          [
            user.id,
            input.tipo,
            input.nombreAliado ?? input.nombre,
            input.descripcion ?? null,
            input.contacto ?? null,
          ],
        );
        const ally = result.rows[0];
        if (input.tipo === 'VET_INDEPENDIENTE') {
          await client.query('INSERT INTO veterinario (aliado_id,usuario_id) VALUES ($1,$2)', [
            ally.id,
            user.id,
          ]);
        }
        return { usuario: user, aliado: ally };
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new ConflictException({
          code: 'ACCOUNT_EXISTS',
          message: 'Ya existe una cuenta con ese correo.',
        });
      }
      throw error;
    }
  }

  private async assertClinic(allyId: string): Promise<void> {
    const result = await this.database.query<{ tipo: string }>(
      'SELECT tipo FROM aliado WHERE id=$1',
      [allyId],
    );
    if (!result.rowCount)
      throw new NotFoundException({ code: 'ALLY_NOT_FOUND', message: 'No se encontró el aliado.' });
    if (result.rows[0].tipo !== 'CLINICA')
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Solo una clínica puede gestionar sedes.',
      });
  }

  async createBranch(allyId: string, input: SedeInput): Promise<Branch> {
    await this.assertClinic(allyId);
    return this.database.withUser(null, async (client) => {
      const result = await client.query<Branch>(
        `INSERT INTO sede (aliado_id,nombre,direccion,ciudad) VALUES ($1,$2,$3,$4)
         RETURNING id,aliado_id,nombre,direccion,ciudad,activa`,
        [allyId, input.nombre, input.direccion, input.ciudad],
      );
      return result.rows[0];
    });
  }

  async listBranches(allyId: string, includeInactive = false): Promise<Branch[]> {
    await this.assertClinic(allyId);
    const result = await this.database.query<Branch>(
      `SELECT id,aliado_id,nombre,direccion,ciudad,activa FROM sede
       WHERE aliado_id=$1 AND ($2::boolean OR activa) ORDER BY nombre`,
      [allyId, includeInactive],
    );
    return result.rows;
  }

  async updateBranch(allyId: string, branchId: string, input: SedeInput): Promise<Branch> {
    await this.assertClinic(allyId);
    return this.branchMutation(
      allyId,
      branchId,
      'UPDATE sede SET nombre=$3,direccion=$4,ciudad=$5 WHERE aliado_id=$1 AND id=$2',
      [input.nombre, input.direccion, input.ciudad],
    );
  }

  async deactivateBranch(allyId: string, branchId: string): Promise<Branch> {
    await this.assertClinic(allyId);
    return this.branchMutation(
      allyId,
      branchId,
      'UPDATE sede SET activa=false WHERE aliado_id=$1 AND id=$2',
      [],
    );
  }

  private async branchMutation(
    allyId: string,
    branchId: string,
    updateSql: string,
    extra: unknown[],
  ): Promise<Branch> {
    return this.database.withUser(null, async (client) => {
      const result = await client.query<Branch>(
        `${updateSql} RETURNING id,aliado_id,nombre,direccion,ciudad,activa`,
        [allyId, branchId, ...extra],
      );
      if (!result.rowCount)
        throw new NotFoundException({
          code: 'BRANCH_NOT_FOUND',
          message: 'No se encontró la sede de esta clínica.',
        });
      return result.rows[0];
    });
  }

  async assertCanOfferServices(allyId: string): Promise<void> {
    const result = await this.database.query<{ tipo: string }>(
      'SELECT tipo FROM aliado WHERE id=$1',
      [allyId],
    );
    if (!result.rowCount)
      throw new NotFoundException({ code: 'ALLY_NOT_FOUND', message: 'No se encontró el aliado.' });
    if (!['CLINICA', 'VET_INDEPENDIENTE'].includes(result.rows[0].tipo)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Solo una clínica o veterinario independiente puede ofrecer servicios.',
      });
    }
  }

  async assertActiveBranch(allyId: string, branchId: string): Promise<void> {
    const result = await this.database.query<{ activa: boolean }>(
      'SELECT activa FROM sede WHERE id=$1 AND aliado_id=$2',
      [branchId, allyId],
    );
    if (!result.rowCount || !result.rows[0].activa) {
      throw new ConflictException({
        code: 'INVALID_BRANCH',
        message: 'La sede debe existir y estar activa para este aliado.',
      });
    }
  }

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
