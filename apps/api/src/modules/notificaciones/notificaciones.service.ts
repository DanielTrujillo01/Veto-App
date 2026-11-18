import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';

/** Tipos de notificación que ya se generan (columna `notificacion.tipo`). */
export type TipoDeNotificacion = 'CITA_FINALIZADA' | 'CITA_NO_ASISTIO';

export type NuevaNotificacion = {
  /** A quién se avisa. */
  usuarioId: string;
  tipo: TipoDeNotificacion;
  mensaje: string;
  /** Lo que la origina (la cita, el pedido...). */
  referenciaId?: string;
};

/**
 * Notificaciones internas de la aplicación (tabla `notificacion`). Otros módulos las crean a
 * través de este servicio; leerlas y marcarlas como leídas son las historias 052 y 054.
 */
@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  /** Crea la notificación con el `client` de la transacción abierta. */
  async crear(client: PoolClient, datos: NuevaNotificacion): Promise<void> {
    await client.query(
      `INSERT INTO notificacion (usuario_id, tipo, mensaje, referencia_id)
       VALUES ($1, $2, $3, $4)`,
      [datos.usuarioId, datos.tipo, datos.mensaje, datos.referenciaId ?? null],
    );
  }

  /**
   * Crea la notificación sin poner en riesgo lo que ya se hizo en la transacción: si falla, se
   * deshace solo la notificación (un SAVEPOINT) y el resto se puede confirmar. Devuelve false
   * cuando no se pudo crear. Úsala después de la escritura principal, nunca antes.
   */
  async crearSinRomper(client: PoolClient, datos: NuevaNotificacion): Promise<boolean> {
    await client.query('SAVEPOINT notificacion');
    try {
      await this.crear(client, datos);
      await client.query('RELEASE SAVEPOINT notificacion');
      return true;
    } catch (error) {
      await client.query('ROLLBACK TO SAVEPOINT notificacion');
      this.logger.error(
        `No se pudo crear la notificación ${datos.tipo} para ${datos.usuarioId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return false;
    }
  }
}
