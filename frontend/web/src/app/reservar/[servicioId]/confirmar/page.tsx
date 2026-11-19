import { ConfirmarReserva } from './ConfirmarReserva';

/** HU-031 · Reserva, paso 3: revisar y confirmar. */
export default async function PasoConfirmar({
  params,
}: {
  params: Promise<{ servicioId: string }>;
}) {
  const { servicioId } = await params;
  return <ConfirmarReserva servicioId={servicioId} />;
}
