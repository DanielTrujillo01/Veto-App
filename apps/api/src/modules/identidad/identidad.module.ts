import { Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { IdentidadController } from './identidad.controller';
import { IdentidadService } from './identidad.service';

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
  controllers: [IdentidadController],
  providers: [IdentidadService, AuthGuard],
  exports: [IdentidadService, AuthGuard],
})
export class IdentidadModule {}
