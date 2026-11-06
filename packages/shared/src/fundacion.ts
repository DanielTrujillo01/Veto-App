import { z } from 'zod';
import type { EstadoAliado } from './enums';
import { urlImagenSchema } from './imagen';
import { celularSchema, contrasenaSchema, correoSchema } from './usuario';

/** Primer año que acepta la base de datos para fundar una organización. */
export const ANIO_FUNDACION_MINIMO = 1900;

/** Texto obligatorio: sin espacios sobrantes, no vacío y con un máximo. */
function textoObligatorio(obligatorio: string, maximo: number, largo: string) {
  return z.string({ error: obligatorio }).trim().min(1, obligatorio).max(maximo, largo);
}

/** Los formularios mandan '' o null cuando un campo opcional queda vacío: se toma como ausente. */
function vacioComoAusente(valor: unknown): unknown {
  if (valor === null) return undefined;
  if (typeof valor === 'string' && valor.trim() === '') return undefined;
  return valor;
}

/** Acepta 2015 o '2015' (un campo de formulario llega como texto) y rechaza todo lo demás. */
const anioFundacionSchema = z.preprocess(
  (valor) => (typeof valor === 'string' && /^\s*\d+\s*$/.test(valor) ? Number(valor) : valor),
  z
    .number({
      error: (issue) =>
        issue.input === undefined || issue.input === null || issue.input === ''
          ? 'El año de fundación es obligatorio'
          : 'El año de fundación debe ser un número',
    })
    .int('El año de fundación debe ser un número entero')
    .min(
      ANIO_FUNDACION_MINIMO,
      `El año de fundación no puede ser anterior a ${ANIO_FUNDACION_MINIMO}`,
    )
    // El año actual se calcula al validar, no al cargar el módulo.
    .refine((anio) => anio <= new Date().getFullYear(), {
      message: 'El año de fundación no puede ser posterior al año actual',
    }),
);

/**
 * HU-078: una fundación se registra como un nuevo tipo de aliado. Junto con los datos de la
 * fundación se crea la cuenta que la administra (correo, celular y contraseña).
 * El tipo y el estado no se envían: siempre queda FUNDACION y PENDIENTE hasta que el
 * Equipo Veto la apruebe (HU-079).
 */
export const registroFundacionSchema = z.object({
  nombre: textoObligatorio(
    'El nombre de la fundación es obligatorio',
    160,
    'El nombre admite máximo 160 caracteres',
  ),
  ciudad: textoObligatorio(
    'La ciudad es obligatoria',
    120,
    'La ciudad admite máximo 120 caracteres',
  ),
  contacto: textoObligatorio(
    'El contacto es obligatorio',
    160,
    'El contacto admite máximo 160 caracteres',
  ),
  descripcion: textoObligatorio(
    'La descripción es obligatoria',
    2000,
    'La descripción admite máximo 2000 caracteres',
  ),
  ubicacion: textoObligatorio(
    'La ubicación es obligatoria',
    250,
    'La ubicación admite máximo 250 caracteres',
  ),
  anioFundacion: anioFundacionSchema,
  logoUrl: z.preprocess(vacioComoAusente, urlImagenSchema.optional()),
  /** Persona que administra la cuenta; si no se indica, se usa el nombre de la fundación. */
  representante: z.preprocess(
    vacioComoAusente,
    z
      .string()
      .trim()
      .max(120, 'El nombre del representante admite máximo 120 caracteres')
      .optional(),
  ),
  celular: celularSchema,
  correo: correoSchema,
  contrasena: contrasenaSchema,
});
export type RegistroFundacion = z.infer<typeof registroFundacionSchema>;

/** Datos de la fundación tal como los devuelve la API. */
export type Fundacion = {
  id: string;
  tipo: 'FUNDACION';
  nombre: string;
  ciudad: string;
  contacto: string;
  descripcion: string;
  ubicacion: string;
  anioFundacion: number;
  logoUrl: string | null;
  estado: EstadoAliado;
  creadoEn: string;
};

/** Lo que ve la propia fundación: sus datos más los de la cuenta que la administra. */
export type FundacionPropia = Fundacion & {
  representante: string;
  correo: string;
  celular: string;
};
