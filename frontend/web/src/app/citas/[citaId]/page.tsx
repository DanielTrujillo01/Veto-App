import { Suspense } from 'react';
import { DetalleCita } from './DetalleCita';

/** Detalle de una cita (HU-030, HU-031) y su cierre por el aliado (HU-032, HU-033). */
export default async function PaginaCita({ params }: { params: Promise<{ citaId: string }> }) {
  const { citaId } = await params;
  return (
    <Suspense>
      <DetalleCita citaId={citaId} />
    </Suspense>
  );
}
