import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ordenProductosSchema, catalogoProductosSchema } from '@veto/shared';
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

  @Get('categorias')
  @ApiOperation({
    summary: 'Listar categorías persistidas de productos (público)',
    description: 'Devuelve los identificadores y nombres de categoria_producto ordenados por id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Categorías de producto.',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, nombre: { type: 'string' } },
      },
    },
  })
  categorias() {
    return this.productos.listarCategorias();
  }

  @Get()
  @ApiOperation({
    summary: 'Productos disponibles con filtros opcionales (público)',
    description:
      'Filtros combinables categoriaId y nombre (coincidencia parcial sin distinguir mayúsculas ' +
      'ni acentos). El orden se aplica al catálogo completo y conserva las opciones existentes.',
  })
  @ApiQuery({
    name: 'categoriaId',
    required: false,
    type: Number,
    description: 'ID positivo de categoria_producto (1–32767).',
  })
  @ApiQuery({
    name: 'nombre',
    required: false,
    type: String,
    description: 'Texto opcional buscado parcialmente solo en el nombre del producto.',
  })
  @ApiQuery({
    name: 'orden',
    required: false,
    enum: ['nombre', 'precio_asc', 'precio_desc'],
  })
  @ApiResponse({
    status: 200,
    description: 'Productos disponibles; lista vacía si no hay coincidencias.',
  })
  @ApiResponse({ status: 400, description: 'categoriaId u orden no válidos.' })
  @ApiResponse({ status: 500, description: 'Error interno al consultar el catálogo.' })
  todos(@Query() query: unknown) {
    return this.productos.listarDisponibles(validar(catalogoProductosSchema, query));
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
