import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolUsuario } from '@veto/shared';
import type { RequestAutenticada } from './auth.guard';

const CLAVE_ROLES = 'veto:roles';

/** Restringe un endpoint a ciertos roles. Úsalo junto con AuthGuard: @UseGuards(AuthGuard, RolesGuard). */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(CLAVE_ROLES, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RolUsuario[] | undefined>(CLAVE_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const { usuario } = context.switchToHttp().getRequest<RequestAutenticada>();
    if (!usuario || !roles.includes(usuario.rol as RolUsuario)) {
      throw new ForbiddenException('Tu tipo de cuenta no tiene permiso para esta acción');
    }
    return true;
  }
}
