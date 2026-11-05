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
import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodError } from 'zod';
import { registroUsuarioSchema } from '@veto/shared';
import { IdentidadService } from './identidad.service';

@ApiTags('identidad')
@Controller('usuarios')
export class IdentidadController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar tutor (HU-001)' })
  @ApiCreatedResponse({ description: 'Cuenta creada; la contraseña nunca se devuelve.' })
  async register(@Body() body: unknown) {
    try {
      const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const input = registroUsuarioSchema.parse({
        ...payload,
        contrasena: payload.contrasena ?? payload.password,
      });
      return { data: await this.identidad.createTutor(input) };
    } catch (error) {
      if (error instanceof ZodError)
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: error.issues[0]?.message ?? 'Datos inválidos.',
        });
      throw error;
    }
  }
}
