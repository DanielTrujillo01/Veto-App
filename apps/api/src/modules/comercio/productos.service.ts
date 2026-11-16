import { Injectable } from '@nestjs/common';
import type { OrdenProductos, ProductoCatalogo } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { ProductosRepository } from './productos.repository';

@Injectable()
export class ProductosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: ProductosRepository,
  ) {}

  /** Público: todos los productos disponibles de tiendas activas. */
  async listarDisponibles(orden: OrdenProductos): Promise<ProductoCatalogo[]> {
    return this.repo.listarDisponibles(this.db, orden);
  }
}
