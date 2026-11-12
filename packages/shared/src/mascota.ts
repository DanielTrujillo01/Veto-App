import { z } from 'zod';
import { SEXOS_ANIMAL } from './enums';
import { urlImagenSchema } from './imagen';

export const MAX_FOTOS_MASCOTA = 5;

const textoOpcional = (max: number) => z.string().trim().min(1).max(max).optional();

/**
 * HU-008 / HU-010: datos del perfil de la mascota. La creación y la edición usan este mismo
 * esquema, así las validaciones son idénticas. Nombre, especie y sexo son obligatorios.
 */
export const crearMascotaSchema = z
  .object({
    nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
    especieId: z.number({ error: 'La especie es obligatoria' }).int().positive(),
    sexo: z.enum(SEXOS_ANIMAL, { error: 'El sexo debe ser MACHO o HEMBRA' }),
    raza: textoOpcional(80),
    fechaNacimiento: z.iso.date('La fecha debe tener formato AAAA-MM-DD').optional(),
    edadMeses: z.number().int().min(0).max(600).optional(),
    color: textoOpcional(60),
    pesoKg: z.number().positive('El peso debe ser mayor que 0').max(500).optional(),
    chip: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{1,40}$/, 'El chip solo admite letras, números y guiones')
      .optional(),
    fotos: z
      .array(urlImagenSchema)
      .max(MAX_FOTOS_MASCOTA, `Máximo ${MAX_FOTOS_MASCOTA} fotos`)
      .optional(),
  })
  .refine(
    (m) =>
      m.fechaNacimiento === undefined || m.fechaNacimiento <= new Date().toISOString().slice(0, 10),
    { message: 'La fecha de nacimiento no puede estar en el futuro', path: ['fechaNacimiento'] },
  )
  .refine((m) => m.fechaNacimiento === undefined || m.edadMeses === undefined, {
    message: 'Indica la fecha de nacimiento o la edad, no ambas',
    path: ['edadMeses'],
  });
export type CrearMascota = z.infer<typeof crearMascotaSchema>;

/** HU-010: editar reemplaza todos los campos editables con las mismas reglas de la creación. */
export const actualizarMascotaSchema = crearMascotaSchema;
export type ActualizarMascota = CrearMascota;

/** Perfil de la mascota tal como lo devuelve la API. */
export type Mascota = {
  id: string;
  nombre: string;
  especieId: number;
  especie: string;
  sexo: (typeof SEXOS_ANIMAL)[number];
  raza: string | null;
  fechaNacimiento: string | null;
  edadMeses: number | null;
  color: string | null;
  pesoKg: number | null;
  chip: string | null;
  fotos: string[];
  creadoEn: string;
};
