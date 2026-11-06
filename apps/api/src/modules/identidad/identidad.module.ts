import { Module } from '@nestjs/common';
import { CitasModule } from '../citas/citas.module';
import { AuthGuard } from './auth.guard';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOAuthClient } from './google-oauth.cliente';
import { IdentidadController, RegistroUsuariosController } from './identidad.controller';
import { IdentidadService } from './identidad.service';
import { RolesGuard } from './roles.guard';

/**
 * Módulo identidad: Cuentas, registro e inicio de sesión.
 *
 * Tablas propias: usuario, cuenta_google, google_estado_oauth, google_pendiente
 * Historias:      HU-001, 002, 003, 006
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [CitasModule],
  controllers: [IdentidadController, RegistroUsuariosController, GoogleAuthController],
  providers: [IdentidadService, GoogleAuthService, GoogleOAuthClient, AuthGuard, RolesGuard],
  exports: [IdentidadService, AuthGuard, RolesGuard],
})
export class IdentidadModule {}
