import BuscarResultados from './BuscarResultados';

export default async function Buscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ubicacion?: string }>;
}) {
  const { q = '', ubicacion = 'Bogotá, Colombia' } = await searchParams;
  return <BuscarResultados q={q} ubicacion={ubicacion} />;
}
