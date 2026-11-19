import { Suspense } from 'react';
import { BotonIrA } from '@/components/BotonIrA';
import { CatalogoTienda } from './CatalogoTienda';

export default function Tienda() {
  return (
    <div className="catalog-page catalog-page--compact">
      <section className="catalog-hero catalog-hero--adoption catalog-hero--marca hero-forma--hoja">
        {/* Forma de la ficha detrás del título: va transparente. */}
        <span aria-hidden="true" className="home-blob home-blob--texto" />
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">LA TIENDA DE VETO</span>
          <h1>
            Pequeños detalles, <em>grandes colas felices.</em>
          </h1>
          <p>Encuentra lo que hace sus días más cómodos, saludables y divertidos.</p>
          <BotonIrA destino="productos">Ver productos</BotonIrA>
        </div>
        <div className="catalog-hero__image catalog-hero__image--adoption">
          {/* Detrás de la foto no hay texto: colores sólidos de la ficha, como en adopción. */}
          <span aria-hidden="true" className="adoption-blob adoption-blob--burgundy" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--peach" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--sage" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--miel" />
          <img
            alt="Perro con expresión curiosa listo para jugar"
            src="https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1000&q=85"
          />
          <span className="catalog-image-sticker catalog-image-sticker--adoption">
            <i>♡</i>
            <span>
              Consentirlo
              <br />
              también es cuidarlo
            </span>
          </span>
        </div>
      </section>
      <Suspense>
        <CatalogoTienda />
      </Suspense>
    </div>
  );
}
