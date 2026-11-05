import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { registroAliadoSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AliadosService } from './aliados.service';

@ApiTags('aliados')
@Controller('aliados')
export class AliadosController {
  constructor(private readonly aliados: AliadosService) {}

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
}
