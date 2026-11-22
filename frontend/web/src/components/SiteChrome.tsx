'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { CarritoEnlace } from '@/components/CarritoEnlace';
import { ApiError, api } from '@/lib/api';
import { escucharCambioSesion, notificarCambioSesion, type UsuarioSesion } from '@/lib/session';

const enlaces = [
  { href: '/clinicas', etiqueta: 'Clínicas' },
  { href: '/veterinarios', etiqueta: 'Veterinarios' },
  { href: '/servicios', etiqueta: 'Servicios' },
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

    // Si la API todavía no responde (por ejemplo, mientras arranca), se reintenta una vez.
    const consultarSesion = () =>
      api<{ usuario: UsuarioSesion }>('/identidad/me').catch(async (causa: unknown) => {
        if (causa instanceof ApiError) throw causa;
        await new Promise((resolver) => setTimeout(resolver, 2000));
        return api<{ usuario: UsuarioSesion }>('/identidad/me');
      });

    void consultarSesion()
      .then(({ usuario: sesion }) => {
        if (vigente && !sesionCambiada) setUsuario(sesion);
      })
      .catch((causa: unknown) => {
        if (causa instanceof ApiError && causa.status === 401) {
          if (vigente && !sesionCambiada) setUsuario(null);
          return;
        }
        // Sin conexión con la API se muestra la web como sin sesión; es un aviso, no un error de
        // la página (console.error abriría el overlay de errores de Next.js en desarrollo).
        console.warn('No pudimos consultar la sesión de Veto.', causa);
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
    : enlaces;

  if (paginaInterna) return <>{children}</>;

  return (
    <>
      <header className="public-header">
        <div className="public-header__inner">
          <Link
            aria-label="Veto, ir al inicio"
            className="public-brand public-brand--header"
            href="/"
          >
            <BrandLogo className="brand-logo" />
          </Link>
          <>
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
                  <span aria-label="Consultando sesión" className="public-nav__session-skeleton" />
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
            <CarritoEnlace onClick={() => setMenuAbierto(false)} />
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
        </div>
      </header>
      <main className={`site-main${paginaAutenticacion ? ' site-main--auth' : ''}`}>
        {children}
      </main>
      <footer className="public-footer public-footer--full">
        <div className="public-footer__brand">
          <Link
            aria-label="Veto, ir al inicio"
            className="public-brand public-brand--light"
            href="/"
          >
            <BrandLogo className="brand-logo" />
          </Link>
          <span className="public-footer__tagline">CUIDAMOS LO QUE AMAS</span>
          <p>Clínicas, veterinarios, tienda y adopción para tu mascota, en un solo lugar.</p>
        </div>
        <nav aria-label="Explora Veto" className="public-footer__col">
          <strong>Explora</strong>
          {enlaces.map((enlace) => (
            <Link href={enlace.href} key={enlace.href}>
              {enlace.etiqueta}
            </Link>
          ))}
        </nav>
        <nav aria-label="Tu cuenta" className="public-footer__col">
          <strong>Tu cuenta</strong>
          {!usuario ? (
            <>
              <Link href="/ingresar">Ingresar</Link>
              <Link href="/registro">Crear cuenta</Link>
              <Link href="/recuperar-contrasena">Recuperar contraseña</Link>
            </>
          ) : usuario.rol === 'TUTOR' ? (
            <>
              <Link href="/perfil">Mi perfil</Link>
              <Link href="/mascotas">Mis mascotas</Link>
              <Link href="/carrito">Carrito</Link>
            </>
          ) : (
            <>
              <Link href={usuario.rol === 'VETERINARIO' ? '/panel/veterinario' : '/panel/aliado'}>
                Mi panel
              </Link>
              <Link href="/perfil">Mi perfil</Link>
            </>
          )}
        </nav>
        <nav aria-label="Aliados" className="public-footer__col">
          <strong>Aliados</strong>
          <Link href="/registro/aliado">Registra tu clínica, tienda o fundación</Link>
          <Link href="/ingresar">Ingreso de aliados</Link>
        </nav>
        <small className="public-footer__bottom">© 2026 Veto · Hecho con cariño en Colombia</small>
      </footer>
    </>
  );
}
