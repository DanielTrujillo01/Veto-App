import { z } from 'zod';
import { ESTADOS_CONSULTA, type EstadoConsulta, type TipoAliado } from './enums';

export const CONSULTAS_POR_PAGINA = 20;
export const MAX_CONSULTAS_POR_PAGINA = 100;

/** HU-014: parámetros de la URL de la lista de consultas del veterinario. */
export const listarConsultasSchema = z.object({
  estado: z.enum(ESTADOS_CONSULTA, { error: 'El estado debe ser ABIERTA o CERRADA' }).optional(),
  pagina: z.coerce
    .number({ error: 'La página debe ser un número' })
    .int('La página debe ser un número entero')
    .min(1, 'La página empieza en 1')
    .default(1),
  limite: z.coerce
    .number({ error: 'El límite debe ser un número' })
    .int('El límite debe ser un número entero')
    .min(1, 'El límite mínimo es 1')
    .max(MAX_CONSULTAS_POR_PAGINA, `El límite máximo es ${MAX_CONSULTAS_POR_PAGINA}`)
    .default(CONSULTAS_POR_PAGINA),
});
export type ListarConsultas = z.infer<typeof listarConsultasSchema>;

/** Una consulta en la lista del veterinario. */
export type ConsultaResumen = {
  id: string;
  citaId: string;
  fecha: string;
  servicio: string;
  mascota: { id: string; nombre: string; especie: string };
  motivoConsulta: string;
  estado: EstadoConsulta;
  cerradaEn: string | null;
};

/** Detalle de una consulta propia: el resumen más la anamnesis. */
export type ConsultaDetalle = ConsultaResumen & {
  citaFin: string;
  descripcionPropietario: string | null;
  estadoMental: string | null;
  condicionCorporal: string | null;
  comportamiento: string | null;
  estadoGeneral: string | null;
  creadaEn: string;
};

export type PaginaConsultas = {
  items: ConsultaResumen[];
  total: number;
  pagina: number;
  limite: number;
};

/** HU-014: perfil del veterinario autenticado. */
export type PerfilVeterinario = {
  id: string;
  usuario: { id: string; nombre: string; correo: string; celular: string };
  aliado: { id: string; nombre: string; tipo: TipoAliado };
  fotoUrl: string | null;
  descripcion: string | null;
};
