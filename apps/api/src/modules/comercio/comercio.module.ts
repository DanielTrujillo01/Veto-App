import { Module } from '@nestjs/common';

/**
 * Módulo comercio: Productos y pedidos.
 *
 * Tablas propias: producto, producto_foto, pedido, pedido_item, categoria_producto
 * Historias:      HU-044–050
 *
 * Regla: solo este módulo escribe en sus tablas. Si otro módulo necesita un dato,
 * lo pide a través de un servicio exportado por este módulo, nunca con SQL directo.
 */
@Module({})
export class ComercioModule {}
