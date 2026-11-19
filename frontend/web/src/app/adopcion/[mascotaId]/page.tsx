import { DetalleAdopcion } from './DetalleAdopcion';

/** HU-089 · Detalle de una mascota en adopción. */
export default async function PaginaAdopcion({
  params,
}: {
  params: Promise<{ mascotaId: string }>;
}) {
  const { mascotaId } = await params;
  return <DetalleAdopcion id={mascotaId} />;
}
