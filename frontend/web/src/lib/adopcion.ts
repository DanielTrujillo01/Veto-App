import type { EstadoMascotaAdopcion, SexoAnimal, TamanoMascota } from '@veto/shared';

export const NOMBRE_TAMANO: Record<TamanoMascota, string> = {
  PEQUENO: 'Pequeño',
  MEDIANO: 'Mediano',
  GRANDE: 'Grande',
};

export const NOMBRE_SEXO: Record<SexoAnimal, string> = {
  MACHO: 'Macho',
  HEMBRA: 'Hembra',
};

export const ESTADO_ADOPCION: Record<
  EstadoMascotaAdopcion,
  { texto: string; tono: 'success' | 'warning' | 'error' | 'info' | 'neutral'; ayuda: string }
> = {
  DISPONIBLE: { texto: 'Disponible', tono: 'success', ayuda: 'Visible en el catálogo.' },
  PAUSADA: { texto: 'Pausada', tono: 'warning', ayuda: 'Oculta del catálogo por ahora.' },
  EN_PROCESO: {
    texto: 'En proceso',
    tono: 'info',
    ayuda: 'Hay una adopción en curso; no recibe nuevas solicitudes.',
  },
  ADOPTADA: { texto: 'Adoptada', tono: 'success', ayuda: '¡Encontró un hogar!' },
  RETIRADA: { texto: 'Retirada', tono: 'neutral', ayuda: 'Ya no se publica.' },
};

/**
 * Cambios de estado permitidos (los mismos que valida la API) con el texto de cada botón.
 * ADOPTADA y RETIRADA son finales: se piden confirmar.
 */
export const ACCIONES_ADOPCION: Record<
  EstadoMascotaAdopcion,
  { a: EstadoMascotaAdopcion; texto: string; final?: boolean }[]
> = {
  DISPONIBLE: [
    { a: 'PAUSADA', texto: 'Pausar' },
    { a: 'EN_PROCESO', texto: 'Marcar en proceso' },
    { a: 'RETIRADA', texto: 'Retirar', final: true },
  ],
  PAUSADA: [
    { a: 'DISPONIBLE', texto: 'Volver a publicar' },
    { a: 'RETIRADA', texto: 'Retirar', final: true },
  ],
  EN_PROCESO: [
    { a: 'ADOPTADA', texto: 'Marcar adoptada', final: true },
    { a: 'DISPONIBLE', texto: 'Volver a disponible' },
    { a: 'RETIRADA', texto: 'Retirar', final: true },
  ],
  ADOPTADA: [],
  RETIRADA: [],
};

/** "8 meses", "1 año", "2 años y 3 meses". */
export function textoEdad(meses: number): string {
  if (meses < 12) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const textoAnos = `${anos} ${anos === 1 ? 'año' : 'años'}`;
  return resto ? `${textoAnos} y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : textoAnos;
}

/** Rangos de edad del filtro del catálogo (HU-088), en meses e inclusivos. */
export const RANGOS_EDAD = [
  { id: 'cachorro', texto: 'Cachorro (hasta 1 año)', min: 0, max: 12 },
  { id: 'joven', texto: 'Joven (1 a 3 años)', min: 13, max: 36 },
  { id: 'adulto', texto: 'Adulto (3 a 7 años)', min: 37, max: 84 },
  { id: 'senior', texto: 'Mayor (más de 7 años)', min: 85, max: undefined },
] as const;
