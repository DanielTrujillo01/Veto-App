import { Injectable, NotFoundException } from '@nestjs/common';
import {
  confirmacionDe,
  type ConfirmacionAliado,
  type GuardarConfirmacion,
  type ModoConfirmacion,
  type TipoAliado,
} from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { AliadosService } from './aliados.service';

/** Aliados Vet: las clínicas y los veterinarios independientes (los que reciben citas). */
const TIPOS_CON_CITAS: TipoAliado[] = ['CLINICA', 'VET_INDEPENDIENTE'];

/**
 * HU-023: modo de confirmación de las citas del aliado (columna aliado.modo_confirmacion).
 *
 * Esta clase solo guarda y lee la configuración. El estado con que nace cada cita lo fija la
 * base de datos al insertarla (trigger fn_cita_validar), así que HU-029 no puede saltarse la
 * configuración ni dejar al tutor con un estado distinto.
 */
@Injectable()
export class AliadoConfirmacionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly aliados: AliadosService,
  ) {}

  /** Público (ficha del aliado y paso previo a reservar): 404 si el aliado no está activo. */
  async obtenerPublica(aliadoId: string): Promise<ConfirmacionAliado> {
    const r = await this.db.query<{ modo_confirmacion: ModoConfirmacion }>(
      `SELECT modo_confirmacion FROM aliado
        WHERE id = $1 AND estado = 'ACTIVO' AND tipo = ANY($2::tipo_aliado[])`,
      [aliadoId, TIPOS_CON_CITAS],
    );
    const fila = r.rows[0];
    if (!fila) throw new NotFoundException('El aliado no existe');
    return confirmacionDe(fila.modo_confirmacion);
  }

  /**
   * Cambia el modo. Solo el administrador de una clínica o de un veterinario independiente
   * activo. Aplica a las reservas nuevas: las citas pendientes no se confirman solas.
   */
  async guardar(
    usuarioId: string,
    aliadoId: string,
    datos: GuardarConfirmacion,
  ): Promise<ConfirmacionAliado> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_CITAS);
      const r = await client.query<{ modo_confirmacion: ModoConfirmacion }>(
        'UPDATE aliado SET modo_confirmacion = $2 WHERE id = $1 RETURNING modo_confirmacion',
        [aliadoId, datos.modo],
      );
      return confirmacionDe(r.rows[0].modo_confirmacion);
    });
  }
}
