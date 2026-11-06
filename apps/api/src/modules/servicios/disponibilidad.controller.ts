import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { consultarDisponibilidadSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { DisponibilidadService } from './disponibilidad.service';

@ApiTags('servicios')
@Controller('aliados/:aliadoId/disponibilidad')
export class DisponibilidadController {
  constructor(private readonly disponibilidad: DisponibilidadService) {}

  @Get()
  @ApiOperation({
    summary: 'Espacios libres de un aliado para un servicio (público, HU-022)',
    description:
      '?servicioId=...&desde=AAAA-MM-DD&hasta=AAAA-MM-DD (máximo 31 días) y, opcional, ' +
      '?veterinarioId=... Cada espacio es una hora en que el servicio cabe completo: dentro ' +
      'del horario, fuera de los bloqueos y sin cruzarse con otra cita. Refleja de inmediato ' +
      'los cambios del aliado.',
  })
  consultar(@Param('aliadoId', new ParseUUIDPipe()) aliadoId: string, @Query() query: unknown) {
    return this.disponibilidad.consultar(aliadoId, validar(consultarDisponibilidadSchema, query));
  }
}
