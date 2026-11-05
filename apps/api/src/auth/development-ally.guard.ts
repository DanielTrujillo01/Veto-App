import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

export interface Actor {
  usuarioId: string | null;
  rol: 'ALIADO';
  aliadoId: string;
}
export type AuthenticatedRequest = Request & { auth?: Actor };

/** Simulación local temporal. Reemplazar por validación de JWT/sesión antes de integrar auth real. */
@Injectable()
export class DevelopmentAllyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (process.env.AUTH_SIMULATED !== 'true') {
      throw new UnauthorizedException({
        code: 'AUTH_NOT_CONFIGURED',
        message: 'Integra el middleware real de autenticación.',
      });
    }
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException({
        code: 'SIMULATED_AUTH_DISABLED',
        message: 'La autenticación simulada no se permite en producción.',
      });
    }
    const aliadoId = request.header('x-dev-ally-id');
    if (!aliadoId) {
      throw new UnauthorizedException({
        code: 'DEV_ALLY_ID_REQUIRED',
        message: 'Envía x-dev-ally-id con el UUID del aliado de prueba.',
      });
    }
    request.auth = { usuarioId: request.header('x-dev-user-id') ?? null, rol: 'ALIADO', aliadoId };
    return true;
  }
}
