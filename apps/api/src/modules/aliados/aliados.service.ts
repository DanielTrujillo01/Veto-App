import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { EstadoAliado, PerfilUsuario, RegistroAliado, TipoAliado } from '@veto/shared';
import { DatabaseService, type Consultor } from '../../database/database.service';
import { esErrorPg, PG } from '../../common/validacion';
import { IdentidadService } from '../identidad/identidad.service';
import { hashContrasena } from '../identidad/seguridad';

/** Aliado recién registrado (HU-007), en camelCase como el resto de la API. */
export type AliadoRegistrado = {
  id: string;
  tipo: TipoAliado;
  nombre: string;
  descripcion: string | null;
  contacto: string | null;
  estado: EstadoAliado;
  creadoEn: string;
};

@Injectable()
export class AliadosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly identidad: IdentidadService,
  ) {}

  /**
   * HU-007: registra la cuenta y el aliado en una sola transacción. El aliado queda PENDIENTE
   * hasta que el Equipo Veto lo active. Un veterinario independiente recibe también su perfil
   * de veterinario, para poder tener horarios y citas.
   */
  async register(
    input: RegistroAliado,
  ): Promise<{ usuario: PerfilUsuario; aliado: AliadoRegistrado }> {
    const passwordHash = await hashContrasena(input.contrasena);
    try {
      return await this.database.withUser(null, async (client) => {
        const usuario = await this.identidad.insertUser(client, input, passwordHash, 'ALIADO');
        const r = await client.query<{
          id: string;
          tipo: TipoAliado;
          nombre: string;
          descripcion: string | null;
          contacto: string | null;
          estado: EstadoAliado;
          creado_en: Date | string;
        }>(
          `INSERT INTO aliado (usuario_id, tipo, nombre, descripcion, contacto)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, tipo, nombre, descripcion, contacto, estado, creado_en`,
          [
            usuario.id,
            input.tipo,
            input.nombreAliado ?? input.nombre,
            input.descripcion ?? null,
            input.contacto ?? null,
          ],
        );
        const fila = r.rows[0];
        if (input.tipo === 'VET_INDEPENDIENTE') {
          await client.query('INSERT INTO veterinario (aliado_id, usuario_id) VALUES ($1, $2)', [
            fila.id,
            usuario.id,
          ]);
        }
        const aliado: AliadoRegistrado = {
          id: fila.id,
          tipo: fila.tipo,
          nombre: fila.nombre,
          descripcion: fila.descripcion,
          contacto: fila.contacto,
          estado: fila.estado,
          creadoEn: new Date(fila.creado_en).toISOString(),
        };
        return { usuario, aliado };
      });
    } catch (error) {
      if (esErrorPg(error, PG.UNICO)) {
        throw new ConflictException('Ya existe una cuenta con ese correo');
      }
      throw error;
    }
  }

  async obtenerDeUsuario(usuarioId: string): Promise<AliadoRegistrado> {
    const resultado = await this.database.query<{
      id: string;
      tipo: TipoAliado;
      nombre: string;
      descripcion: string | null;
      contacto: string | null;
      estado: EstadoAliado;
      creado_en: Date | string;
    }>(
      `SELECT id, tipo, nombre, descripcion, contacto, estado, creado_en
         FROM aliado
        WHERE usuario_id = $1`,
      [usuarioId],
    );
    const fila = resultado.rows[0];
    if (!fila) throw new NotFoundException('Esta cuenta no tiene un aliado asociado');
    return {
      id: fila.id,
      tipo: fila.tipo,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      contacto: fila.contacto,
      estado: fila.estado,
      creadoEn: new Date(fila.creado_en).toISOString(),
    };
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
