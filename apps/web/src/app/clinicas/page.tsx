import Link from 'next/link';
import { api } from '@/lib/api';

type Clinica = { id: string; nombre: string; descripcion: string | null };

export default async function Clinicas() {
  const clinicas = await api<Clinica[]>('/aliados/clinicas');
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">Clínicas veterinarias</h1>
      {clinicas.length === 0 ? (
        <p className="text-suave">No hay clínicas disponibles por el momento.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {clinicas.map((clinica) => (
            <li key={clinica.id}>
              <Link
                href={`/clinicas/${clinica.id}`}
                className="block h-full rounded-xl border border-borde bg-superficie p-5 hover:border-acento"
              >
                <h2 className="font-semibold">{clinica.nombre}</h2>
                {clinica.descripcion && (
                  <p className="mt-2 text-sm text-suave">{clinica.descripcion}</p>
                )}
                <span className="mt-4 inline-block text-sm font-medium text-acento">
                  Ver equipo veterinario
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
