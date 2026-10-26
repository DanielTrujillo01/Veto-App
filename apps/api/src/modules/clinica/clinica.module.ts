import { Module } from '@nestjs/common';

/**
 * Módulo clinica: Registro de consulta y anotaciones de corrección.
 *
 * Tablas propias: consulta, consulta_anotacion
 * Historias:      HU-017, 037, 042, 043
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class ClinicaModule {}
