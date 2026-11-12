import { useState } from 'react';
import DesignSystem from './DesignSystem';
import { Inicio } from './Inicio';
import { Layouts, type LayoutKind } from './Layouts';

type View = 'inicio' | 'componentes' | 'layouts';

function BrandMark({ onClick }: { onClick?: () => void }) {
  return (
    <a
      className="veto-brand"
      href="#inicio"
      aria-label="Veto, ir al inicio"
      onClick={(event) => {
        if (onClick) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="veto-brand__symbol" aria-hidden="true">
        V
      </span>
      <span>veto</span>
      <span className="veto-brand__paw" aria-hidden="true">
        ♥
      </span>
    </a>
  );
}

export default function App() {
  const [view, setView] = useState<View>('inicio');
  const [layout, setLayout] = useState<LayoutKind>('public');
  const [menuOpen, setMenuOpen] = useState(false);

  const openLayouts = (nextLayout: LayoutKind) => {
    setLayout(nextLayout);
    setView('layouts');
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openComponents = () => {
    setView('componentes');
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const returnToHome = () => {
    setView('inicio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (view === 'componentes') {
    return (
      <>
        <div className="prototype-switcher">
          <BrandMark onClick={returnToHome} />
          <div className="prototype-switcher__links">
            <button type="button" onClick={returnToHome}>
              Inicio
            </button>
            <button type="button" onClick={() => openLayouts('public')}>
              Los tres layouts
            </button>
          </div>
        </div>
        <DesignSystem />
      </>
    );
  }

  if (view === 'layouts') {
    return (
      <>
        <div className="prototype-switcher">
          <BrandMark onClick={returnToHome} />
          <div className="prototype-switcher__links">
            <button type="button" onClick={returnToHome}>
              Inicio
            </button>
            <button type="button" onClick={openComponents}>
              Componentes
            </button>
          </div>
        </div>
        <Layouts initialLayout={layout} onLayoutChange={setLayout} />
      </>
    );
  }

  return (
    <>
      <header className="veto-site-header">
        <div className="veto-site-header__inner">
          <BrandMark />
          <form
            className="veto-header-search"
            onSubmit={(event) => {
              event.preventDefault();
              document.getElementById('buscador')?.focus();
            }}
          >
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Buscar servicios veterinarios"
              placeholder="Veterinario, servicio, clínica..."
              onFocus={() => document.getElementById('buscador')?.focus()}
              readOnly
            />
            <button type="submit">Buscar</button>
          </form>
          <nav
            className={`veto-site-nav${menuOpen ? ' veto-site-nav--open' : ''}`}
            aria-label="Navegación principal"
          >
            <a href="#veterinarias">Veterinarias</a>
            <a href="#veterinarios">Veterinarios</a>
            <a href="#servicios">Tienda</a>
            <a href="#adopcion">Adopción</a>
            <button className="veto-prototype-link" type="button" onClick={openComponents}>
              Componentes
            </button>
            <button
              className="veto-prototype-link"
              type="button"
              onClick={() => openLayouts('public')}
            >
              Layouts
            </button>
            <button
              className="veto-nav-mobile-search"
              type="button"
              onClick={() => document.getElementById('buscador')?.focus()}
            >
              Buscar
            </button>
            <button
              className="veto-button veto-button--outline"
              type="button"
              onClick={() => openLayouts('auth')}
            >
              Ingresar
            </button>
            <button
              className="veto-button veto-button--filled"
              type="button"
              onClick={() => openLayouts('auth')}
            >
              Registrarme
            </button>
          </nav>
          <button
            className="veto-menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </header>
      <Inicio onOpenLayouts={openLayouts} onOpenComponents={openComponents} />
    </>
  );
}
