import Link from 'next/link';

const categorias = [
  {
    href: '/clinicas',
    numero: '01',
    icono: '✚',
    titulo: 'Veterinarias',
    descripcion: 'Clínicas con sus veterinarios',
    tono: 'burgundy',
  },
  {
    href: '/veterinarios',
    numero: '02',
    icono: '♡',
    titulo: 'Veterinarios',
    descripcion: 'En sede o a domicilio',
    tono: 'peach',
  },
  {
    href: '/tienda',
    numero: '03',
    icono: '✿',
    titulo: 'Tienda',
    descripcion: 'Alimentos, accesorios e higiene',
    tono: 'sage',
  },
  {
    href: '/adopcion',
    numero: '04',
    icono: '⌂',
    titulo: 'Adopción',
    descripcion: 'Mascotas que buscan hogar',
    tono: 'honey',
  },
];

const servicios = [
  { icono: '✚', titulo: 'Consulta general', detalle: 'Atención para cada etapa' },
  { icono: '✿', titulo: 'Baño y peluquería', detalle: 'Un momento para consentirlo' },
  { icono: '♡', titulo: 'Esterilización', detalle: 'Cuidado con profesionales' },
];

export default function Inicio() {
  return (
    <div className="home-page">
      <section aria-labelledby="home-title" className="home-hero">
        <div aria-hidden="true" className="home-hero__decoration">
          <span className="home-hero__ring home-hero__ring--one" />
          <span className="home-hero__ring home-hero__ring--two" />
          <span className="home-hero__spark">✳</span>
        </div>
        <div className="home-hero__copy">
          <span className="eyebrow eyebrow--dark">
            <i /> BIENESTAR PARA QUIENES MÁS QUIERES
          </span>
          <h1 id="home-title">
            Todo para el cuidado <em>de tu mascota.</em>
          </h1>
          <p>Profesionales de confianza, servicios y mucho cariño. Todo en un solo lugar.</p>
          <form action="/buscar" className="home-search">
            <label className="home-search__field">
              <span aria-hidden="true">⌕</span>
              <span>
                <strong>¿Qué necesitas?</strong>
                <input
                  aria-label="Servicio, veterinario o clínica"
                  name="q"
                  placeholder="Servicio, veterinario o clínica"
                />
              </span>
            </label>
            <span aria-hidden="true" className="home-search__divider" />
            <label className="home-search__field home-search__location">
              <span aria-hidden="true">⌖</span>
              <span>
                <strong>¿Dónde?</strong>
                <input aria-label="Ubicación" defaultValue="Bogotá, Colombia" name="ubicacion" />
              </span>
            </label>
            <button className="veto-button veto-button--primary" type="submit">
              <span aria-hidden="true">⌕</span> Buscar
            </button>
          </form>
          <div className="home-trust">
            <span>
              <i>✓</i> Aliados verificados
            </span>
            <span>
              <i>♡</i> Cuidado cercano
            </span>
            <span>
              <i>⌖</i> En Bogotá
            </span>
          </div>
        </div>
        <div className="home-hero__visual">
          <div className="home-hero__photo">
            <img
              alt="Perro feliz disfrutando tiempo al aire libre"
              src="https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1100&q=85"
            />
          </div>
          <div className="home-hero__cat-photo">
            <img
              alt="Gato tranquilo disfrutando de una caricia"
              src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=360&q=80"
            />
            <span>Más vida juntos</span>
          </div>
          <div className="home-photo-note">
            <span aria-hidden="true">♡</span>
            <div>
              <strong>Se merece lo mejor</strong>
              <small>Te ayudamos a encontrarlo.</small>
            </div>
          </div>
          <span aria-hidden="true" className="home-hero__flower">
            ✿
          </span>
        </div>
      </section>

      <section aria-labelledby="categories-title" className="home-categories">
        <div className="home-section-heading">
          <div>
            <span className="eyebrow eyebrow--dark">TODO LO QUE NECESITA, AQUÍ</span>
            <h2 id="categories-title">¿Por dónde empezamos?</h2>
          </div>
          <span className="home-section-count">
            <i /> 4 formas de cuidar
          </span>
        </div>
        <div className="home-category-grid">
          {categorias.map((categoria) => (
            <Link
              className={`home-category-card home-category-card--${categoria.tono}`}
              href={categoria.href}
              key={categoria.href}
            >
              <span className="home-category-card__number">{categoria.numero}</span>
              <span aria-hidden="true" className="home-category-card__icon">
                {categoria.icono}
              </span>
              <div>
                <strong>{categoria.titulo}</strong>
                <small>{categoria.descripcion}</small>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="services-title" className="home-services">
        <div className="home-services__intro">
          <span className="eyebrow eyebrow--dark">UN BUEN COMIENZO</span>
          <h2 id="services-title">Servicios frecuentes</h2>
          <p>Encuentra el cuidado ideal para cada etapa de su vida.</p>
          <Link className="home-text-link" href="/buscar">
            Explorar servicios
          </Link>
        </div>
        <div className="home-service-list">
          {servicios.map((servicio, index) => (
            <Link
              className="home-service-card"
              href={`/buscar?q=${encodeURIComponent(servicio.titulo)}`}
              key={servicio.titulo}
            >
              <span className={`home-service-card__icon home-service-card__icon--${index + 1}`}>
                {servicio.icono}
              </span>
              <span>
                <strong>{servicio.titulo}</strong>
                <small>{servicio.detalle}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-promise">
        <div aria-hidden="true" className="home-promise__shape">
          ♡
        </div>
        <div>
          <span className="eyebrow">UN EQUIPO QUE ENTIENDE</span>
          <h2>Su bienestar también es el tuyo.</h2>
          <p>Conecta con personas que cuidan a tu mascota con la misma dedicación que tú.</p>
        </div>
        <Link className="veto-button veto-button--light" href="/clinicas">
          Conoce nuestros aliados
        </Link>
      </section>
    </div>
  );
}
