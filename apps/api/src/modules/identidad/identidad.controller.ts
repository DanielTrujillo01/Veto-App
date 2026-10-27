import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { loginSchema } from '@veto/shared';
import type { Request, Response } from 'express';
import { AuthGuard, type RequestAutenticada } from './auth.guard';
import { IdentidadService, NOMBRE_COOKIE_SESION } from './identidad.service';

@ApiTags('identidad')
@Controller('identidad')
export class IdentidadController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión con correo y contraseña' })
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const validacion = loginSchema.safeParse(body);
    if (!validacion.success) {
      throw new BadRequestException({
        message: 'Revisa los datos ingresados',
        errores: Object.fromEntries(
          validacion.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
        ),
      });
    }

    const resultado = await this.identidad.iniciarSesion(
      validacion.data.correo,
      validacion.data.contrasena,
    );
    if (!resultado) throw new UnauthorizedException('El correo o la contraseña no son correctos');

    const seguro = process.env.NODE_ENV === 'production';
    response.setHeader(
      'Set-Cookie',
      `${NOMBRE_COOKIE_SESION}=${resultado.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800${seguro ? '; Secure' : ''}`,
    );
    return { usuario: resultado.usuario };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Obtener el usuario autenticado' })
  me(@Req() request: Request) {
    const autenticada = request as RequestAutenticada;
    return { usuario: autenticada.usuario };
  }
}
