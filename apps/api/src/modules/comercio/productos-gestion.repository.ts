import { Injectable } from '@nestjs/common';
import type { PoolClient, QueryResultRow } from 'pg';
import type {
  CategoriaProducto,
  FiltrarProductosGestion,
  GuardarProducto,
  ProductoGestion,
} from '@veto/shared';
import type { Consultor } from '../../database/database.service';

interface ProductoGestionRow extends QueryResultRow {
  id: string;
  aliado_id: string;
  categoria_id: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  stock: number;
  fotos: string[] | null;
  activo: boolean;
  moderacion: string;
  creado_en: Date | string;
}

const SELECT_PRODUCTO = `
  SELECT p.id, p.aliado_id, p.categoria_id, c.nombre AS categoria, p.nombre, p.descripcion,
         p.precio::float8 AS precio, p.stock, p.activo, p.moderacion, p.creado_en,
         (SELECT array_agg(f.url ORDER BY f.posicion) FROM producto_foto f
           WHERE f.producto_id = p.id) AS fotos
    FROM producto p
    JOIN categoria_producto c ON c.id = p.categoria_id`;

/** Texto sin mayúsculas ni tildes, para buscar "peluqueria" y encontrar "Peluquería" (§2.3). */
const SIN_TILDES = (expr: string) => `translate(lower(${expr}), 'áéíóúü', 'aeiouu')`;

/** Escapa los comodines de LIKE para que `%` y `_` se busquen tal cual (§2.3, regla 5). */
function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * HU-044: productos que administra una tienda. Todas las consultas filtran por `aliado_id`, así
 * una tienda nunca lee ni cambia productos de otra.
 */
@Injectable()
export class ProductosGestionRepository {
  async listarCategorias(client: Consultor): Promise<CategoriaProducto[]> {
    const r = await client.query<{ id: number; nombre: string }>(
      'SELECT id, nombre FROM categoria_producto ORDER BY nombre',
    );
    return r.rows;
  }

  /** Lista del panel: más recientes primero, con búsqueda por nombre y filtro por estado. */
  async listar(
    client: Consultor,
    aliadoId: string,
    filtro: FiltrarProductosGestion,
  ): Promise<ProductoGestion[]> {
    const condiciones = ['p.aliado_id = $1'];
    const valores: unknown[] = [aliadoId];
    if (filtro.estado === 'activos') condiciones.push('p.activo');
    if (filtro.estado === 'inactivos') condiciones.push('NOT p.activo');
    for (const palabra of filtro.q?.split(/\s+/) ?? []) {
      valores.push(`%${escaparLike(palabra)}%`);
      condiciones.push(`${SIN_TILDES('p.nombre')} LIKE ${SIN_TILDES(`$${valores.length}`)}`);
    }
    const r = await client.query<ProductoGestionRow>(
      `${SELECT_PRODUCTO} WHERE ${condiciones.join(' AND ')} ORDER BY p.creado_en DESC, p.id`,
      valores,
    );
    return r.rows.map(aProductoGestion);
  }

  /** Producto de la tienda (bloqueado para la transacción si `bloquear`). */
  async buscar(
    client: Consultor,
    id: string,
    aliadoId: string,
    bloquear = false,
  ): Promise<ProductoGestion | null> {
    if (bloquear) {
      const r = await client.query(
        'SELECT id FROM producto WHERE id = $1 AND aliado_id = $2 FOR UPDATE',
        [id, aliadoId],
      );
      if (r.rows.length === 0) return null;
    }
    const r = await client.query<ProductoGestionRow>(
      `${SELECT_PRODUCTO} WHERE p.id = $1 AND p.aliado_id = $2`,
      [id, aliadoId],
    );
    return r.rows[0] ? aProductoGestion(r.rows[0]) : null;
  }

  /** Crea el producto (queda activo) y devuelve su id. */
  async insertar(client: PoolClient, aliadoId: string, datos: GuardarProducto): Promise<string> {
    const r = await client.query<{ id: string }>(
      `INSERT INTO producto (aliado_id, categoria_id, nombre, descripcion, precio, stock)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [
        aliadoId,
        datos.categoriaId,
        datos.nombre,
        datos.descripcion ?? null,
        datos.precio,
        datos.stock,
      ],
    );
    const id = r.rows[0].id;
    await this.reemplazarFotos(client, id, datos.fotos);
    return id;
  }

  /** Edita los datos y las fotos. Los pedidos guardan su propio precio: no cambian. */
  async actualizar(client: PoolClient, id: string, aliadoId: string, datos: GuardarProducto) {
    await client.query(
      `UPDATE producto
          SET categoria_id = $3, nombre = $4, descripcion = $5, precio = $6, stock = $7
        WHERE id = $1 AND aliado_id = $2`,
      [
        id,
        aliadoId,
        datos.categoriaId,
        datos.nombre,
        datos.descripcion ?? null,
        datos.precio,
        datos.stock,
      ],
    );
    await this.reemplazarFotos(client, id, datos.fotos);
  }

  async cambiarActivo(client: PoolClient, id: string, aliadoId: string, activo: boolean) {
    await client.query('UPDATE producto SET activo = $3 WHERE id = $1 AND aliado_id = $2', [
      id,
      aliadoId,
      activo,
    ]);
  }

  /** Guarda las fotos en el orden recibido: la primera (posición 1) es la portada. */
  private async reemplazarFotos(client: PoolClient, productoId: string, urls: string[]) {
    await client.query('DELETE FROM producto_foto WHERE producto_id = $1', [productoId]);
    for (const [i, url] of urls.entries()) {
      await client.query(
        'INSERT INTO producto_foto (producto_id, url, posicion) VALUES ($1, $2, $3)',
        [productoId, url, i + 1],
      );
    }
  }
}

function aProductoGestion(row: ProductoGestionRow): ProductoGestion {
  return {
    id: row.id,
    aliadoId: row.aliado_id,
    categoriaId: row.categoria_id,
    categoria: row.categoria,
    nombre: row.nombre,
    descripcion: row.descripcion,
    precio: Number(row.precio),
    stock: row.stock,
    fotos: row.fotos ?? [],
    activo: row.activo,
    ocultoPorVeto: row.moderacion !== 'PUBLICADO',
    creadoEn: new Date(row.creado_en).toISOString(),
  };
}
