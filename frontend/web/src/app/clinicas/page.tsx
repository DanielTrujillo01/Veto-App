import { Suspense } from 'react';
import { BotonIrA } from '@/components/BotonIrA';
import { DirectorioClinicas } from './DirectorioClinicas';

/** Directorio de clínicas aliadas, con filtros y de a 8 por página. */
export default function Clinicas() {
  return (
    <div className="catalog-page catalog-page--compact clinics-page">
      <section className="catalog-hero catalog-hero--adoption catalog-hero--marca hero-forma--arco">
        {/* Forma de la ficha detrás del título: va transparente. */}
        <span aria-hidden="true" className="home-blob home-blob--texto" />
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">ALIADOS VETO</span>
          <h1>
            Encuentra una clínica <em>de confianza.</em>
          </h1>
          <p>Conoce su equipo veterinario, sus sedes y los servicios que ofrece.</p>
          <BotonIrA destino="clinicas">Ver clínicas</BotonIrA>
        </div>
        <div className="catalog-hero__image catalog-hero__image--adoption">
          {/* Detrás de la foto no hay texto: colores sólidos de la ficha, como en adopción. */}
          <span aria-hidden="true" className="adoption-blob adoption-blob--burgundy" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--peach" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--sage" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--miel" />
          <img
            alt="Chihuahua en consulta, sostenido por una veterinaria"
            src="https://images.unsplash.com/photo-1654895716780-b4664497420d?auto=format&fit=crop&w=1100&q=85"
          />
          <span className="catalog-image-sticker catalog-image-sticker--adoption">
            <i>♡</i>
            <span>
              Aliados
              <br />
              verificados
            </span>
          </span>
        </div>
      </section>
      <Suspense>
        <DirectorioClinicas />
      </Suspense>
    </div>
  );
}
