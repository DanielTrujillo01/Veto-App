import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { DevelopmentAllyGuard } from '../../auth/development-ally.guard';
import { AliadosController } from './aliados.controller';
import { AliadosService } from './aliados.service';

@Module({
  imports: [IdentidadModule],
  controllers: [AliadosController],
  providers: [AliadosService, DevelopmentAllyGuard],
  exports: [AliadosService],
})
export class AliadosModule {}
