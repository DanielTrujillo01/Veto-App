'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';

const enlaces = [
  { href: '/clinicas', etiqueta: 'Veterinarias' },
  { href: '/veterinarios', etiqueta: 'Veterinarios' },
  { href: '/tienda', etiqueta: 'Tienda' },
  { href: '/adopcion', etiqueta: 'Adopción' },
  { href: '/mascotas', etiqueta: 'Mis mascotas' },
];

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const paginaInterna = pathname.startsWith('/panel/') || pathname.startsWith('/equipo-veto/');
  const paginaAutenticacion =
    pathname === '/ingresar' ||
    pathname.startsWith('/registro') ||
    pathname === '/recuperar-contrasena';

  if (paginaInterna) return <>{children}</>;

  return (
    <>
      <header className={`public-header${paginaAutenticacion ? ' public-header--auth' : ''}`}>
        <div className="public-header__inner">
          <Link aria-label="Veto, ir al inicio" className="public-brand" href="/">
            <BrandLogo className="brand-logo" />
          </Link>
          {paginaAutenticacion ? (
            <nav aria-label="Navegación de cuenta" className="public-auth-nav">
              <Link href="/">Volver al inicio</Link>
              {pathname === '/ingresar' ? (
                <Link className="veto-button veto-button--secondary" href="/clinicas">
                  Explorar Veto
                </Link>
              ) : (
                <Link className="public-auth-nav__login" href="/ingresar">
                  ¿Ya tienes cuenta? <strong>Inicia sesión</strong>
                </Link>
              )}
            </nav>
          ) : (
            <>
              <form action="/buscar" className="public-header-search" role="search">
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Buscar servicios, productos o clínicas"
                  name="q"
                  placeholder="¿Qué necesita tu mascota?"
                />
                <button aria-label="Buscar" type="submit">
                  Buscar
                </button>
              </form>
              <nav
                aria-label="Navegación principal"
                className={`public-nav${menuAbierto ? ' public-nav--open' : ''}`}
              >
                {enlaces.map((enlace) => (
                  <Link
                    aria-current={pathname === enlace.href ? 'page' : undefined}
                    href={enlace.href}
                    key={enlace.href}
                    onClick={() => setMenuAbierto(false)}
                  >
                    {enlace.etiqueta}
                  </Link>
                ))}
                <div className="public-nav__actions">
                  <Link className="veto-button veto-button--secondary" href="/ingresar">
                    Ingresar
                  </Link>
                  <Link className="veto-button veto-button--primary" href="/registro">
                    Registrarme
                  </Link>
                </div>
              </nav>
              <button
                aria-expanded={menuAbierto}
                aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'}
                className="public-menu-toggle"
                onClick={() => setMenuAbierto(!menuAbierto)}
                type="button"
              >
                <span />
                <span />
                <span />
              </button>
            </>
          )}
        </div>
      </header>
      <main className={`site-main${paginaAutenticacion ? ' site-main--auth' : ''}`}>
        {children}
      </main>
      <footer className={`public-footer${paginaAutenticacion ? ' public-footer--auth' : ''}`}>
        <Link aria-label="Veto, ir al inicio" className="public-brand public-brand--light" href="/">
          <BrandLogo className="brand-logo" />
        </Link>
        <span className="public-footer__tagline">CUIDAMOS LO QUE AMAS</span>
        <nav aria-label="Enlaces legales">
          <Link href="/clinicas">Veterinarias</Link>
          <Link href="/tienda">Tienda</Link>
          <Link href="/adopcion">Adopción</Link>
          <Link href="/perfil">Mi perfil</Link>
        </nav>
        <small>© 2026 Veto · Hecho con cariño en Bogotá</small>
      </footer>
    </>
  );
}
