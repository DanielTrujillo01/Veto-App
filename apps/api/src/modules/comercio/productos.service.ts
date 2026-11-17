import { Injectable, NotFoundException } from '@nestjs/common';
import type { CategoriaProducto, FiltrosCatalogoProductos, ProductoCatalogo } from '@veto/shared';
import { DatabaseService } from '../../database/database.service';
import { ProductosRepository } from './productos.repository';

@Injectable()
export class ProductosService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: ProductosRepository,
  ) {}

  /** Público: todos los productos disponibles de tiendas activas. */
  async listarDisponibles(filtros: FiltrosCatalogoProductos): Promise<ProductoCatalogo[]> {
    return this.repo.listarDisponibles(this.db, filtros);
  }

  listarCategorias(): Promise<CategoriaProducto[]> {
    return this.repo.listarCategorias(this.db);
  }

  /**
   * HU-046, público: detalle de un producto visible (acuerdo A-16). La web lo vuelve a consultar
   * al pulsar "Agregar al carrito" para comprobar que sigue disponible y cuánto stock queda.
   */
  async obtenerVisible(id: string): Promise<ProductoCatalogo> {
    const producto = await this.repo.buscarVisible(this.db, id);
    if (!producto) throw new NotFoundException('Este producto ya no está disponible');
    return producto;
  }
}
