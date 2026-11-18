import { z } from 'zod';
import { ESTADOS_MASCOTA_ADOPCION, SEXOS_ANIMAL, TAMANOS_MASCOTA } from './enums';
import { urlImagenSchema } from './imagen';

export const MAX_FOTOS_ADOPCION = 10;
export const MAX_VIDEO_ADOPCION = 1;

const urlVideoSchema = z
  .url({ protocol: /^https?$/, error: 'El video debe ser una URL http o https válida' })
  .max(2_048, 'La URL del video es demasiado larga');

const mediosAdopcionSchema = {
  fotos: z
    .array(urlImagenSchema)
    .max(MAX_FOTOS_ADOPCION, `Máximo ${MAX_FOTOS_ADOPCION} fotos`)
    .default([]),
  videoUrl: urlVideoSchema.optional(),
};

export const publicarMascotaAdopcionSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  especieId: z.number({ error: 'La especie es obligatoria' }).int().positive(),
  edadMeses: z.number().int().min(0, 'La edad no puede ser negativa'),
  sexo: z.enum(SEXOS_ANIMAL, { error: 'El sexo debe ser MACHO o HEMBRA' }),
  tamano: z.enum(TAMANOS_MASCOTA, {
    error: 'El tamaño debe ser PEQUENO, MEDIANO o GRANDE',
  }),
  ubicacion: z.string().trim().min(1, 'La ubicación es obligatoria').max(160),
  descripcion: z.string().trim().min(1).max(500).optional(),
  ...mediosAdopcionSchema,
});
export type PublicarMascotaAdopcion = z.infer<typeof publicarMascotaAdopcionSchema>;

export const editarMascotaAdopcionSchema = publicarMascotaAdopcionSchema;
export type EditarMascotaAdopcion = PublicarMascotaAdopcion;

export const cambiarEstadoMascotaAdopcionSchema = z.object({
  estado: z.enum(ESTADOS_MASCOTA_ADOPCION, { error: 'El estado no es válido' }),
});
export type CambiarEstadoMascotaAdopcion = z.infer<typeof cambiarEstadoMascotaAdopcionSchema>;

export const listarMascotasAdopcionSchema = z.object({
  estado: z.enum(ESTADOS_MASCOTA_ADOPCION, { error: 'El estado no es válido' }).optional(),
});
export type ListarMascotasAdopcion = z.infer<typeof listarMascotasAdopcionSchema>;

const enteroQueryAdopcionSchema = z
  .string()
  .regex(/^\d+$/, 'Debe ser un entero no negativo')
  .transform(Number)
  .pipe(z.number().int().min(0).max(32_767));

export const filtrarCatalogoAdopcionSchema = z
  .object({
    especieId: enteroQueryAdopcionSchema.pipe(z.number().min(1)).optional(),
    edadMinMeses: enteroQueryAdopcionSchema.optional(),
    edadMaxMeses: enteroQueryAdopcionSchema.optional(),
    tamano: z.enum(TAMANOS_MASCOTA, { error: 'El tamaño no es válido' }).optional(),
    ubicacion: z
      .string()
      .min(1, 'La ubicación no puede estar vacía')
      .max(160, 'La ubicación no puede superar 160 caracteres')
      .refine((valor) => valor.trim().length > 0, 'La ubicación no puede estar vacía')
      .optional(),
  })
  .refine(
    ({ edadMinMeses, edadMaxMeses }) =>
      edadMinMeses === undefined || edadMaxMeses === undefined || edadMinMeses <= edadMaxMeses,
    {
      message: 'La edad mínima no puede superar la edad máxima',
      path: ['edadMaxMeses'],
    },
  );
export type FiltrosCatalogoAdopcion = z.infer<typeof filtrarCatalogoAdopcionSchema>;

export type MascotaAdopcion = Omit<
  PublicarMascotaAdopcion,
  'descripcion' | 'fotos' | 'videoUrl'
> & {
  id: string;
  descripcion: string | null;
  fotos: string[];
  videoUrl: string | null;
  estado: (typeof ESTADOS_MASCOTA_ADOPCION)[number];
  creadoEn: string;
};

export type MascotaAdopcionPublica = Omit<MascotaAdopcion, 'estado' | 'creadoEn'> & {
  especie: string;
};
