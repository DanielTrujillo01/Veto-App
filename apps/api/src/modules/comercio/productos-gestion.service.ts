import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CategoriaProducto,
  FiltrarProductosGestion,
  GuardarProducto,
  ProductoGestion,
  TipoAliado,
} from '@veto/shared';
import { esErrorPg, PG } from '../../common/validacion';
import { DatabaseService } from '../../database/database.service';
import { AliadosService } from '../aliados/aliados.service';
import { ProductosGestionRepository } from './productos-gestion.repository';

/** Solo las tiendas venden productos (la base también lo exige con trg_producto_tipo). */
const TIPOS_CON_PRODUCTOS: TipoAliado[] = ['TIENDA'];
/** Un producto de otra tienda responde igual que uno inexistente (§2.1). */
const NO_ENCONTRADO = 'El producto no existe o no pertenece a esta tienda';

function errorDeCampo(campo: string, mensaje: string) {
  return new BadRequestException({
    message: 'Revisa los datos ingresados',
    errores: { [campo]: mensaje },
  });
}

/**
 * HU-044: la tienda crea, edita, desactiva y reactiva sus productos. Nunca se borran: los
 * pedidos anteriores conservan el producto y el precio al que se compró.
 */
@Injectable()
export class ProductosGestionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly repo: ProductosGestionRepository,
    private readonly aliados: AliadosService,
  ) {}

  /** Público: categorías del sistema para el formulario y la tienda. */
  async listarCategorias(): Promise<CategoriaProducto[]> {
    return this.repo.listarCategorias(this.db);
  }

  async listar(
    usuarioId: string,
    aliadoId: string,
    filtro: FiltrarProductosGestion,
  ): Promise<ProductoGestion[]> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_PRODUCTOS);
      return this.repo.listar(client, aliadoId, filtro);
    });
  }

  async obtener(usuarioId: string, aliadoId: string, productoId: string): Promise<ProductoGestion> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_PRODUCTOS);
      const producto = await this.repo.buscar(client, productoId, aliadoId);
      if (!producto) throw new NotFoundException(NO_ENCONTRADO);
      return producto;
    });
  }

  /** Un producto nuevo queda activo y aparece de inmediato en la tienda. */
  async crear(
    usuarioId: string,
    aliadoId: string,
    datos: GuardarProducto,
  ): Promise<ProductoGestion> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_PRODUCTOS);
      const id = await this.traducirErrores(() => this.repo.insertar(client, aliadoId, datos));
      return (await this.repo.buscar(client, id, aliadoId)) as ProductoGestion;
    });
  }

  /** Un producto inactivo también se puede editar. */
  async actualizar(
    usuarioId: string,
    aliadoId: string,
    productoId: string,
    datos: GuardarProducto,
  ): Promise<ProductoGestion> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_PRODUCTOS);
      if (!(await this.repo.buscar(client, productoId, aliadoId, true))) {
        throw new NotFoundException(NO_ENCONTRADO);
      }
      await this.traducirErrores(() => this.repo.actualizar(client, productoId, aliadoId, datos));
      return (await this.repo.buscar(client, productoId, aliadoId)) as ProductoGestion;
    });
  }

  /** Desactivar lo saca de la tienda de inmediato (y la base rechaza pedirlo); activar lo vuelve. */
  async cambiarActivo(
    usuarioId: string,
    aliadoId: string,
    productoId: string,
    activo: boolean,
  ): Promise<ProductoGestion> {
    return this.db.withUser(usuarioId, async (client) => {
      await this.aliados.verificarAdministrador(client, usuarioId, aliadoId, TIPOS_CON_PRODUCTOS);
      if (!(await this.repo.buscar(client, productoId, aliadoId, true))) {
        throw new NotFoundException(NO_ENCONTRADO);
      }
      await this.repo.cambiarActivo(client, productoId, aliadoId, activo);
      return (await this.repo.buscar(client, productoId, aliadoId)) as ProductoGestion;
    });
  }

  private async traducirErrores<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (esErrorPg(error, PG.LLAVE_FORANEA)) {
        throw errorDeCampo('categoriaId', 'La categoría no existe');
      }
      throw error;
    }
  }
}
