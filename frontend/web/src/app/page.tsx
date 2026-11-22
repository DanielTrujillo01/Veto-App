import Image from 'next/image';
import Link from 'next/link';
import { HeroCarrusel } from './HeroCarrusel';

const categorias = [
  {
    href: '/clinicas',
    titulo: 'Clínicas',
    descripcion: 'Clínicas con sus veterinarios',
    imagen: '/categorias/veterinaria.png',
  },
  {
    href: '/veterinarios',
    titulo: 'Veterinarios',
    descripcion: 'En sede o a domicilio',
    imagen: '/categorias/veterinario.png',
  },
  {
    href: '/tienda',
    titulo: 'Tienda',
    descripcion: 'Alimentos, accesorios e higiene',
    imagen: '/categorias/tienda.png',
  },
  {
    href: '/adopcion',
    titulo: 'Adopción',
    descripcion: 'Mascotas que buscan hogar',
    imagen: '/categorias/adopcion.png',
  },
];

/**
 * Mosaico de servicios del inicio. Cada tarjeta lleva al catálogo de servicios ya filtrado.
 * Fotos de Unsplash (licencia gratuita de Unsplash, uso comercial sin atribución obligatoria).
 */
const foto = (id: string, ancho: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${ancho}&q=80`;

const servicios = [
  {
    titulo: 'Consulta general',
    detalle: 'Atención para cada etapa de su vida',
    href: '/servicios?tipoServicioId=1',
    foto: foto('photo-1725409796872-8b41e8eca929', 900),
    alt: 'Veterinaria examinando a un gatito blanco',
  },
  {
    titulo: 'Baño y peluquería',
    detalle: 'Un momento para consentirlo',
    href: '/servicios?tipoServicioId=2',
    foto: foto('photo-1772437883387-8076cf660c65', 600),
    alt: 'Perro blanco recién peinado con pañoleta azul',
  },
  {
    titulo: 'Esterilización',
    detalle: 'Cuidado con profesionales',
    href: '/servicios?tipoServicioId=3',
    foto: foto('photo-1770836037275-38b44e4b101f', 600),
    alt: 'Veterinario atendiendo a un perro pequeño',
  },
  {
    titulo: 'Atención a domicilio',
    detalle: 'El profesional va a tu casa',
    href: '/servicios?modalidad=A_DOMICILIO',
    foto: foto('photo-1774440865482-81a8c9b92e76', 600),
    alt: 'Cachorro beagle descansando en el sofá de casa',
  },
  {
    titulo: 'Para gatos',
    detalle: 'Servicios para tu felino',
    href: '/servicios?especieId=2',
    foto: foto('photo-1596272875729-ed2ff7d6d9c5', 600),
    alt: 'Persona sosteniendo a un gato atigrado',
  },
];

export default function Inicio() {
  return (
    <div className="home-page">
      <HeroCarrusel />

      <section
        aria-labelledby="categories-title"
        className="home-categories"
        id="por-donde-empezamos"
      >
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
              className="service-mosaic__tile category-tile"
              href={categoria.href}
              key={categoria.href}
            >
              <span className="service-mosaic__photo category-tile__photo">
                <Image alt="" fill sizes="(max-width: 760px) 50vw, 25vw" src={categoria.imagen} />
              </span>
              <span className="service-mosaic__label">
                <strong>{categoria.titulo}</strong>
                <small>{categoria.descripcion}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="services-title" className="home-services-grid">
        <div className="home-section-heading">
          <div>
            <span className="eyebrow eyebrow--dark">
              <i /> CUIDADO A TU MEDIDA
            </span>
            <h2 id="services-title">Servicios</h2>
          </div>
          <Link className="home-text-link" href="/servicios">
            Ver todos los servicios
          </Link>
        </div>
        <div className="service-mosaic">
          {servicios.map((servicio, indice) => (
            <Link
              className={`service-mosaic__tile${indice === 0 ? ' service-mosaic__tile--grande' : ''}`}
              href={servicio.href}
              key={servicio.titulo}
            >
              <span className="service-mosaic__photo">
                <img alt={servicio.alt} loading="lazy" src={servicio.foto} />
              </span>
              <span className="service-mosaic__label">
                <strong>{servicio.titulo}</strong>
                <small>{servicio.detalle}</small>
              </span>
            </Link>
          ))}
          {/* Bloque de color (burgundy, el principal) para ver todo el catálogo. */}
          <Link className="service-mosaic__tile service-mosaic__tile--todos" href="/servicios">
            <span aria-hidden="true" className="service-mosaic__blob" />
            <span aria-hidden="true" className="service-mosaic__dot" />
            <strong>Todos los servicios</strong>
            <small>Filtra por especie, tipo y modalidad</small>
            <span aria-hidden="true" className="service-mosaic__arrow">
              →
            </span>
          </Link>
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
