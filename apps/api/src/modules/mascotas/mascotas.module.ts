import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { MascotasController } from './mascotas.controller';
import { MascotasRepository } from './mascotas.repository';
import { MascotasService } from './mascotas.service';

/**
 * Módulo mascotas: Mascotas del tutor y su historial.
 *
 * Tablas propias: mascota, mascota_foto, especie
 * Historias:      HU-008–011
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule],
  controllers: [MascotasController],
  providers: [MascotasService, MascotasRepository],
  exports: [MascotasService],
})
export class MascotasModule {}
