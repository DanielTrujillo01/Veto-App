import type { ModalidadServicio, ReglaPrecio } from '@veto/shared';

export const NOMBRE_MODALIDAD: Record<ModalidadServicio, string> = {
  EN_SEDE: 'En sede',
  A_DOMICILIO: 'A domicilio',
};

function rango(min: number | null | undefined, max: number | null | undefined, unidad: string) {
  if (min != null && max != null) return `${min}–${max} ${unidad}`;
  if (min != null) return `desde ${min} ${unidad}`;
  if (max != null) return `hasta ${max} ${unidad}`;
  return '';
}

/** "Perro · 3–13 kg · 4–15 meses": a qué mascotas aplica una regla de precio (HU-020). */
export function describirRegla(regla: ReglaPrecio, especies: Map<number, string>) {
  const partes = [
    regla.especieId != null
      ? (especies.get(regla.especieId) ?? 'Una especie')
      : 'Todas las especies',
    rango(regla.pesoMinKg, regla.pesoMaxKg, 'kg'),
    rango(regla.edadMinMeses, regla.edadMaxMeses, 'meses'),
  ];
  return partes.filter(Boolean).join(' · ');
}
