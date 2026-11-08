import Link from 'next/link';

export default function Veterinarios() {
  return (
    <div className="catalog-page vet-page">
      <section className="catalog-hero catalog-hero--vets">
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">CUIDADO CON EXPERIENCIA</span>
          <h1>
            Personas que entienden <em>lo que sienten.</em>
          </h1>
          <p>Encuentra profesionales comprometidos con la salud y el bienestar de tu compañero.</p>
          <form action="/buscar" className="catalog-search">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Buscar veterinario" name="q" placeholder="Especialidad o nombre" />
            <button className="veto-button veto-button--primary" type="submit">
              Buscar
            </button>
          </form>
          <div className="catalog-pet-links">
            <span>Atención para:</span>
            <span>Perros</span>
            <span>Gatos</span>
            <span>Otras mascotas</span>
          </div>
        </div>
        <div className="catalog-hero__image catalog-hero__image--vets">
          <img
            alt="Veterinaria brindando cuidado cercano a un perro"
            src="https://images.unsplash.com/photo-1551739440-5dd934d3a94a?auto=format&fit=crop&w=1000&q=85"
          />
          <span className="catalog-image-sticker">
            <i>✚</i>
            <span>
              Confianza en
              <br />
              cada consulta
            </span>
          </span>
        </div>
      </section>
      <section className="vet-availability">
        <span className="vet-availability__icon">♡</span>
        <div>
          <span className="eyebrow eyebrow--dark">RED DE PROFESIONALES</span>
          <h2>Estamos sumando veterinarios a Veto</h2>
          <p>
            Por ahora puedes encontrar profesionales a través de las clínicas aliadas y conocer los
            equipos que atienden en cada sede.
          </p>
        </div>
        <Link className="veto-button veto-button--secondary" href="/clinicas">
          Explorar clínicas
        </Link>
      </section>
      <section className="vet-join">
        <div>
          <span className="eyebrow">¿ERES VETERINARIO?</span>
          <h2>Tu vocación también puede crecer aquí.</h2>
          <p>Conoce cómo unirte a la red Veto y acercar tu trabajo a más familias.</p>
        </div>
        <Link className="veto-button veto-button--light" href="/registro/aliado">
          Conoce Veto
        </Link>
      </section>
    </div>
  );
}
