import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ordenProductosSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { ProductosService } from './productos.service';

@ApiTags('productos')
@Controller('productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Get()
  @ApiOperation({
    summary: 'Todos los productos disponibles (público)',
    description: '?orden=nombre | precio_asc | precio_desc. El orden se aplica a todo el catálogo.',
  })
  todos(@Query() query: unknown) {
    const { orden } = validar(ordenProductosSchema, query);
    return this.productos.listarDisponibles(orden);
  }
}
