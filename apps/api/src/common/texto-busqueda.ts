/** Expresión PostgreSQL compartida para normalizar texto de búsqueda por nombre. */
export function textoBusquedaNormalizadoSql(columnaSql: string): string {
  return `lower(public.unaccent(regexp_replace(btrim(${columnaSql}), '[[:space:]]+', ' ', 'g'))) `;
}
