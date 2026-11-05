import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { RequestAutenticada } from '../identidad/auth.guard';
import { VeterinariosService, type VeterinarioSesion } from './veterinarios.service';

export type RequestVeterinario = RequestAutenticada & { veterinario: VeterinarioSesion };

/**
 * HU-014: deja pasar solo a quien tiene un perfil de veterinario activo en un aliado activo.
 * Usar SIEMPRE después de AuthGuard: @UseGuards(AuthGuard, VeterinarioGuard).
 *
 * No se basa en `usuario.rol`: el veterinario independiente es un aliado (rol ALIADO) con su
 * propio perfil de veterinario, y también debe poder atender sus consultas. Lo que cuenta es
 * tener el perfil. El veterinario queda en `request.veterinario`; los endpoints deben usar ese
 * id (el de la sesión) y nunca uno enviado por el cliente.
 */
@Injectable()
export class VeterinarioGuard implements CanActivate {
  constructor(private readonly veterinarios: VeterinariosService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestVeterinario>();
    if (!request.usuario) {
      throw new UnauthorizedException('Debes iniciar sesión para acceder a este recurso');
    }

    const veterinario = await this.veterinarios.sesionDe(request.usuario.id);
    if (!veterinario) {
      throw new ForbiddenException('Tu cuenta no tiene un perfil de veterinario');
    }
    if (!veterinario.activo) {
      throw new ForbiddenException('Tu perfil de veterinario está desactivado');
    }
    if (veterinario.estadoAliado !== 'ACTIVO') {
      throw new ForbiddenException('La clínica o el consultorio al que perteneces no está activo');
    }

    request.veterinario = veterinario;
    return true;
  }
}
