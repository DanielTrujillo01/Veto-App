import { Module } from '@nestjs/common';
import { DevelopmentAllyGuard } from '../../auth/development-ally.guard';
import { AliadosModule } from '../aliados/aliados.module';
import { PublicServiciosController, ServiciosController } from './servicios.controller';
import { ServiciosService } from './servicios.service';

@Module({
  imports: [AliadosModule],
  controllers: [ServiciosController, PublicServiciosController],
  providers: [ServiciosService, DevelopmentAllyGuard],
})
export class ServiciosModule {}
