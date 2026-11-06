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
      'Body { nombre, celular, correo, contrasena, tipo (CLINICA | VET_INDEPENDIENTE | TIENDA), ' +
      'nombreAliado?, descripcion?, contacto? }. El aliado queda PENDIENTE hasta que el Equipo ' +
      'Veto lo active. Correo repetido → 409.',
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
