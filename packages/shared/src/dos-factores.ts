import { z } from 'zod';

export const codigo2faSchema = z.object({
  codigo: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});
export type Codigo2fa = z.infer<typeof codigo2faSchema>;

export const desafio2faSchema = z.object({
  desafio: z.string().min(1, 'El desafío es obligatorio'),
  codigo: z.string().regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
});
export type Desafio2fa = z.infer<typeof desafio2faSchema>;
