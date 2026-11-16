import { z } from 'zod';

export type ProductoCatalogo = {
  id: string;
  aliadoId: string;
  aliado: string;
  categoriaId: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  fotos: string[];
  creadoEn: string;
};

export type CategoriaProducto = {
  id: number;
  nombre: string;
};

export const ordenProductosSchema = z.object({
  orden: z.enum(['nombre', 'precio_asc', 'precio_desc']).default('nombre'),
});
export type OrdenProductos = z.infer<typeof ordenProductosSchema>['orden'];

/** HU-045: filtros opcionales del catálogo público de productos. */
export const catalogoProductosSchema = ordenProductosSchema.extend({
  categoriaId: z.coerce
    .number({ error: 'La categoría debe ser un número' })
    .int('La categoría debe ser un número entero')
    .positive('La categoría debe ser un número positivo')
    .max(32_767, 'La categoría no existe')
    .optional(),
  nombre: z
    .string()
    .trim()
    .transform((nombre) => nombre || undefined)
    .optional(),
});
export type FiltrosCatalogoProductos = z.infer<typeof catalogoProductosSchema>;
