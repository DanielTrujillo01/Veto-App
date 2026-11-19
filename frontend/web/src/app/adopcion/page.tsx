import { Suspense } from 'react';
import { BotonIrA } from '@/components/BotonIrA';
import { CatalogoAdopcion } from './CatalogoAdopcion';

/** HU-024 / HU-087 / HU-088 · Ventana de adopción con el catálogo anónimo de mascotas. */
export default function Adopcion() {
  return (
    <div className="catalog-page catalog-page--compact adoption-page">
      <section className="catalog-hero catalog-hero--adoption catalog-hero--marca">
        {/* Formas de la ficha. Esta pasa detrás del título: va transparente. */}
        <span aria-hidden="true" className="home-blob home-blob--texto" />
        <div className="catalog-hero__copy">
          <span className="eyebrow eyebrow--dark">ADOPTAR CAMBIA DOS VIDAS</span>
          <h1>
            Un hogar lleno de amor <em>los está esperando.</em>
          </h1>
          <p>
            Conoce a las mascotas que buscan familia. Publicadas por fundaciones aliadas de Veto.
          </p>
          <BotonIrA destino="mascotas">Ver mascotas en adopción</BotonIrA>
        </div>
        <div className="catalog-hero__image catalog-hero__image--adoption">
          {/* Detrás de la foto no hay texto: colores sólidos, como en la ficha y en el inicio. */}
          <span aria-hidden="true" className="adoption-blob adoption-blob--burgundy" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--peach" />
          <span aria-hidden="true" className="adoption-blob adoption-blob--miel" />
          <img
            alt="Mujer abrazando a su cachorro en casa"
            src="https://images.unsplash.com/photo-1577175826207-5052ccbf89e8?auto=format&fit=crop&w=1000&q=85"
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
      <Suspense>
        <CatalogoAdopcion />
      </Suspense>
    </div>
  );
}
