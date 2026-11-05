import { notFound } from 'next/navigation';
import { VeterinarioCard } from '@/components/VeterinarioCard';
import { api, ApiError } from '@/lib/api';

type FichaClinica = {
  id: string;
  nombre: string;
  descripcion: string | null;
  veterinarios: {
    id: string;
    nombre: string;
    fotoUrl: string | null;
    descripcion: string | null;
  }[];
};

export default async function FichaClinica({ params }: { params: Promise<{ clinicaId: string }> }) {
  const { clinicaId } = await params;
  let ficha: FichaClinica;
  try {
    ficha = await api<FichaClinica>(`/aliados/${clinicaId}/veterinarios`, { cache: 'no-store' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{ficha.nombre}</h1>
        {ficha.descripcion && <p className="max-w-3xl text-suave">{ficha.descripcion}</p>}
      </header>
      <section aria-labelledby="equipo-title" className="space-y-4">
        <h2 id="equipo-title" className="text-xl font-semibold">
          Equipo veterinario
        </h2>
        {ficha.veterinarios.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {ficha.veterinarios.map((veterinario) => (
              <VeterinarioCard key={veterinario.id} {...veterinario} />
            ))}
          </div>
        ) : (
          <p className="text-suave">Esta clínica aún no ha registrado veterinarios.</p>
        )}
      </section>
    </main>
  );
}
