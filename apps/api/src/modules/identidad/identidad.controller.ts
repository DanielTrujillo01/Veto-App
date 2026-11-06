import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  actualizarPerfilSchema,
  codigo2faSchema,
  desafio2faSchema,
  eliminarCuentaSchema,
  loginSchema,
  registroUsuarioSchema,
} from '@veto/shared';
import type { Response } from 'express';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from './auth.guard';
import { IdentidadService, NOMBRE_COOKIE_SESION } from './identidad.service';

function cookieSesion(valor: string, maxAge: number): string {
  const seguro = process.env.NODE_ENV === 'production';
  return `${NOMBRE_COOKIE_SESION}=${valor}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${seguro ? '; Secure' : ''}`;
}

@ApiTags('identidad')
@Controller('identidad')
export class IdentidadController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión con correo y contraseña' })
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const datos = validar(loginSchema, body);
    const resultado = await this.identidad.iniciarSesion(datos.correo, datos.contrasena);
    if (!resultado) throw new UnauthorizedException('El correo o la contraseña no son correctos');

    if ('requiere2fa' in resultado) {
      response.status(HttpStatus.ACCEPTED);
      return resultado;
    }

    response.setHeader('Set-Cookie', cookieSesion(resultado.token, 604800));
    return { usuario: resultado.usuario };
  }

  @Post('login/2fa')
  @ApiOperation({ summary: 'Completar el login con el código de Google Authenticator' })
  async completarLogin2fa(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const datos = validar(desafio2faSchema, body);
    const resultado = await this.identidad.completarLogin2fa(datos.desafio, datos.codigo);
    response.setHeader('Set-Cookie', cookieSesion(resultado.token, 604800));
    return { usuario: resultado.usuario };
  }

  @Get('2fa')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Consultar el estado de la verificación en dos pasos' })
  estado2fa(@Req() request: RequestAutenticada) {
    return this.identidad.estado2fa(request.usuario.id);
  }

  @Post('2fa/activar')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Generar un secreto para Google Authenticator' })
  iniciarActivacion2fa(@Req() request: RequestAutenticada) {
    return this.identidad.iniciarActivacion2fa(request.usuario.id);
  }

  @Post('2fa/activar/confirmar')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Confirmar la activación con un código de Google Authenticator' })
  confirmarActivacion2fa(@Req() request: RequestAutenticada, @Body() body: unknown) {
    const datos = validar(codigo2faSchema, body);
    return this.identidad.confirmarActivacion2fa(request.usuario.id, datos.codigo);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Obtener el perfil del usuario autenticado (HU-006)' })
  async me(@Req() request: RequestAutenticada) {
    return { usuario: await this.identidad.obtenerPerfil(request.usuario.id) };
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Editar nombre, celular o correo del perfil (HU-006)' })
  async actualizar(@Req() request: RequestAutenticada, @Body() body: unknown) {
    const datos = validar(actualizarPerfilSchema, body);
    return { usuario: await this.identidad.actualizarPerfil(request.usuario.id, datos) };
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar la cuenta (HU-006)',
    description:
      'Requiere { contrasena, confirmacion: "ELIMINAR" }. Anonimiza los datos personales, cierra ' +
      'todas las sesiones y cancela las citas futuras; se conservan mascotas e historial clínico.',
  })
  async eliminar(
    @Req() request: RequestAutenticada,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const datos = validar(eliminarCuentaSchema, body);
    await this.identidad.eliminarCuenta(request.usuario.id, datos);
    response.setHeader('Set-Cookie', cookieSesion('', 0));
    return { mensaje: 'Tu cuenta fue eliminada. Ya no podrás iniciar sesión con ella.' };
  }
}

@ApiTags('identidad')
@Controller('usuarios')
export class RegistroUsuariosController {
  constructor(private readonly identidad: IdentidadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar tutor (HU-001)',
    description: 'Body { nombre, celular, correo, contrasena }. Correo repetido → 409.',
  })
  @ApiCreatedResponse({
    description: 'Cuenta creada: { usuario }. La contraseña nunca se devuelve.',
  })
  async register(@Body() body: unknown) {
    return { usuario: await this.identidad.createTutor(validar(registroUsuarioSchema, body)) };
  }
}
