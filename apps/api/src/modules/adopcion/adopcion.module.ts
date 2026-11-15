import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { AdopcionController } from './adopcion.controller';
import { AdopcionRepository } from './adopcion.repository';
import { AdopcionService } from './adopcion.service';

/**
 * Módulo adopcion: Mascotas en adopción y solicitudes.
 *
 * Tablas propias: mascota_adopcion, solicitud_adopcion
 * Historias:      HU-080, 082, 083, 086, 087, 090, 092–094
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule],
  controllers: [AdopcionController],
  providers: [AdopcionService, AdopcionRepository],
  exports: [AdopcionService],
})
export class AdopcionModule {}
