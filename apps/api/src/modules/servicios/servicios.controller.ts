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
  cotizarServicioSchema,
  filtrarServiciosSchema,
  guardarReglasPrecioSchema,
  guardarServicioSchema,
} from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { ServiciosService } from './servicios.service';

const DESCRIPCION_CAMPOS =
  'Obligatorios: tipoServicioId, nombre, modalidad (EN_SEDE | A_DOMICILIO), duracionMin, ' +
  'precioBase; sedeId obligatorio si es EN_SEDE. Opcional: descripcion.';

@ApiTags('servicios')
@Controller('servicios')
export class TiposServicioController {
  constructor(private readonly servicios: ServiciosService) {}

  @Get('tipos')
  @ApiOperation({ summary: 'Catálogo de tipos de servicio (consulta general, baño, ...)' })
  tipos() {
    return this.servicios.listarTipos();
  }
}

@ApiTags('servicios')
@Controller('aliados/:aliadoId/servicios')
export class ServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  @Get()
  @ApiOperation({
    summary: 'Servicios disponibles para reservar de un aliado (público)',
    description:
      'Filtro opcional ?especieId=N (HU-021): si el aliado no atiende esa especie, la lista ' +
      'llega vacía.',
  })
  disponibles(@Param('aliadoId', new ParseUUIDPipe()) aliadoId: string, @Query() query: unknown) {
    return this.servicios.listarDisponibles(aliadoId, validar(filtrarServiciosSchema, query));
  }

  @Get('gestion')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Todos los servicios del aliado, activos e inactivos (HU-018)' })
  gestion(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
  ) {
    return this.servicios.listarGestion(request.usuario.id, aliadoId);
  }

  @Get(':servicioId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Consultar un servicio del aliado para gestión' })
  obtener(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
  ) {
    return this.servicios.obtenerGestion(request.usuario.id, aliadoId, servicioId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un servicio (HU-018)', description: DESCRIPCION_CAMPOS })
  crear(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Body() body: unknown,
  ) {
    return this.servicios.crear(request.usuario.id, aliadoId, validar(guardarServicioSchema, body));
  }

  @Put(':servicioId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Editar un servicio (HU-018)', description: DESCRIPCION_CAMPOS })
  actualizar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
    @Body() body: unknown,
  ) {
    return this.servicios.actualizar(
      request.usuario.id,
      aliadoId,
      servicioId,
      validar(guardarServicioSchema, body),
    );
  }

  @Get(':servicioId/reglas-precio')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Consultar las reglas de precio de un servicio (HU-020)' })
  reglasPrecio(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
  ) {
    return this.servicios.listarReglasPrecio(request.usuario.id, aliadoId, servicioId);
  }

  @Put(':servicioId/reglas-precio')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({
    summary: 'Reemplazar las reglas de precio de un servicio (HU-020)',
    description:
      'Envía { reglas: [...] }. Una lista vacía quita todas las reglas. Las dimensiones de rango ' +
      'se combinan y sus límites son inclusivos; valores nulos u omitidos significan cualquiera.',
  })
  guardarReglasPrecio(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
    @Body() body: unknown,
  ) {
    return this.servicios.guardarReglasPrecio(
      request.usuario.id,
      aliadoId,
      servicioId,
      validar(guardarReglasPrecioSchema, body),
    );
  }

  @Patch(':servicioId/desactivar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({
    summary: 'Desactivar un servicio (HU-018)',
    description:
      'Deja de aparecer como disponible para nuevas reservas; las citas existentes no cambian.',
  })
  desactivar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
  ) {
    return this.servicios.cambiarActivo(request.usuario.id, aliadoId, servicioId, false);
  }

  @Patch(':servicioId/activar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Volver a activar un servicio desactivado (HU-018)' })
  activar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
  ) {
    return this.servicios.cambiarActivo(request.usuario.id, aliadoId, servicioId, true);
  }
}

@ApiTags('servicios')
@Controller('servicios')
export class PublicServiciosController {
  constructor(private readonly servicios: ServiciosService) {}

  @Get(':servicioId')
  @ApiOperation({ summary: 'Consultar detalle público de un servicio disponible' })
  obtener(@Param('servicioId', new ParseUUIDPipe()) servicioId: string) {
    return this.servicios.obtenerDisponible(servicioId);
  }

  @Get(':servicioId/cotizacion')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('TUTOR')
  @ApiOperation({
    summary: 'Cotizar un servicio con los datos de una mascota propia (HU-020)',
  })
  cotizar(
    @Req() request: RequestAutenticada,
    @Param('servicioId', new ParseUUIDPipe()) servicioId: string,
    @Query() query: unknown,
  ) {
    const datos = validar(cotizarServicioSchema, query);
    return this.servicios.cotizarParaMascota(request.usuario.id, servicioId, datos.mascotaId);
  }
}
