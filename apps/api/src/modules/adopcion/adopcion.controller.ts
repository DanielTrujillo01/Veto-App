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
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  cambiarEstadoMascotaAdopcionSchema,
  editarMascotaAdopcionSchema,
  filtrarCatalogoAdopcionSchema,
  listarMascotasAdopcionSchema,
  publicarMascotaAdopcionSchema,
  TAMANOS_MASCOTA,
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
  @ApiOperation({
    summary: 'Consultar el catálogo público de mascotas en adopción (HU-080, HU-088)',
    description:
      'Filtros opcionales por especie, rango inclusivo de edad en meses, tamaño y ubicación exacta. ' +
      'Se admite cualquiera de los límites de edad o ambos; las publicaciones siguen siendo anónimas.',
  })
  @ApiQuery({
    name: 'especieId',
    required: false,
    type: Number,
    description: 'ID positivo del catálogo de especies.',
  })
  @ApiQuery({
    name: 'edadMinMeses',
    required: false,
    type: Number,
    description: 'Límite inferior inclusivo (0–32767). Puede enviarse solo.',
  })
  @ApiQuery({
    name: 'edadMaxMeses',
    required: false,
    type: Number,
    description: 'Límite superior inclusivo (0–32767). Puede enviarse solo.',
  })
  @ApiQuery({ name: 'tamano', required: false, enum: TAMANOS_MASCOTA })
  @ApiQuery({
    name: 'ubicacion',
    required: false,
    type: String,
    description: 'Coincidencia textual exacta, sin normalización.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista anónima de publicaciones disponibles; puede estar vacía.',
  })
  @ApiResponse({ status: 400, description: 'Uno o más filtros no son válidos.' })
  @ApiResponse({ status: 500, description: 'Error interno al consultar el catálogo.' })
  catalogo(@Query() query: unknown) {
    return this.adopcion.listarCatalogo(validar(filtrarCatalogoAdopcionSchema, query));
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
