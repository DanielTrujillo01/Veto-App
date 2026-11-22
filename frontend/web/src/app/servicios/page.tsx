import { Suspense } from 'react';
import { BotonIrA } from '@/components/BotonIrA';
import { CatalogoServicios } from './CatalogoServicios';

/** HU-026 / HU-027 · Catálogo de servicios con filtros, orden y páginas. */
export default function Servicios() {
  return (
    <div className="catalog-page catalog-page--compact services-page">
      <section className="catalog-hero catalog-hero--adoption catalog-hero--marca hero-forma--organica">
        {/* Forma de la ficha detrás del título: va transparente. */}
        <span aria-hidden="true" className="home-blob home-blob--texto" />
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">CUIDADO A TU MEDIDA</span>
          <h1>
            Servicios para <em>tu mascota.</em>
          </h1>
          <p>
            Consultas, baño, vacunas y más, de clínicas aliadas. Filtra, compara precios y reserva.
          </p>
          <BotonIrA destino="servicios">Ver servicios</BotonIrA>
        </div>
        <div className="catalog-hero__image catalog-hero__image--adoption">
          {/* Detrás de la foto no hay texto: colores sólidos de la ficha, como en adopción. */}
          <span aria-hidden="true" className="adoption-blob adoption-blob--burgundy" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--peach" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--sage" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--miel" />
          <img
            alt="Pomerania envuelto en una toalla mientras lo cepillan después del baño"
            src="https://images.unsplash.com/photo-1611173622933-91942d394b04?auto=format&fit=crop&w=1100&q=85"
          />
          <span className="catalog-image-sticker catalog-image-sticker--adoption">
            <i>♡</i>
            <span>
              Profesionales
              <br />
              de confianza
            </span>
          </span>
        </div>
      </section>
      <div className="catalog-results-anchor" id="servicios">
        <Suspense>
          <CatalogoServicios />
        </Suspense>
      </div>
    </div>
  );
}
