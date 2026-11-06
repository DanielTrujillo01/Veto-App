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

export type FundacionRevision = {
  id: string;
  nombre: string;
  descripcion: string | null;
  logoUrl: string | null;
  contacto: string | null;
  ciudad: string | null;
  ubicacion: string | null;
  anioFundacion: number | null;
  estado: EstadoAliado;
  creadoEn: string;
  representante: string;
  correo: string;
  celular: string;
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
        const user = await this.identidad.insertUser(client, userInput, passwordHash, 'ALIADO');
        const result = await client.query(
          `INSERT INTO aliado (
              usuario_id,
              tipo,
              nombre,
              descripcion,
              contacto,
              estado,
              ciudad,
              ubicacion
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          RETURNING
              id,
              usuario_id,
              tipo,
              nombre,
              descripcion,
              contacto,
              estado,
              ciudad,
              ubicacion,
              creado_en`,
          [
            usuario.id,
            input.tipo,
            input.nombreAliado ?? input.nombre,
            input.descripcion ?? null,
            input.contacto ?? null,
            'ACTIVO',
            input.ciudad ?? null,
            input.ubicacion ?? null,
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

  /** HU-079: lista las solicitudes de fundación que aún no tienen una decisión. */
  async listarFundacionesPendientes(client: Consultor) {
    const r = await client.query<{
      id: string;
      nombre: string;
      contacto: string;
      ciudad: string;
      estado: EstadoAliado;
      creadoEn: Date | string;
      representante: string;
      correo: string;
      celular: string;
    }>(
      `SELECT a.id, a.nombre, a.contacto, a.ciudad, a.estado,
              a.creado_en AS "creadoEn", u.nombre AS representante, u.correo, u.celular
         FROM aliado a JOIN usuario u ON u.id = a.usuario_id
        WHERE a.tipo = 'FUNDACION' AND a.estado = 'PENDIENTE'
        ORDER BY a.creado_en, a.id`,
    );
    return r.rows.map((fila) => ({ ...fila, creadoEn: new Date(fila.creadoEn).toISOString() }));
  }

  /** HU-079: consulta los datos que la fundación envió, solo para revisión administrativa. */
  async obtenerFundacionParaRevision(
    client: Consultor,
    fundacionId: string,
  ): Promise<FundacionRevision> {
    const r = await client.query<Omit<FundacionRevision, 'creadoEn'> & { creadoEn: Date | string }>(
      `SELECT a.id, a.nombre, a.descripcion, a.logo_url AS "logoUrl", a.contacto, a.ciudad,
              a.ubicacion, a.anio_fundacion AS "anioFundacion", a.estado,
              a.creado_en AS "creadoEn", u.nombre AS representante, u.correo, u.celular
         FROM aliado a JOIN usuario u ON u.id = a.usuario_id
        WHERE a.id = $1 AND a.tipo = 'FUNDACION'`,
      [fundacionId],
    );
    const fila = r.rows[0];
    if (!fila) throw new NotFoundException('La fundación no existe');
    return { ...fila, creadoEn: new Date(fila.creadoEn).toISOString() };
  }

  /** HU-079: una segunda decisión concurrente no puede sobreescribir la primera. */
  async decidirFundacion(
    client: Consultor,
    fundacionId: string,
    estado: Extract<EstadoAliado, 'ACTIVO' | 'RECHAZADO'>,
  ): Promise<{ id: string; nombre: string; estado: EstadoAliado }> {
    const r = await client.query<{ id: string; nombre: string; estado: EstadoAliado }>(
      `UPDATE aliado
          SET estado = $2
        WHERE id = $1 AND tipo = 'FUNDACION' AND estado = 'PENDIENTE'
        RETURNING id, nombre, estado`,
      [fundacionId, estado],
    );
    const fundacion = r.rows[0];
    if (fundacion) return fundacion;

    const existente = await client.query<{ estado: EstadoAliado }>(
      `SELECT estado FROM aliado WHERE id = $1 AND tipo = 'FUNDACION'`,
      [fundacionId],
    );
    if (!existente.rows[0]) throw new NotFoundException('La fundación no existe');
    throw new ConflictException('La solicitud ya fue resuelta o no está pendiente');
  }

  /** HU-079: la fundación consulta únicamente el estado de su propia solicitud. */
  async estadoFundacionPropia(usuarioId: string) {
    return this.database.withUser(usuarioId, async (client) => {
      const r = await client.query<{ id: string; estado: EstadoAliado }>(
        `SELECT id, estado FROM aliado WHERE usuario_id = $1 AND tipo = 'FUNDACION'`,
        [usuarioId],
      );
      const fundacion = r.rows[0];
      if (!fundacion) throw new NotFoundException('No tienes una solicitud de fundación');
      return fundacion;
    });
  }
}
