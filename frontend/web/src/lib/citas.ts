import type { EstadoCita } from '@veto/shared';

export const ESTADO_CITA: Record<
  EstadoCita,
  { texto: string; tono: 'success' | 'warning' | 'error' | 'info' | 'neutral' }
> = {
  PENDIENTE: { texto: 'Pendiente de aprobación', tono: 'warning' },
  AGENDADA: { texto: 'Agendada', tono: 'info' },
  FINALIZADA: { texto: 'Finalizada', tono: 'success' },
  NO_ASISTIO: { texto: 'No asistió', tono: 'error' },
  CANCELADA: { texto: 'Cancelada', tono: 'neutral' },
};
