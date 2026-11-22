/**
 * Portada de tarjeta (clínicas y servicios): una franja crema, sin color, del fondo de la
 * ficha de marca. El burgundy (principal) resalta en el monograma, el nombre y la flecha.
 * Estilos en `.clinic-tile__cover`.
 */
export function PortadaCapas({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`clinic-tile__cover ${className}`} />;
}

const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'y', 'los', 'las']);

/** Monograma del aliado: "Clínica de David" → "CD". */
export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra.toLowerCase()))
    .slice(0, 2)
    .map((palabra) => palabra[0])
    .join('')
    .toUpperCase();
}
