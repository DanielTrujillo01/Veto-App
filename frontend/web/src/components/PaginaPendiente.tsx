/** Marcador de posición para pantallas que todavía no se implementan. Se reemplaza por la real. */
export function PaginaPendiente({ titulo, historias }: { titulo: string; historias: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">{titulo}</h1>
      <p className="text-suave">Pantalla pendiente de implementar ({historias}).</p>
    </div>
  );
}
