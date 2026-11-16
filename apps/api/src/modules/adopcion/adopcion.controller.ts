import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cambiarEstadoMascotaAdopcionSchema,
  editarMascotaAdopcionSchema,
  listarMascotasAdopcionSchema,
  publicarMascotaAdopcionSchema,
} from '@veto/shared';
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

  @Get('mis-publicaciones')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Listar las publicaciones de la fundación autenticada (HU-085)' })
  propias(@Req() request: RequestAutenticada, @Query() query: unknown) {
    return this.adopcion.listarPropias(
      request.usuario.id,
      validar(listarMascotasAdopcionSchema, query),
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Editar una publicación propia de adopción (HU-082)' })
  editar(
    @Req() request: RequestAutenticada,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.adopcion.editar(request.usuario.id, id, validar(editarMascotaAdopcionSchema, body));
  }

  @Patch(':id/estado')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Cambiar el estado de una publicación propia (HU-082)' })
  cambiarEstado(
    @Req() request: RequestAutenticada,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.adopcion.cambiarEstado(
      request.usuario.id,
      id,
      validar(cambiarEstadoMascotaAdopcionSchema, body),
    );
  }

  @Get(':mascotaId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('TUTOR')
  @ApiOperation({ summary: 'Detalle de una mascota en adopción, sin datos de la fundación' })
  obtenerPublica(@Param('mascotaId', new ParseUUIDPipe()) mascotaId: string) {
    return this.adopcion.obtenerPublica(mascotaId);
  }
}
