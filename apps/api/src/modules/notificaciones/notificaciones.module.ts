import { Module } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

/**
 * Módulo notificaciones: Notificaciones internas de la aplicación.
 *
 * Tablas propias: notificacion
 * Historias:      HU-048, 052, 054 (listar y marcar como leídas); crea las de HU-032
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  providers: [NotificacionesService],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
