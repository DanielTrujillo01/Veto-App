import { Module } from '@nestjs/common';

/**
 * Módulo admin: Moderación y estado de cuentas del Equipo Veto.
 *
 * Tablas propias: accion_admin
 * Historias:      HU-065, 066, 067
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class AdminModule {}
