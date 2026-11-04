import { Module } from '@nestjs/common';
import { AliadosModule } from '../aliados/aliados.module';
import { CitasModule } from '../citas/citas.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { HorariosController } from './horarios.controller';
import { HorariosService } from './horarios.service';
import { ServiciosController, TiposServicioController } from './servicios.controller';
import { ServiciosRepository } from './servicios.repository';
import { ServiciosService } from './servicios.service';

/**
 * Módulo servicios: Servicios, precios, horarios y búsqueda/descubrimiento.
 *
 * Tablas propias: servicio, servicio_regla_precio, horario, tipo_servicio
 * Historias:      HU-016, 018–022, 024–028
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule, AliadosModule, CitasModule],
  controllers: [HorariosController, TiposServicioController, ServiciosController],
  providers: [HorariosService, ServiciosService, ServiciosRepository],
  exports: [ServiciosService],
})
export class ServiciosModule {}
