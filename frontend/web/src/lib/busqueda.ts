/**
 * HU-025 · Búsqueda por palabra clave en los catálogos que se cargan completos (clínicas y
 * servicios). Por defecto busca en el nombre. Tolera mayúsculas/minúsculas, tildes y espacios
 * de más: "  clinica   DAVID " encuentra "Clínica de David".
 */
export function normalizarTexto(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Todas las palabras de la consulta aparecen en alguno de los campos (en cualquier orden). */
export function coincideBusqueda(consulta: string, ...campos: (string | null | undefined)[]) {
  const palabras = normalizarTexto(consulta).split(' ').filter(Boolean);
  if (palabras.length === 0) return true;
  const texto = normalizarTexto(campos.filter(Boolean).join(' '));
  return palabras.every((palabra) => texto.includes(palabra));
}
