import { z } from 'zod';
import { urlImagenSchema } from './imagen';

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

export const ordenProductosSchema = z.object({
  orden: z.enum(['nombre', 'precio_asc', 'precio_desc']).default('nombre'),
});
export type OrdenProductos = z.infer<typeof ordenProductosSchema>['orden'];

// ---------------------------------------------------------------------------------------------
// HU-044 · Gestión de productos de la tienda
// ---------------------------------------------------------------------------------------------

/** Fotos por producto (decisión D-12, el mismo límite que las mascotas del tutor). */
export const MAX_FOTOS_PRODUCTO = 5;
export const MAX_NOMBRE_PRODUCTO = 120;
export const MAX_DESCRIPCION_PRODUCTO = 2_000;
/** Precio máximo que admite la base (numeric(12,2)), en pesos sin decimales. */
export const MAX_PRECIO_PRODUCTO = 9_999_999_999;

/**
 * HU-044: datos de un producto. Crear y editar usan el mismo esquema, en la pantalla y en el
 * servidor. Las fotos son enlaces (§2.7); la primera de la lista es la portada.
 */
export const guardarProductoSchema = z.object({
  nombre: z
    .string({ error: 'El nombre es obligatorio' })
    .trim()
    .min(1, 'El nombre es obligatorio')
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(MAX_NOMBRE_PRODUCTO, `El nombre admite máximo ${MAX_NOMBRE_PRODUCTO} caracteres`),
  categoriaId: z
    .number({ error: 'La categoría es obligatoria' })
    .int('La categoría no es válida')
    .positive('La categoría no es válida')
    .max(32_767, 'La categoría no existe'),
  precio: z
    .number({ error: 'El precio es obligatorio' })
    .int('El precio va en pesos, sin decimales')
    .positive('El precio debe ser mayor que 0')
    .max(MAX_PRECIO_PRODUCTO, 'El precio es demasiado alto'),
  stock: z
    .number({ error: 'El stock es obligatorio' })
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo')
    .max(2_147_483_647, 'El stock es demasiado alto'),
  descripcion: z
    .string()
    .trim()
    .max(
      MAX_DESCRIPCION_PRODUCTO,
      `La descripción admite máximo ${MAX_DESCRIPCION_PRODUCTO} caracteres`,
    )
    .optional()
    .transform((texto) => (texto ? texto : undefined)),
  fotos: z
    .array(urlImagenSchema)
    .max(MAX_FOTOS_PRODUCTO, `Máximo ${MAX_FOTOS_PRODUCTO} fotos`)
    .refine((fotos) => new Set(fotos).size === fotos.length, 'Hay fotos repetidas')
    .default([]),
});
export type GuardarProducto = z.infer<typeof guardarProductoSchema>;

/** Estados para filtrar la lista del panel. */
export const ESTADOS_FILTRO_PRODUCTO = ['todos', 'activos', 'inactivos'] as const;
export type EstadoFiltroProducto = (typeof ESTADOS_FILTRO_PRODUCTO)[number];

/** HU-044: búsqueda por nombre y filtro por estado en la lista del panel de la tienda. */
export const filtrarProductosGestionSchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, 'La búsqueda admite máximo 100 caracteres')
    .optional()
    .transform((texto) => (texto ? texto : undefined)),
  estado: z.enum(ESTADOS_FILTRO_PRODUCTO).catch('todos').default('todos'),
});
export type FiltrarProductosGestion = z.infer<typeof filtrarProductosGestionSchema>;

/** Categoría de producto (catálogo del sistema: Alimentos, Accesorios, Higiene...). */
export type CategoriaProducto = { id: number; nombre: string };

/** Producto tal como lo ve la tienda que lo administra (HU-044). */
export type ProductoGestion = {
  id: string;
  aliadoId: string;
  categoriaId: number;
  categoria: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock: number;
  /** Ordenadas: la primera es la portada. */
  fotos: string[];
  activo: boolean;
  /** true si el Equipo Veto lo ocultó por moderación (HU-066): no se ve en la tienda. */
  ocultoPorVeto: boolean;
  creadoEn: string;
};
