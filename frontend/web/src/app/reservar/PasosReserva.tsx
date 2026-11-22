import Link from 'next/link';
import { HuellaPaso } from '@/components/ui/iconos';

const PASOS = [
  { ruta: '', titulo: 'Fecha y hora' },
  { ruta: '/mascota', titulo: 'Mascota y motivo' },
  { ruta: '/confirmar', titulo: 'Confirmar' },
] as const;

/**
 * Pasos de la reserva (HU-029 → HU-030 → HU-031) con las mismas huellas de "Restablece tu
 * contraseña". Cada paso es una página propia; los pasos ya hechos son enlaces para corregirlos.
 */
export function PasosReserva({ servicioId, actual }: { servicioId: string; actual: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Pasos de la reserva">
      <ol className="recovery-steps paw-steps">
        {PASOS.map((paso, indice) => {
          const numero = indice + 1;
          const hecho = numero < actual;
          const contenido = (
            <>
              <HuellaPaso hecho={hecho} numero={numero} />
              <small>{paso.titulo}</small>
            </>
          );
          return (
            <li
              className={numero === actual ? 'is-active' : hecho ? 'is-complete' : ''}
              key={paso.titulo}
            >
              {hecho ? (
                <Link href={`/reservar/${servicioId}${paso.ruta}`}>{contenido}</Link>
              ) : (
                <span aria-current={numero === actual ? 'step' : undefined}>{contenido}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
