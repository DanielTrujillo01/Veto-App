import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { filtrarProductosGestionSchema, guardarProductoSchema } from '@veto/shared';
import { validar } from '../../common/validacion';
import { AuthGuard, type RequestAutenticada } from '../identidad/auth.guard';
import { Roles, RolesGuard } from '../identidad/roles.guard';
import { ProductosGestionService } from './productos-gestion.service';

const DESCRIPCION_CAMPOS =
  'Obligatorios: nombre (2 a 120), categoriaId, precio (pesos sin decimales, > 0), stock ' +
  '(entero >= 0). Opcionales: descripcion (hasta 2000), fotos (hasta 5 enlaces http/https; la ' +
  'primera es la portada). Errores de validación: 400 { message, errores: { campo: mensaje } }.';

/** HU-044: gestión de productos desde el panel de la tienda. */
@ApiTags('productos')
@Controller('aliados/:aliadoId/productos')
@UseGuards(AuthGuard, RolesGuard)
@Roles('ALIADO')
export class ProductosGestionController {
  constructor(private readonly productos: ProductosGestionService) {}

  @Get()
  @ApiOperation({
    summary: 'Productos de la tienda, activos e inactivos (HU-044)',
    description:
      'Más recientes primero. ?q= busca por nombre (sin distinguir mayúsculas ni tildes); ' +
      '?estado=todos | activos | inactivos.',
  })
  listar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Query() query: unknown,
  ) {
    return this.productos.listar(
      request.usuario.id,
      aliadoId,
      validar(filtrarProductosGestionSchema, query),
    );
  }

  @Get(':productoId')
  @ApiOperation({ summary: 'Consultar un producto de la tienda para editarlo (HU-044)' })
  obtener(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('productoId', new ParseUUIDPipe()) productoId: string,
  ) {
    return this.productos.obtener(request.usuario.id, aliadoId, productoId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear un producto (HU-044)', description: DESCRIPCION_CAMPOS })
  crear(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Body() body: unknown,
  ) {
    return this.productos.crear(request.usuario.id, aliadoId, validar(guardarProductoSchema, body));
  }

  @Put(':productoId')
  @ApiOperation({
    summary: 'Editar un producto (HU-044)',
    description: `${DESCRIPCION_CAMPOS} Las fotos enviadas reemplazan a las anteriores.`,
  })
  actualizar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('productoId', new ParseUUIDPipe()) productoId: string,
    @Body() body: unknown,
  ) {
    return this.productos.actualizar(
      request.usuario.id,
      aliadoId,
      productoId,
      validar(guardarProductoSchema, body),
    );
  }

  @Patch(':productoId/desactivar')
  @ApiOperation({
    summary: 'Desactivar un producto (HU-044)',
    description:
      'Sale de la tienda de inmediato y no se puede pedir. Los pedidos anteriores no cambian.',
  })
  desactivar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('productoId', new ParseUUIDPipe()) productoId: string,
  ) {
    return this.productos.cambiarActivo(request.usuario.id, aliadoId, productoId, false);
  }

  @Patch(':productoId/activar')
  @ApiOperation({ summary: 'Volver a activar un producto desactivado (HU-044)' })
  activar(
    @Req() request: RequestAutenticada,
    @Param('aliadoId', new ParseUUIDPipe()) aliadoId: string,
    @Param('productoId', new ParseUUIDPipe()) productoId: string,
  ) {
    return this.productos.cambiarActivo(request.usuario.id, aliadoId, productoId, true);
  }
}
