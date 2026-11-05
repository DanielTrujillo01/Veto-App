import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type GuardarHorarios } from '@veto/shared';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { HorariosService } from './horarios.service';

@ApiTags('servicios')
@Controller('aliados/:clinicaId/veterinarios/:veterinarioId/horarios')
@UseGuards(AuthGuard)
export class HorariosController {
  constructor(private readonly horarios: HorariosService) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guarda el horario diario, semanal o mensual de un veterinario' })
  guardar(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Req() request: RequestAutenticada,
    @Body() entrada: GuardarHorarios,
  ) {
    return this.horarios.guardar(request.usuario.id, clinicaId, veterinarioId, entrada);
  }

  @Get()
  @ApiOperation({ summary: 'Consulta el horario configurado de un veterinario' })
  listar(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Req() request: RequestAutenticada,
  ) {
    return this.horarios.listar(request.usuario.id, clinicaId, veterinarioId);
  }
}
