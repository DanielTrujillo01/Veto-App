'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { ApiError, api } from '@/lib/api';
import { escucharCambioSesion, notificarCambioSesion, type UsuarioSesion } from '@/lib/session';

const enlaces = [
  { href: '/veterinarios', etiqueta: 'Veterinarios' },
  { href: '/tienda', etiqueta: 'Tienda' },
  { href: '/adopcion', etiqueta: 'Adopción' },
];

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [usuario, setUsuario] = useState<UsuarioSesion | null>(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [errorSesion, setErrorSesion] = useState('');
  const paginaInterna = pathname.startsWith('/panel/') || pathname.startsWith('/equipo-veto/');
  const paginaAutenticacion =
    pathname === '/ingresar' ||
    pathname.startsWith('/registro') ||
    pathname === '/recuperar-contrasena';

  useEffect(() => {
    let vigente = true;
    let sesionCambiada = false;
    const dejarDeEscuchar = escucharCambioSesion((sesion) => {
      sesionCambiada = true;
      setUsuario(sesion);
      setSesionLista(true);
    });

    void api<{ usuario: UsuarioSesion }>('/identidad/me')
      .then(({ usuario: sesion }) => {
        if (vigente && !sesionCambiada) setUsuario(sesion);
      })
      .catch((causa: unknown) => {
        if (causa instanceof ApiError && causa.status === 401) {
          if (vigente && !sesionCambiada) setUsuario(null);
          return;
        }
        console.error('No pudimos consultar la sesión de Veto.', causa);
        if (vigente && !sesionCambiada) setUsuario(null);
      })
      .finally(() => {
        if (vigente) setSesionLista(true);
      });

    return () => {
      vigente = false;
      dejarDeEscuchar();
    };
  }, []);

  async function cerrarSesion() {
    setCerrandoSesion(true);
    setErrorSesion('');
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('No pudimos cerrar tu sesión. Inténtalo de nuevo.');
      setUsuario(null);
      notificarCambioSesion(null);
      setMenuAbierto(false);
      router.push('/');
      router.refresh();
    } catch (causa) {
      setErrorSesion(
        causa instanceof Error ? causa.message : 'No pudimos cerrar tu sesión. Inténtalo de nuevo.',
      );
    } finally {
      setCerrandoSesion(false);
    }
  }

  const enlacesVisibles = usuario
    ? usuario.rol === 'TUTOR'
      ? [...enlaces, { href: '/mascotas', etiqueta: 'Mis mascotas' }]
      : [
          ...enlaces,
          {
            href: usuario.rol === 'VETERINARIO' ? '/panel/veterinario' : '/panel/aliado',
            etiqueta: 'Mi panel',
          },
        ]
    : [...enlaces, { href: '/mascotas', etiqueta: 'Mis mascotas' }];

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
              {sesionLista && usuario ? (
                <>
                  <Link className="veto-button veto-button--secondary" href="/perfil">
                    Mi perfil
                  </Link>
                  <button
                    className="veto-button veto-button--primary"
                    disabled={cerrandoSesion}
                    onClick={() => void cerrarSesion()}
                    type="button"
                  >
                    {cerrandoSesion ? 'Cerrando…' : 'Cerrar sesión'}
                  </button>
                </>
              ) : pathname === '/ingresar' ? (
                <Link className="veto-button veto-button--secondary" href="/clinicas">
                  Explorar Veto
                </Link>
              ) : (
                <Link className="public-auth-nav__login" href="/ingresar">
                  ¿Ya tienes cuenta? <strong>Inicia sesión</strong>
                </Link>
              )}
              {errorSesion && (
                <p className="public-header__session-error" role="alert">
                  {errorSesion}
                </p>
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
                {enlacesVisibles.map((enlace) => (
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
                  {!sesionLista ? (
                    <span
                      aria-label="Consultando sesión"
                      className="public-nav__session-skeleton"
                    />
                  ) : usuario ? (
                    <>
                      <span className="public-nav__greeting">Hola, {usuario.nombre}</span>
                      <Link className="veto-button veto-button--secondary" href="/perfil">
                        Mi perfil
                      </Link>
                      <button
                        className="veto-button veto-button--primary"
                        disabled={cerrandoSesion}
                        onClick={() => void cerrarSesion()}
                        type="button"
                      >
                        {cerrandoSesion ? 'Cerrando…' : 'Cerrar sesión'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link className="veto-button veto-button--secondary" href="/ingresar">
                        Ingresar
                      </Link>
                      <Link className="veto-button veto-button--primary" href="/registro">
                        Registrarme
                      </Link>
                    </>
                  )}
                </div>
              </nav>
              {errorSesion && (
                <p className="public-header__session-error" role="alert">
                  {errorSesion}
                </p>
              )}
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
