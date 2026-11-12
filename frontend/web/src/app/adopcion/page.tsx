import Link from 'next/link';

export default function Adopcion() {
  return (
    <div className="catalog-page adoption-page">
      <section className="catalog-hero catalog-hero--adoption">
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">ADOPTAR CAMBIA DOS VIDAS</span>
          <h1>
            Un hogar lleno de amor <em>te está esperando.</em>
          </h1>
          <p>
            Conoce a los aliados de Veto y descubre cómo darle una nueva historia a un compañero
            peludo.
          </p>
          <Link className="veto-button veto-button--primary" href="/clinicas">
            Conocer aliados de Veto
          </Link>
          <div className="catalog-pet-links">
            <span>Todos merecen amor:</span>
            <span>Perros</span>
            <span>Gatos</span>
            <span>Otros amigos</span>
          </div>
        </div>
        <div className="catalog-hero__image catalog-hero__image--adoption">
          <img
            alt="Perro adoptado descansando en un hogar acogedor"
            src="https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1000&q=85"
          />
          <span className="catalog-image-sticker catalog-image-sticker--adoption">
            <i>♡</i>
            <span>
              Amor a primera
              <br />
              patita
            </span>
          </span>
        </div>
      </section>
      <section className="adoption-steps">
        <div className="home-section-heading">
          <div>
            <span className="eyebrow eyebrow--dark">UN NUEVO COMIENZO</span>
            <h2>Adoptar es más fácil en compañía</h2>
          </div>
        </div>
        <div className="adoption-step-grid">
          <article>
            <span>01</span>
            <i>⌕</i>
            <h3>Encuentra a tu compañero</h3>
            <p>Conoce fundaciones y aliados comprometidos con el bienestar animal.</p>
          </article>
          <article>
            <span>02</span>
            <i>♡</i>
            <h3>Conoce su historia</h3>
            <p>Pregunta por su personalidad, cuidados y todo lo que necesita para adaptarse.</p>
          </article>
          <article>
            <span>03</span>
            <i>⌂</i>
            <h3>Abre las puertas de casa</h3>
            <p>Prepara un espacio seguro y empieza una nueva aventura juntos.</p>
          </article>
        </div>
      </section>
      <section className="catalog-note catalog-note--adoption">
        <span aria-hidden="true">♡</span>
        <div>
          <strong>Estamos conectando con fundaciones</strong>
          <p>
            Pronto encontrarás aquí mascotas disponibles para adopción. Mientras tanto, puedes
            conocer a nuestros aliados veterinarios.
          </p>
        </div>
        <Link className="veto-button veto-button--secondary" href="/clinicas">
          Ver aliados
        </Link>
      </section>
    </div>
  );
}
