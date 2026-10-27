import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { IdentidadService, type UsuarioSesion } from './identidad.service';

export type RequestAutenticada = Request & { usuario: UsuarioSesion };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly identidad: IdentidadService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const usuario = await this.identidad.usuarioDeSesion(request.headers.cookie);
    if (!usuario)
      throw new UnauthorizedException('Debes iniciar sesión para acceder a este recurso');
    (request as RequestAutenticada).usuario = usuario;
    return true;
  }
}
