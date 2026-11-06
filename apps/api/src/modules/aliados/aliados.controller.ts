import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { registroAliadoSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { AliadosService } from './aliados.service';

@ApiTags('aliados')
@Controller('aliados')
export class AliadosController {
  constructor(private readonly aliados: AliadosService) {}

  @Get('me')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Obtener el aliado asociado a la cuenta autenticada' })
  async obtenerDeUsuario(@Req() request: RequestAutenticada) {
    return { aliado: await this.aliados.obtenerDeUsuario(request.usuario.id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar aliado (HU-007)',
    description:
      'CLINICA / TIENDA: nombre de administrador, nombreAliado, ciudad y ubicacion; ' +
      'VET_INDEPENDIENTE: nombre profesional y nombreAliado, ciudad y ubicacion opcionales. ' +
      'Todos requieren celular, correo y contrasena. Los aliados quedan ACTIVOS al registrarse. ' +
      'Las fundaciones usan POST /aliados/fundaciones y quedan PENDIENTE de revisión (HU-078/079). ' +
      'Correo repetido → 409.',
  })
  @ApiCreatedResponse({ description: 'Cuenta y aliado creados: { usuario, aliado }.' })
  register(@Body() body: unknown) {
    return this.aliados.register(validar(registroAliadoSchema, body));
  }

  @Get('me/fundacion')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Consultar el estado de la solicitud de fundación (HU-079)' })
  async estadoFundacion(@Req() request: RequestAutenticada) {
    return {
      fundacion: await this.aliados.estadoFundacionPropia(request.usuario.id),
    };
  }
}
