import { Module } from '@nestjs/common';
import { IdentidadModule } from '../identidad/identidad.module';
import { MascotasModule } from '../mascotas/mascotas.module';
import { AliadoEspeciesController } from './aliado-especies.controller';
import { AliadoEspeciesService } from './aliado-especies.service';
import { AliadosService } from './aliados.service';
import { VeterinarioPerfilController } from './veterinario-perfil.controller';
import { VeterinarioGuard } from './veterinario.guard';
import { VeterinariosController } from './veterinarios.controller';
import { VeterinariosService } from './veterinarios.service';

/**
 * Módulo aliados: Clínicas, veterinarios independientes, tiendas y fundaciones; veterinarios y sedes.
 *
 * Tablas propias: aliado, veterinario, sede, aliado_especie
 * Historias:      HU-007, 012–016, 021, 078
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule, MascotasModule],
  controllers: [VeterinariosController, VeterinarioPerfilController, AliadoEspeciesController],
  providers: [VeterinariosService, AliadosService, AliadoEspeciesService, VeterinarioGuard],
  exports: [VeterinariosService, AliadosService, AliadoEspeciesService, VeterinarioGuard],
})
export class AliadosModule {}
