import { Module } from '@nestjs/common';

/**
 * Módulo reportes: Dashboards y reportes (solo lectura sobre las vistas).
 *
 * Tablas propias: v_citas_reporte, v_ventas_productos
 * Historias:      HU-070, 073, 074
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class ReportesModule {}
