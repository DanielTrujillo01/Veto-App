import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { buscarAliadosSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { AliadosService } from './aliados.service';

@ApiTags('aliados')
@Controller('aliados/busqueda')
@UseGuards(AuthGuard, RolesGuard)
@Roles('TUTOR')
export class BusquedaAliadosController {
  constructor(private readonly aliados: AliadosService) {}

  @Get('nombre')
  @ApiOperation({
    summary: 'Buscar aliados activos por coincidencia exacta del nombre (HU-024)',
    description:
      'Busca clínicas, veterinarios independientes y tiendas. La coincidencia distingue mayúsculas y acentos. Devuelve hasta 10 resultados.',
  })
  @ApiQuery({ name: 'nombre', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Lista de aliados coincidentes; puede estar vacía.' })
  buscar(@Query() query: unknown) {
    const { nombre } = validar(buscarAliadosSchema, query);
    return this.aliados.buscarPorNombre(nombre);
  }
}
