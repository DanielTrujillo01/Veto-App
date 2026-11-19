import { DetalleServicio } from './DetalleServicio';

/** HU-028 · Detalle de un servicio (público). */
export default async function PaginaServicio({
  params,
}: {
  params: Promise<{ servicioId: string }>;
}) {
  const { servicioId } = await params;
  return <DetalleServicio id={servicioId} />;
}
