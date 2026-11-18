import { Module } from '@nestjs/common';
import { AliadosModule } from '../aliados/aliados.module';
import { IdentidadModule } from '../identidad/identidad.module';
import { ProductosGestionController } from './productos-gestion.controller';
import { ProductosGestionRepository } from './productos-gestion.repository';
import { ProductosGestionService } from './productos-gestion.service';
import { ProductosController } from './productos.controller';
import { ProductosRepository } from './productos.repository';
import { ProductosService } from './productos.service';

/**
 * Módulo comercio: Productos y pedidos.
 *
 * Tablas propias: producto, producto_foto, pedido, pedido_item, categoria_producto
 * Historias:      HU-044–050
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({
  imports: [IdentidadModule, AliadosModule],
  controllers: [ProductosController, ProductosGestionController],
  providers: [
    ProductosService,
    ProductosRepository,
    ProductosGestionService,
    ProductosGestionRepository,
  ],
  exports: [ProductosService],
})
export class ComercioModule {}
