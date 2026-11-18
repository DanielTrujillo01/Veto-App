import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { BusquedaController } from './busqueda.controller';
import { BusquedaRepository } from './busqueda.repository';
import { BusquedaService } from './busqueda.service';

@Module({
  imports: [IdentidadModule],
  controllers: [BusquedaController],
  providers: [BusquedaRepository, BusquedaService],
})
export class BusquedaModule {}
