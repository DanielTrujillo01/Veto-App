import { Module } from '@nestjs/common';
import { AliadosModule } from '../aliados/aliados.module';
import { CitasModule } from '../citas/citas.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { ServiciosModule } from '../servicios/servicios.module';
import { CitaDetalleController, ReservaController } from './reserva.controller';
import { ReservaService } from './reserva.service';
import { SeleccionHorarioController } from './seleccion-horario.controller';
import { SeleccionHorarioService } from './seleccion-horario.service';

/**
 * Módulo reservas: el flujo con que el tutor reserva una cita (elegir fecha y hora, indicar
 * mascota y motivo, revisar y confirmar) y el detalle de una cita para quien puede verla.
 *
 * Tablas propias: ninguna. Escribe en `seleccion_horario` y `cita` a través de CitasService.
 * Historias:      HU-029, 030, 031
 *
 * Existe aparte porque necesita a servicios (disponibilidad), aliados, mascotas y citas a la vez
 * y servicios ya depende de citas: ponerlo en cualquiera de los dos crearía una dependencia circular.
 */
@Module({
  imports: [IdentidadModule, AliadosModule, MascotasModule, CitasModule, ServiciosModule],
  controllers: [SeleccionHorarioController, ReservaController, CitaDetalleController],
  providers: [SeleccionHorarioService, ReservaService],
})
export class ReservasModule {}
