import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type {
  CategoriaProducto,
  FiltrosCatalogoProductos,
  OrdenProductos,
  ProductoCatalogo,
} from '@veto/shared';
import type { Consultor } from '../../database/database.service';
import { textoBusquedaNormalizadoSql } from '../../common/texto-busqueda';

interface ProductoRow extends QueryResultRow {
  id: string;
  aliado_id: string;
  aliado: string;
  categoria_id: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio: number | string;
  stock: number;
  creado_en: Date | string;
}

// Lista blanca: el valor de ?orden= nunca se concatena al SQL, solo se usa como llave.
const ORDENES: Record<OrdenProductos, string> = {
  nombre: 'p.nombre, p.id',
  precio_asc: 'p.precio ASC, p.nombre, p.id',
  precio_desc: 'p.precio DESC, p.nombre, p.id',
};

/**
 * Producto visible (acuerdo A-16): activo, no ocultado por moderación y de una tienda activa.
 * Es lo único que ve el tutor; el listado y el detalle usan esta misma condición.
 */
const SELECT_VISIBLE = `
  SELECT p.id, p.aliado_id, a.nombre AS aliado, p.categoria_id, c.nombre AS categoria,
         p.nombre, p.descripcion, p.precio::float8 AS precio, p.stock, p.creado_en
    FROM producto p
    JOIN aliado a             ON a.id = p.aliado_id
    JOIN categoria_producto c ON c.id = p.categoria_id
   WHERE p.activo AND p.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO'`;

@Injectable()
export class ProductosRepository {
  /** Lista el catálogo persistido, incluido vacío, en orden estable por ID. */
  async listarCategorias(client: Consultor): Promise<CategoriaProducto[]> {
    const resultado = await client.query<CategoriaProducto>(
      'SELECT id, nombre FROM categoria_producto ORDER BY id',
    );
    return resultado.rows;
  }

  /** Productos disponibles de tiendas activas, ordenados sobre todo el catálogo. */
  async listarDisponibles(
    client: Consultor,
    filtros: FiltrosCatalogoProductos,
  ): Promise<ProductoCatalogo[]> {
    const { categoriaId, nombre, orden } = filtros;
    const r = await client.query<ProductoRow>(
      `SELECT p.id, p.aliado_id, a.nombre AS aliado, p.categoria_id, c.nombre AS categoria,
              p.nombre, p.descripcion, p.precio::float8 AS precio, p.stock, p.creado_en
         FROM producto p
         JOIN aliado a             ON a.id = p.aliado_id
         JOIN categoria_producto c ON c.id = p.categoria_id
        WHERE p.activo AND p.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO'
          AND ($1::smallint IS NULL OR p.categoria_id = $1)
          AND (NULLIF(${textoBusquedaNormalizadoSql('$2::text')}, '') IS NULL OR
               strpos(${textoBusquedaNormalizadoSql('p.nombre')}, ${textoBusquedaNormalizadoSql('$2::text')}) > 0)
        ORDER BY ${ORDENES[orden]}`,
      [categoriaId ?? null, nombre ?? null],
    );
  /** HU-046: un producto visible, o null si no existe o ya no está visible. */
  async buscarVisible(client: Consultor, id: string): Promise<ProductoCatalogo | null> {
    const r = await client.query<ProductoRow>(`${SELECT_VISIBLE} AND p.id = $1`, [id]);
    const fila = r.rows[0];
    if (!fila) return null;
    const fotos = await this.fotos(client, [fila.id]);
    return aProducto(fila, fotos.get(fila.id) ?? []);
  }

  /** Productos disponibles de tiendas activas, ordenados sobre todo el catálogo. */
  async listarDisponibles(client: Consultor, orden: OrdenProductos): Promise<ProductoCatalogo[]> {
    const r = await client.query<ProductoRow>(`${SELECT_VISIBLE} ORDER BY ${ORDENES[orden]}`);
    if (r.rows.length === 0) return [];
    const porProducto = await this.fotos(
      client,
      r.rows.map((fila) => fila.id),
    );
    return r.rows.map((fila) => aProducto(fila, porProducto.get(fila.id) ?? []));
  }

  /** Fotos publicadas de cada producto, en su orden: la primera es la portada (HU-044). */
  private async fotos(client: Consultor, ids: string[]): Promise<Map<string, string[]>> {
    const fotos = await client.query<{ producto_id: string; url: string }>(
      `SELECT producto_id, url
         FROM producto_foto
        WHERE producto_id = ANY($1::uuid[]) AND moderacion = 'PUBLICADO'
        ORDER BY posicion`,
      [ids],
    );
    const porProducto = new Map<string, string[]>();
    for (const fila of fotos.rows) {
      const lista = porProducto.get(fila.producto_id) ?? [];
      lista.push(fila.url);
      porProducto.set(fila.producto_id, lista);
    }
    return porProducto;
  }
}

function aProducto(row: ProductoRow, fotos: string[]): ProductoCatalogo {
  return {
    id: row.id,
    aliadoId: row.aliado_id,
    aliado: row.aliado,
    categoriaId: row.categoria_id,
    categoria: row.categoria,
    nombre: row.nombre,
    descripcion: row.descripcion,
    precio: Number(row.precio),
    stock: row.stock,
    fotos,
    creadoEn: new Date(row.creado_en).toISOString(),
  };
}
