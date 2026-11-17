import { z } from 'zod';

export const BUSQUEDA_MAX_RESULTADOS_POR_CATEGORIA = 10;

export const buscarPorNombreGeneralSchema = z.object({
  nombre: z
    .string({ error: 'La búsqueda es obligatoria' })
    .trim()
    .min(1, 'La búsqueda no puede estar vacía'),
});
export type BuscarPorNombreGeneral = z.infer<typeof buscarPorNombreGeneralSchema>;

export const CATEGORIAS_BUSQUEDA = [
  'CLINICA',
  'VET_INDEPENDIENTE',
  'TIENDA',
  'VETERINARIO',
  'PRODUCTO',
  'SERVICIO',
] as const;
export type CategoriaBusqueda = (typeof CATEGORIAS_BUSQUEDA)[number];

export type ResultadoBusqueda = { id: string; nombre: string };
export type ResultadosPorCategoria = {
  categoria: CategoriaBusqueda;
  resultados: ResultadoBusqueda[];
};
export type RespuestaBusquedaGeneral = {
  resultadosPorCategoria: ResultadosPorCategoria[];
};
