import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { publicarMascotaAdopcionSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { AdopcionService } from './adopcion.service';

@ApiTags('adopcion')
@Controller('adopciones')
export class AdopcionController {
  constructor(private readonly adopcion: AdopcionService) {}

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Publicar una mascota en adopción (HU-080)',
    description:
      'Solo una fundación autorizada. Obligatorios: nombre, especieId, edadMeses, sexo, tamano y ubicacion. ' +
      'descripcion es opcional; la publicación inicia como DISPONIBLE.',
  })
  publicar(@Req() request: RequestAutenticada, @Body() body: unknown) {
    return this.adopcion.publicar(request.usuario.id, validar(publicarMascotaAdopcionSchema, body));
  }

  @Get('catalogo')
  @ApiOperation({ summary: 'Consultar el catálogo público de mascotas en adopción (HU-080)' })
  catalogo() {
    return this.adopcion.listarCatalogo();
  }
}
