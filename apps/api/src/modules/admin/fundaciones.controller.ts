import { Controller, Get, Param, ParseUUIDPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { AdminFundacionesService } from './fundaciones.service';

@ApiTags('administracion')
@Controller('admin/fundaciones')
@UseGuards(AuthGuard, RolesGuard)
@Roles('EQUIPO_VETO')
export class AdminFundacionesController {
  constructor(private readonly fundaciones: AdminFundacionesService) {}

  @Get('pendientes')
  @ApiOperation({ summary: 'Listar solicitudes de fundación pendientes (HU-079)' })
  pendientes(@Req() request: RequestAutenticada) {
    return this.fundaciones.listarPendientes(request.usuario.id);
  }

  @Get(':fundacionId')
  @ApiOperation({ summary: 'Consultar los datos enviados por una fundación (HU-079)' })
  obtener(
    @Req() request: RequestAutenticada,
    @Param('fundacionId', new ParseUUIDPipe()) fundacionId: string,
  ) {
    return this.fundaciones.obtener(request.usuario.id, fundacionId);
  }

  @Patch(':fundacionId/aprobar')
  @ApiOperation({ summary: 'Aprobar una solicitud de fundación (HU-079)' })
  aprobar(
    @Req() request: RequestAutenticada,
    @Param('fundacionId', new ParseUUIDPipe()) fundacionId: string,
  ) {
    return this.fundaciones.decidir(request.usuario.id, fundacionId, 'ACTIVO');
  }

  @Patch(':fundacionId/rechazar')
  @ApiOperation({ summary: 'Rechazar una solicitud de fundación (HU-079)' })
  rechazar(
    @Req() request: RequestAutenticada,
    @Param('fundacionId', new ParseUUIDPipe()) fundacionId: string,
  ) {
    return this.fundaciones.decidir(request.usuario.id, fundacionId, 'RECHAZADO');
  }
}
