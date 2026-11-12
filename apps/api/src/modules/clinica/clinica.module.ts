import { Module } from '@nestjs/common';
import { AliadosModule } from '../aliados/aliados.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { ConsultasController } from './consultas.controller';
import { ConsultasRepository } from './consultas.repository';
import { ConsultasService } from './consultas.service';

/**
 * Módulo clinica: Registro de consulta y anotaciones de corrección.
 *
 * Tablas propias: consulta, consulta_anotacion (y la vista v_consulta_detalle)
 * Historias:      HU-014 (consultas del veterinario), 017, 037, 042, 043
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule, AliadosModule],
  controllers: [ConsultasController],
  providers: [ConsultasService, ConsultasRepository],
  exports: [ConsultasService],
})
export class ClinicaModule {}
