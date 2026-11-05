import { Module } from '@nestjs/common';
import { CitasModule } from '../citas/citas.module';
import { AuthGuard } from './auth.guard';
import { IdentidadController, RegistroUsuariosController } from './identidad.controller';
import { IdentidadService } from './identidad.service';
import { RolesGuard } from './roles.guard';

/**
 * Módulo identidad: Cuentas, registro e inicio de sesión.
 *
 * Tablas propias: usuario
 * Historias:      HU-001, 002, 006
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [CitasModule],
  controllers: [IdentidadController, RegistroUsuariosController],
  providers: [IdentidadService, AuthGuard, RolesGuard],
  exports: [IdentidadService, AuthGuard, RolesGuard],
})
export class IdentidadModule {}
