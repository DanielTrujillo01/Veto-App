import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { IdentidadModule } from './modules/identidad/identidad.module';
import { AliadosModule } from './modules/aliados/aliados.module';
import { MascotasModule } from './modules/mascotas/mascotas.module';
import { ServiciosModule } from './modules/servicios/servicios.module';
import { CitasModule } from './modules/citas/citas.module';
import { ClinicaModule } from './modules/clinica/clinica.module';
import { ComercioModule } from './modules/comercio/comercio.module';
import { AdopcionModule } from './modules/adopcion/adopcion.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportesModule } from './modules/reportes/reportes.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    IdentidadModule,
    AliadosModule,
    MascotasModule,
    ServiciosModule,
    CitasModule,
    ClinicaModule,
    ComercioModule,
    AdopcionModule,
    AdminModule,
    ReportesModule,
    NotificacionesModule,
  ],
})
export class AppModule {}
