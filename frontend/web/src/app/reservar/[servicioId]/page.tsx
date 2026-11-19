import { Suspense } from 'react';
import { ElegirHorario } from './ElegirHorario';

/** HU-029 · Reserva, paso 1: fecha y hora. */
export default async function PasoHorario({ params }: { params: Promise<{ servicioId: string }> }) {
  const { servicioId } = await params;
  return (
    <Suspense>
      <ElegirHorario servicioId={servicioId} />
    </Suspense>
  );
}
