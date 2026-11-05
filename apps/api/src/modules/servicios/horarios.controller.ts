import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { type GuardarHorarios } from '@veto/shared';
import { HorariosService } from './horarios.service';

@ApiTags('servicios')
@Controller('aliados/:clinicaId/veterinarios/:veterinarioId/horarios')
export class HorariosController {
  constructor(private readonly horarios: HorariosService) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Guarda el horario diario, semanal o mensual de un veterinario' })
  guardar(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Headers('x-user-id') administradorId: string | undefined,
    @Body() entrada: GuardarHorarios,
  ) {
    if (!administradorId) {
      throw new UnauthorizedException('Se requiere el administrador autenticado');
    }
    return this.horarios.guardar(administradorId, clinicaId, veterinarioId, entrada);
  }

  @Get()
  @ApiOperation({ summary: 'Consulta el horario configurado de un veterinario' })
  listar(
    @Param('clinicaId', new ParseUUIDPipe()) clinicaId: string,
    @Param('veterinarioId', new ParseUUIDPipe()) veterinarioId: string,
    @Headers('x-user-id') administradorId: string | undefined,
  ) {
    if (!administradorId) {
      throw new UnauthorizedException('Se requiere el administrador autenticado');
    }
    return this.horarios.listar(administradorId, clinicaId, veterinarioId);
  }
}
