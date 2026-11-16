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

export const ordenProductosSchema = z.object({
  orden: z.enum(['nombre', 'precio_asc', 'precio_desc']).default('nombre'),
});
export type OrdenProductos = z.infer<typeof ordenProductosSchema>['orden'];
