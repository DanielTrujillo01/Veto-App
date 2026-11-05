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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { guardarSedeSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { SedesService } from './sedes.service';

@ApiTags('aliados')
@Controller('aliados/:aliadoId/sedes')
export class SedesController {
  constructor(private readonly sedes: SedesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista las sedes activas disponibles de una clínica' })
  disponibles(@Param('aliadoId', new ParseUUIDPipe()) aliadoId: string) {
    return this.sedes.listarDisponibles(aliadoId);
  }

  @Get('gestion')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Lista todas las sedes de una clínica para su administración (HU-015)' })
  gestion(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
  ) {
    return this.sedes.listarGestion(request.usuario.id, aliadoId);
  }

  @Get(':sedeId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Consulta una sede de la clínica administrada' })
  obtener(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('sedeId', new ParseUUIDPipe()) sedeId: string,
  ) {
    return this.sedes.obtener(request.usuario.id, aliadoId, sedeId);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crea una sede para la clínica (HU-015)' })
  crear(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Body() body: unknown,
  ) {
    return this.sedes.crear(request.usuario.id, aliadoId, validar(guardarSedeSchema, body));
  }

  @Put(':sedeId')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Edita una sede de la clínica (HU-015)' })
  actualizar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('sedeId', new ParseUUIDPipe()) sedeId: string,
    @Body() body: unknown,
  ) {
    return this.sedes.actualizar(
      request.usuario.id,
      aliadoId,
      sedeId,
      validar(guardarSedeSchema, body),
    );
  }

  @Patch(':sedeId/desactivar')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({ summary: 'Desactiva una sede y la retira de las opciones disponibles (HU-015)' })
  desactivar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('sedeId', new ParseUUIDPipe()) sedeId: string,
  ) {
    return this.sedes.desactivar(request.usuario.id, aliadoId, sedeId);
  }
}
