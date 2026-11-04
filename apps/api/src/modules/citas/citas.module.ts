import { Module } from '@nestjs/common';
import { CitasService } from './citas.service';

/**
 * Módulo citas: Agendamiento y ciclo de vida de la cita.
 *
 * Tablas propias: cita, historial_estado
 * Historias:      HU-029, 031, 032, 034
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  providers: [CitasService],
  exports: [CitasService],
})
export class CitasModule {}
