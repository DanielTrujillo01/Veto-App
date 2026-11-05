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
import { filtrarServiciosSchema, guardarServicioSchema } from '@veto/shared';
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
