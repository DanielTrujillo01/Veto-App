import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ordenProductosSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { ProductosGestionService } from './productos-gestion.service';
import { ProductosService } from './productos.service';

@ApiTags('productos')
@Controller('productos')
export class ProductosController {
  constructor(
    private readonly productos: ProductosService,
    private readonly gestion: ProductosGestionService,
  ) {}

  @Get('categorias')
  @ApiOperation({ summary: 'Categorías de producto del sistema (público, HU-044)' })
  categorias() {
    return this.gestion.listarCategorias();
  }

  @Get()
  @ApiOperation({
    summary: 'Todos los productos disponibles (público)',
    description: '?orden=nombre | precio_asc | precio_desc. El orden se aplica a todo el catálogo.',
  })
  todos(@Query() query: unknown) {
    const { orden } = validar(ordenProductosSchema, query);
    return this.productos.listarDisponibles(orden);
  }

  @Get(':productoId')
  @ApiOperation({
    summary: 'Detalle de un producto visible (público, HU-046)',
    description:
      'Solo productos activos, no ocultos por moderación y de una tienda activa; si no, 404 ' +
      '"Este producto ya no está disponible". Las fotos van en orden (la primera es la portada).',
  })
  detalle(@Param('productoId', new ParseUUIDPipe()) productoId: string) {
    return this.productos.obtenerVisible(productoId);
  }
}
