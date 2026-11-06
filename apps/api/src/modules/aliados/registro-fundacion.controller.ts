import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { registroFundacionSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { RegistroFundacionService } from './registro-fundacion.service';

@ApiTags('aliados')
@Controller('aliados')
export class RegistroFundacionController {
  constructor(private readonly fundaciones: RegistroFundacionService) {}

  @Post('fundaciones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar una fundación como aliado (HU-078)',
    description:
      'Body { nombre, ciudad, contacto, descripcion, ubicacion, anioFundacion, logoUrl?, ' +
      'representante?, celular, correo, contrasena }. Crea la cuenta y la fundación; queda ' +
      'PENDIENTE hasta que el Equipo Veto la apruebe (HU-079). Campos faltantes o inválidos → ' +
      '400 con { errores: { campo: mensaje } } para todos los campos a la vez. Correo repetido → 409.',
  })
  @ApiCreatedResponse({ description: 'Cuenta y fundación creadas: { usuario, fundacion }.' })
  registrar(@Body() body: unknown) {
    return this.fundaciones.registrar(validar(registroFundacionSchema, body));
  }

  @Get('me/fundacion/datos')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'La fundación consulta los datos que registró (HU-078)' })
  async consultarPropia(@Req() request: RequestAutenticada) {
    return { fundacion: await this.fundaciones.consultarPropia(request.usuario.id) };
  }
}
