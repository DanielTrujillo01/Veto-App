import { useState, type FormEvent } from 'react';
import type { LayoutKind } from './Layouts';

const categories = [
  {
    id: 'veterinarias',
    icon: '✚',
    name: 'Veterinarias',
    description: 'Clínicas con sus veterinarios',
    color: 'burgundy',
  },
  {
    id: 'veterinarios',
    icon: '♡',
    name: 'Veterinarios',
    description: 'En sede o a domicilio',
    color: 'peach',
  },
  {
    id: 'tienda',
    icon: '✿',
    name: 'Tienda',
    description: 'Alimentos, accesorios e higiene',
    color: 'sage',
  },
  {
    id: 'adopcion',
    icon: '⌂',
    name: 'Adopción',
    description: 'Mascotas que buscan hogar',
    color: 'honey',
  },
];

const services = [
  { icon: '✚', name: 'Consulta general', detail: 'Desde $65.000' },
  { icon: '✿', name: 'Baño y peluquería', detail: 'Cuidado de expertos' },
  { icon: '♡', name: 'Esterilización', detail: 'Agenda con confianza' },
];

export function Inicio({
  onOpenLayouts,
  onOpenComponents,
}: {
  onOpenLayouts: (layout: LayoutKind) => void;
  onOpenComponents: () => void;
}) {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('Bogotá, Colombia');
  const [searchState, setSearchState] = useState<
    'idle' | 'loading' | 'results' | 'empty' | 'validation' | 'error'
  >('idle');

  const runSearch = (searchTerm = query) => {
    if (!searchTerm.trim()) {
      setSearchState('validation');
      return;
    }
    setSearchState('loading');
    window.setTimeout(() => setSearchState('results'), 500);
  };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runSearch();
  };

  return (
    <main className="veto-home" id="inicio">
      <section className="veto-home-hero" aria-labelledby="home-title">
        <div className="veto-home-hero__art" aria-hidden="true">
          <span className="veto-home-hero__orbit veto-home-hero__orbit--one" />
          <span className="veto-home-hero__orbit veto-home-hero__orbit--two" />
          <span className="veto-home-hero__flower">✿</span>
        </div>
        <div className="veto-home-hero__content">
          <span className="veto-home-eyebrow">
            <span /> Bienestar para quienes más quieres
          </span>
          <h1 id="home-title">
            Todo para el cuidado <em>de tu mascota.</em>
          </h1>
          <p>Profesionales de confianza, servicios y mucho cariño. Todo en un solo lugar.</p>
          <form className="veto-search-panel" onSubmit={search} noValidate>
            <label className="veto-search-field veto-search-field--service">
              <span aria-hidden="true">⌕</span>
              <span className="veto-search-field__copy">
                <strong>¿Qué necesitas?</strong>
                <input
                  id="buscador"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (searchState === 'validation') setSearchState('idle');
                  }}
                  placeholder="Servicio, veterinario o clínica"
                  aria-label="Servicio, veterinario o clínica"
                  aria-invalid={searchState === 'validation'}
                  aria-describedby={searchState === 'validation' ? 'search-error' : undefined}
                />
              </span>
            </label>
            <span className="veto-search-divider" aria-hidden="true" />
            <label className="veto-search-field veto-search-field--location">
              <span aria-hidden="true">⌖</span>
              <span className="veto-search-field__copy">
                <strong>¿Dónde?</strong>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  aria-label="Ubicación"
                />
              </span>
            </label>
            <button className="veto-button veto-button--filled veto-search-submit" type="submit">
              <span aria-hidden="true">⌕</span>
              Buscar
            </button>
          </form>
          <div className="veto-search-feedback" aria-live="polite">
            {searchState === 'validation' && (
              <p className="veto-search-error" id="search-error">
                <span aria-hidden="true">!</span> Escribe un servicio para comenzar tu búsqueda.
              </p>
            )}
            {searchState === 'loading' && (
              <p className="veto-search-loading" role="status">
                <span aria-hidden="true" /> Buscando opciones de cuidado cerca de ti…
              </p>
            )}
            {searchState === 'results' && (
              <div className="veto-search-results">
                <strong>Encontramos opciones para ti</strong>
                <span>Consulta general · 12 profesionales cerca de {location || 'Bogotá'}</span>
                <button type="button" onClick={() => setSearchState('empty')}>
                  Ver estado vacío
                </button>
                <button type="button" onClick={() => setSearchState('error')}>
                  Simular error
                </button>
              </div>
            )}
            {searchState === 'empty' && (
              <div className="veto-search-empty">
                <span aria-hidden="true">♡</span>
                <span>
                  <strong>Aún no hay resultados</strong> Prueba con otro servicio o ubicación.
                </span>
                <button type="button" onClick={() => setSearchState('idle')}>
                  Intentar de nuevo
                </button>
              </div>
            )}
            {searchState === 'error' && (
              <div className="veto-search-network-error" role="alert">
                <span aria-hidden="true">!</span>
                <span>
                  <strong>No pudimos cargar los resultados.</strong> Tu búsqueda sigue aquí. Revisa
                  tu conexión e inténtalo de nuevo.
                </span>
                <button type="button" onClick={() => runSearch()}>
                  Reintentar
                </button>
              </div>
            )}
          </div>
          <div className="veto-home-trust">
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
        <div className="veto-home-photo">
          <img
            src="https://images.unsplash.com/photo-1558788353-f76d92427f16?auto=format&fit=crop&w=1100&q=85"
            alt="Perro feliz disfrutando tiempo al aire libre"
          />
          <div className="veto-photo-note">
            <span className="veto-photo-note__heart">♡</span>
            <span>
              <strong>Se merece lo mejor</strong>
              <small>Nosotros te ayudamos a encontrarlo.</small>
            </span>
          </div>
          <span className="veto-photo-sparkle" aria-hidden="true">
            ✳
          </span>
        </div>
      </section>

      <section className="veto-category-section" aria-labelledby="category-title">
        <div className="veto-section-heading">
          <div>
            <span className="veto-section-kicker">Todo lo que necesita, aquí</span>
            <h2 id="category-title">¿Por dónde empezamos?</h2>
          </div>
          <span className="veto-section-index">
            01 <i /> 03
          </span>
        </div>
        <div className="veto-category-grid">
          {categories.map((category, index) => (
            <a
              className={`veto-category-card veto-category-card--${category.color}`}
              href={`#${category.id}`}
              key={category.id}
              id={category.id}
              onClick={(event) => {
                event.preventDefault();
                setQuery(category.name);
                runSearch(category.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="veto-category-card__index">0{index + 1}</span>
              <span className="veto-category-card__icon" aria-hidden="true">
                {category.icon}
              </span>
              <span className="veto-category-card__arrow" aria-hidden="true">
                ↗
              </span>
              <span className="veto-category-card__text">
                <strong>{category.name}</strong>
                <small>{category.description}</small>
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="veto-services-section" id="servicios" aria-labelledby="services-title">
        <div className="veto-services-intro">
          <span className="veto-section-kicker">Un buen comienzo</span>
          <h2 id="services-title">Servicios frecuentes</h2>
          <p>Encuentra el cuidado ideal para cada etapa de su vida.</p>
          <button className="veto-text-link" type="button" onClick={onOpenComponents}>
            Explorar componentes <span aria-hidden="true">→</span>
          </button>
        </div>
        <div className="veto-service-list">
          {services.map((service, index) => (
            <button
              className="veto-service-card"
              key={service.name}
              type="button"
              onClick={() => {
                setQuery(service.name);
                setSearchState('results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span
                className={`veto-service-icon veto-service-icon--${index + 1}`}
                aria-hidden="true"
              >
                {service.icon}
              </span>
              <span className="veto-service-copy">
                <strong>{service.name}</strong>
                <small>{service.detail}</small>
              </span>
              <span className="veto-service-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="veto-promise">
        <span className="veto-promise__flower" aria-hidden="true">
          ✿
        </span>
        <div>
          <span className="veto-section-kicker">Un equipo que entiende</span>
          <h2>Su bienestar también es el tuyo.</h2>
          <p>Conecta con personas que cuidan a tu mascota con la misma dedicación que tú.</p>
        </div>
        <button
          className="veto-button veto-button--light"
          type="button"
          onClick={() => onOpenLayouts('public')}
        >
          Conoce Veto <span aria-hidden="true">→</span>
        </button>
      </section>

      <footer className="veto-home-footer">
        <a className="veto-brand veto-brand--light" href="#inicio" aria-label="Veto, ir al inicio">
          <span className="veto-brand__symbol" aria-hidden="true">
            V
          </span>
          <span>veto</span>
          <span className="veto-brand__paw" aria-hidden="true">
            ♥
          </span>
        </a>
        <span className="veto-footer-tagline">CUIDAMOS LO QUE AMAS</span>
        <div className="veto-footer-links">
          <a href="#terminos">Términos</a>
          <a href="#privacidad">Privacidad</a>
          <a href="#pqrs">PQRS</a>
        </div>
        <small>© 2026 Veto · Hecho con cariño en Bogotá</small>
      </footer>
    </main>
  );
}
