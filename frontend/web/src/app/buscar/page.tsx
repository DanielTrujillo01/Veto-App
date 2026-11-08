import Link from 'next/link';

export default async function Buscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ubicacion?: string }>;
}) {
  const { q = '', ubicacion = 'Bogotá, Colombia' } = await searchParams;

  return (
    <div className="search-page">
      <header className="search-page__heading">
        <span className="eyebrow eyebrow--dark">ENCUENTRA EL CUIDADO IDEAL</span>
        <h1>Tu próxima búsqueda empieza aquí.</h1>
        <p>Conecta con servicios y aliados que cuidan de tu mascota.</p>
        <form action="/buscar" className="catalog-search search-page__form">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Servicio, veterinario o clínica"
            defaultValue={q}
            name="q"
            placeholder="Servicio, veterinario o clínica"
          />
          <input aria-label="Ubicación" defaultValue={ubicacion} name="ubicacion" />
          <button className="veto-button veto-button--primary" type="submit">
            Buscar
          </button>
        </form>
      </header>
      <section className="search-result-panel">
        <span aria-hidden="true" className="search-result-panel__icon">
          ⌕
        </span>
        <div>
          <span className="eyebrow eyebrow--dark">CERCA DE TI</span>
          <h2>{q ? `Resultados para “${q}”` : '¿Qué necesita tu mascota?'}</h2>
          <p>
            Explora clínicas veterinarias y conoce a sus equipos. Estamos trabajando para sumar más
            servicios y profesionales a Veto.
          </p>
        </div>
        <Link className="veto-button veto-button--primary" href="/clinicas">
          Ver clínicas
        </Link>
      </section>
      <section className="search-suggestions">
        <span>También puedes explorar</span>
        <div>
          <Link href="/clinicas">Clínicas veterinarias</Link>
          <Link href="/veterinarios">Veterinarios independientes</Link>
          <Link href="/tienda">Tienda para mascotas</Link>
          <Link href="/adopcion">Adopción responsable</Link>
        </div>
      </section>
    </div>
  );
}
