import { z } from 'zod';
import { ESTADOS_MASCOTA_ADOPCION, SEXOS_ANIMAL, TAMANOS_MASCOTA } from './enums';

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
});
export type PublicarMascotaAdopcion = z.infer<typeof publicarMascotaAdopcionSchema>;

export type MascotaAdopcion = Omit<PublicarMascotaAdopcion, 'descripcion'> & {
  id: string;
  descripcion: string | null;
  estado: (typeof ESTADOS_MASCOTA_ADOPCION)[number];
  creadoEn: string;
};

export type MascotaAdopcionPublica = Omit<MascotaAdopcion, 'estado' | 'creadoEn'> & {
  especie: string;
};
