import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { AliadoConfirmacionController } from './aliado-confirmacion.controller';
import { AliadoConfirmacionService } from './aliado-confirmacion.service';
import { AliadoEspeciesController } from './aliado-especies.controller';
import { AliadoEspeciesService } from './aliado-especies.service';
import { AliadosController } from './aliados.controller';
import { AliadosService } from './aliados.service';
import { ClinicasController } from './clinicas.controller';
import { VeterinarioPerfilController } from './veterinario-perfil.controller';
import { VeterinarioGuard } from './veterinario.guard';
import { VeterinariosController } from './veterinarios.controller';
import { VeterinariosService } from './veterinarios.service';
import { SedesController } from './sedes.controller';
import { SedesService } from './sedes.service';
import { AliadosController } from './aliados.controller';

/**
 * Módulo aliados: Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes.
 *
 * Tablas propias: aliado, veterinario, sede, aliado_especie
 * Historias:      HU-007, 012–016, 021, 023, 078
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule, MascotasModule],
  controllers: [
    AliadosController,
    VeterinariosController,
    VeterinarioPerfilController,
    AliadoEspeciesController,
    AliadoConfirmacionController,
    ClinicasController,
    SedesController,
    AliadosController,
  ],
  providers: [
    VeterinariosService,
    SedesService,
    AliadosService,
    AliadoEspeciesService,
    AliadoConfirmacionService,
    VeterinarioGuard,
  ],
  exports: [
    VeterinariosService,
    SedesService,
    AliadosService,
    AliadoEspeciesService,
    VeterinarioGuard,
  ],
})
export class AliadosModule {}
