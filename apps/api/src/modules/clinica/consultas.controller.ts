import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { listarConsultasSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { VeterinarioGuard, type RequestVeterinario } from '../aliados/veterinario.guard';
import { AuthGuard } from '../identidad/auth.guard';
import { ConsultasService } from './consultas.service';

/**
 * Consultas del veterinario autenticado (HU-014). El veterinario sale siempre de la sesión
 * (`request.veterinario`), nunca de la URL ni del cuerpo: no hay forma de pedir las de otro.
 */
@ApiTags('clinica')
@Controller('veterinarios/me/consultas')
@UseGuards(AuthGuard, VeterinarioGuard)
export class ConsultasController {
  constructor(private readonly consultas: ConsultasService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar mis consultas (HU-014)',
    description:
      'Solo las consultas asignadas al veterinario autenticado, de la más reciente a la más ' +
      'antigua. Parámetros opcionales: estado (ABIERTA | CERRADA), pagina (desde 1) y limite ' +
      '(1 a 100, por defecto 20).',
  })
  listar(@Req() request: RequestVeterinario, @Query() query: unknown) {
    return this.consultas.listarDelVeterinario(
      request.veterinario.id,
      validar(listarConsultasSchema, query),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar el detalle de una consulta propia (HU-014)',
    description: 'Si la consulta no existe o es de otro veterinario responde 404.',
  })
  obtener(@Req() request: RequestVeterinario, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.consultas.obtenerDelVeterinario(request.veterinario.id, id);
  }
}
