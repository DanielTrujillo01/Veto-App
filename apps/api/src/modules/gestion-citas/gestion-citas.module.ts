import { Module } from '@nestjs/common';
import { CitasModule } from '../citas/citas.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { GestionCitaController, HistorialCitaController } from './gestion-cita.controller';
import { GestionCitaService } from './gestion-cita.service';

/**
 * Módulo gestion-citas: el aliado cierra una cita (finalizada con recomendaciones para el tutor, o
 * no asistió con una observación interna), con aviso interno al tutor; y el historial de cambios de estado.
 *
 * Tablas propias: ninguna. Escribe en `cita` y `historial_estado` a través de CitasService y en
 * `notificacion` a través de NotificacionesService.
 * Historias:      HU-032, 033
 *
 * Existe aparte de `citas` porque sus endpoints necesitan los guards de identidad y identidad ya
 * depende de citas (HU-006): ponerlos en `citas` crearía una dependencia circular.
 */
@Module({
  imports: [IdentidadModule, CitasModule, NotificacionesModule],
  controllers: [GestionCitaController, HistorialCitaController],
  providers: [GestionCitaService],
})
export class GestionCitasModule {}
