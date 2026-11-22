import { ElegirMascota } from './ElegirMascota';

/** HU-030 · Reserva, paso 2: mascota y motivo. */
export default async function PasoMascota({ params }: { params: Promise<{ servicioId: string }> }) {
  const { servicioId } = await params;
  return <ElegirMascota servicioId={servicioId} />;
}
