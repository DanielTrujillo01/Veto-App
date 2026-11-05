import Link from 'next/link';

const categorias = [
  { icono: '◉', titulo: 'Alimento', texto: 'Nutrición para cada etapa', tono: 'burgundy' },
  { icono: '♧', titulo: 'Juguetes', texto: 'Juego, movimiento y diversión', tono: 'sage' },
  { icono: '⌂', titulo: 'Camas y hogar', texto: 'Su rincón favorito', tono: 'peach' },
  { icono: '✿', titulo: 'Cuidado e higiene', texto: 'Bienestar de nariz a cola', tono: 'honey' },
];

export default function Tienda() {
  return (
    <div className="catalog-page">
      <section className="catalog-hero catalog-hero--store">
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">LA TIENDA DE VETO</span>
          <h1>
            Pequeños detalles, <em>grandes colas felices.</em>
          </h1>
          <p>Encuentra lo que hace sus días más cómodos, saludables y divertidos.</p>
          <form action="/buscar" className="catalog-search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar en la tienda"
              name="q"
              placeholder="Busca alimento, juguetes..."
            />
            <button className="veto-button veto-button--primary" type="submit">
              Buscar
            </button>
          </form>
          <div className="catalog-pet-links">
            <span>Explora por:</span>
            <Link href="/buscar?q=perro">Perro</Link>
            <Link href="/buscar?q=gato">Gato</Link>
            <Link href="/buscar?q=otras+mascotas">Otras mascotas</Link>
          </div>
        </div>
        <div className="catalog-hero__image catalog-hero__image--store">
          <img
            alt="Perro con expresión curiosa listo para jugar"
            src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&q=85"
          />
          <span className="catalog-image-sticker">
            <i>♡</i>
            <span>
              Consentirlo
              <br />
              también es cuidarlo
            </span>
          </span>
        </div>
      </section>
      <section className="catalog-categories">
        <div className="home-section-heading">
          <div>
            <span className="eyebrow eyebrow--dark">UN MUNDO POR DESCUBRIR</span>
            <h2>¿Qué le hace falta hoy?</h2>
          </div>
          <span className="home-section-count">
            <i /> Para cada momento
          </span>
        </div>
        <div className="catalog-category-grid">
          {categorias.map((categoria) => (
            <Link
              className={`catalog-category catalog-category--${categoria.tono}`}
              href={`/buscar?q=${encodeURIComponent(categoria.titulo)}`}
              key={categoria.titulo}
            >
              <span aria-hidden="true" className="catalog-category__icon">
                {categoria.icono}
              </span>
              <strong>{categoria.titulo}</strong>
              <small>{categoria.texto}</small>
              <span className="catalog-category__action">Explorar</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="catalog-note">
        <span aria-hidden="true">✿</span>
        <div>
          <strong>Estamos preparando algo especial</strong>
          <p>
            Muy pronto podrás comprar en la tienda Veto. Mientras tanto, encuentra veterinarias y
            servicios cerca de ti.
          </p>
        </div>
        <Link className="veto-button veto-button--secondary" href="/clinicas">
          Ver veterinarias
        </Link>
      </section>
    </div>
  );
}
