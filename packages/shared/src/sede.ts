import { z } from 'zod';

export const guardarSedeSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  direccion: z.string().trim().min(1, 'La dirección es obligatoria').max(250),
  ciudad: z.string().trim().min(1, 'La ciudad es obligatoria').max(120),
});

export type GuardarSede = z.infer<typeof guardarSedeSchema>;

export type Sede = {
  id: string;
  aliadoId: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  activa: boolean;
};
