import { Injectable } from '@nestjs/common';
import type { QueryResultRow } from 'pg';
import type { OrdenProductos, ProductoCatalogo } from '@veto/shared';
import type { Consultor } from '../../database/database.service';

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

@Injectable()
export class ProductosRepository {
  /** Productos disponibles de tiendas activas, ordenados sobre todo el catálogo. */
  async listarDisponibles(client: Consultor, orden: OrdenProductos): Promise<ProductoCatalogo[]> {
    const r = await client.query<ProductoRow>(
      `SELECT p.id, p.aliado_id, a.nombre AS aliado, p.categoria_id, c.nombre AS categoria,
              p.nombre, p.descripcion, p.precio::float8 AS precio, p.stock, p.creado_en
         FROM producto p
         JOIN aliado a             ON a.id = p.aliado_id
         JOIN categoria_producto c ON c.id = p.categoria_id
        WHERE p.activo AND p.moderacion = 'PUBLICADO' AND a.estado = 'ACTIVO'
        ORDER BY ${ORDENES[orden]}`,
    );
    if (r.rows.length === 0) return [];

    const fotos = await client.query<{ producto_id: string; url: string }>(
      `SELECT producto_id, url
         FROM producto_foto
        WHERE producto_id = ANY($1::uuid[]) AND moderacion = 'PUBLICADO'
        ORDER BY id`,
      [r.rows.map((fila) => fila.id)],
    );

    const porProducto = new Map<string, string[]>();
    for (const fila of fotos.rows) {
      const lista = porProducto.get(fila.producto_id) ?? [];
      lista.push(fila.url);
      porProducto.set(fila.producto_id, lista);
    }

    return r.rows.map((fila) => aProducto(fila, porProducto.get(fila.id) ?? []));
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