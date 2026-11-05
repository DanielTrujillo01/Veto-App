import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { guardarEspeciesSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { AliadoEspeciesService } from './aliado-especies.service';

@ApiTags('aliados')
@Controller('aliados/:aliadoId/especies')
export class AliadoEspeciesController {
  constructor(private readonly especies: AliadoEspeciesService) {}

  @Get()
  @ApiOperation({
    summary: 'Especies que atiende un aliado (público, HU-021)',
    description:
      'Para la ficha del aliado y los filtros. 404 si el aliado no existe o no está activo.',
  })
  listar(@Param('aliadoId', new ParseUUIDPipe()) aliadoId: string) {
    return this.especies.listarPublicas(aliadoId);
  }

  @Put()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('ALIADO')
  @ApiOperation({
    summary: 'Indicar qué especies atiende el aliado (HU-021)',
    description:
      'Guarda y actualiza con la misma operación: envía { especieIds: [...] } con la selección ' +
      'completa (al menos una); reemplaza a la anterior. Solo el administrador de una clínica o ' +
      'de un veterinario independiente activo. Devuelve las especies guardadas.',
  })
  guardar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Body() body: unknown,
  ) {
    return this.especies.guardar(
      request.usuario.id,
      aliadoId,
      validar(guardarEspeciesSchema, body),
    );
  }
}
