import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { buscarPorNombreGeneralSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { BusquedaService } from './busqueda.service';

@ApiTags('busqueda')
@Controller('busqueda')
@UseGuards(AuthGuard, RolesGuard)
@Roles('TUTOR')
export class BusquedaController {
  constructor(private readonly busqueda: BusquedaService) {}

  @Get()
  @ApiOperation({
    summary: 'Buscar por nombre en aliados, veterinarios, productos y servicios (HU-025)',
    description:
      'Coincidencia parcial que ignora mayúsculas, acentos y espacios redundantes. ' +
      'Devuelve hasta 10 resultados por categoría. Adopción está excluida.',
  })
  @ApiQuery({ name: 'nombre', required: true, type: String })
  buscar(@Query() query: unknown) {
    const { nombre } = validar(buscarPorNombreGeneralSchema, query);
    return this.busqueda.buscar(nombre);
  }
}
